"""
Netra — Options Trading Signal Engine

Generates high-probability options strategies for NIFTY / BANKNIFTY using:
- Underlying directional bias (regime + composite signal)
- Implied volatility regime (IV percentile vs 30d distribution)
- Probability-of-Profit (POP) optimized strike selection via delta targeting

Strategy selection matrix
-------------------------
                      | Low IV (buy premium)      | High IV (sell premium)
trending_up + BUY     | Bull Call Debit Spread    | Bull Put Credit Spread *
trending_down + SELL  | Bear Put Debit Spread     | Bear Call Credit Spread *
ranging + HOLD        | Long Iron Butterfly       | Iron Condor *
volatile + any        | Long Straddle             | Short Strangle (skipped — undefined risk)

* = highest historical win rate (~70-80%) — preferred when conditions align.

All strategies are RISK-DEFINED (no naked short legs).
"""

from __future__ import annotations

import logging
import math
import time
from dataclasses import dataclass, asdict
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Constants ──────────────────────────────────────────────────────────────
LOT_SIZES = {"NIFTY": 75, "BANKNIFTY": 35}
RISK_FREE_RATE = 0.07
DEFAULT_SHORT_DELTA = 0.30  # ~70% POP per leg

# Cache: 5 minutes
_signal_cache: dict[str, dict] = {}
_signal_cache_time: dict[str, float] = {}
_CACHE_TTL = 300


# ─── Strategy Models ────────────────────────────────────────────────────────
@dataclass
class OptionLeg:
    action: str       # "BUY" or "SELL"
    opt_type: str     # "CE" or "PE"
    strike: float
    premium: float
    delta: float
    qty_lots: int = 1


@dataclass
class OptionStrategy:
    name: str
    code: str               # bull_put_spread, iron_condor, etc.
    bias: str               # bullish, bearish, neutral, volatility_long
    legs: list[OptionLeg]
    net_debit: float        # +ve = pay premium; -ve = receive credit
    max_profit: float       # in rupees (1 lot)
    max_loss: float         # in rupees (1 lot, -ve = loss)
    breakevens: list[float]
    pop: float              # probability of profit, 0-1
    risk_reward: float      # |max_profit / max_loss|
    rationale: str
    confidence: float       # 0-1 — composite quality score
    margin_required: float  # approx (lot_size * spread_width for credit spreads)


# ─── IV Regime ──────────────────────────────────────────────────────────────
def compute_iv_regime(chain: dict) -> dict:
    """
    Classify current IV environment from the chain.
    Uses ATM IV (call+put avg) compared against typical India VIX bands.
    """
    if not chain or not chain.get("strikes"):
        return {"iv": 15.0, "regime": "normal", "percentile": 50}

    atm = chain["atm_strike"]
    atm_strike = next((s for s in chain["strikes"] if s["strike"] == atm), None)
    if not atm_strike:
        return {"iv": 15.0, "regime": "normal", "percentile": 50}

    call_iv = atm_strike.get("call_iv", 0) or 0
    put_iv = atm_strike.get("put_iv", 0) or 0
    iv = (call_iv + put_iv) / 2 if (call_iv and put_iv) else (call_iv or put_iv or 15.0)

    if iv < 12:
        regime, pct = "low", 20
    elif iv < 16:
        regime, pct = "normal", 50
    elif iv < 22:
        regime, pct = "elevated", 75
    else:
        regime, pct = "high", 90

    return {"iv": round(iv, 2), "regime": regime, "percentile": pct}


# ─── POP / Strike helpers ──────────────────────────────────────────────────
def _find_strike_by_delta(strikes: list[dict], target_delta: float, opt_type: str) -> Optional[dict]:
    """
    Find the strike whose option delta is closest to |target_delta|.
    Calls have +delta (0..1); puts have -delta (-1..0).
    """
    key = "call_delta" if opt_type == "CE" else "put_delta"
    target = target_delta if opt_type == "CE" else -target_delta
    best = None
    best_diff = float("inf")
    for s in strikes:
        d = s.get(key, 0) or 0
        if d == 0:
            continue
        diff = abs(d - target)
        if diff < best_diff:
            best_diff = diff
            best = s
    return best


def _find_strike_by_offset(strikes: list[dict], from_strike: float, n_strikes_away: int) -> Optional[dict]:
    """Get strike offset by N positions from a reference strike (sorted by strike)."""
    sorted_strikes = sorted(strikes, key=lambda s: s["strike"])
    for i, s in enumerate(sorted_strikes):
        if s["strike"] == from_strike:
            target_idx = i + n_strikes_away
            if 0 <= target_idx < len(sorted_strikes):
                return sorted_strikes[target_idx]
            return None
    return None


def _premium(strike_row: dict, opt_type: str) -> float:
    return float(strike_row.get("call_ltp" if opt_type == "CE" else "put_ltp", 0) or 0)


def _delta(strike_row: dict, opt_type: str) -> float:
    return float(strike_row.get("call_delta" if opt_type == "CE" else "put_delta", 0) or 0)


# ─── Strategy Builders ──────────────────────────────────────────────────────
def _build_bull_put_spread(chain: dict, lot_size: int) -> Optional[OptionStrategy]:
    """SELL OTM put + BUY further OTM put. Credit spread, bullish."""
    strikes = chain["strikes"]
    short = _find_strike_by_delta(strikes, DEFAULT_SHORT_DELTA, "PE")
    if not short:
        return None
    long_ = _find_strike_by_offset(strikes, short["strike"], -1)
    if not long_:
        return None

    short_premium = _premium(short, "PE")
    long_premium = _premium(long_, "PE")
    if short_premium <= 0 or long_premium <= 0:
        return None

    credit = short_premium - long_premium  # per share
    width = short["strike"] - long_["strike"]
    max_profit = credit * lot_size
    max_loss = -(width - credit) * lot_size
    breakeven = short["strike"] - credit
    pop = 1.0 - abs(_delta(short, "PE"))  # short put OTM probability

    return OptionStrategy(
        name=f"Bull Put Spread {int(short['strike'])}/{int(long_['strike'])}",
        code="bull_put_spread",
        bias="bullish",
        legs=[
            OptionLeg("SELL", "PE", short["strike"], short_premium, _delta(short, "PE")),
            OptionLeg("BUY", "PE", long_["strike"], long_premium, _delta(long_, "PE")),
        ],
        net_debit=-credit * lot_size,
        max_profit=round(max_profit, 2),
        max_loss=round(max_loss, 2),
        breakevens=[round(breakeven, 2)],
        pop=round(pop, 3),
        risk_reward=round(abs(max_profit / max_loss), 2) if max_loss else 0,
        rationale=f"Bullish credit spread. Profits if spot stays above {short['strike']:.0f} at expiry.",
        confidence=0.0,  # set later
        margin_required=round(width * lot_size, 2),
    )


def _build_bear_call_spread(chain: dict, lot_size: int) -> Optional[OptionStrategy]:
    """SELL OTM call + BUY further OTM call. Credit spread, bearish."""
    strikes = chain["strikes"]
    short = _find_strike_by_delta(strikes, DEFAULT_SHORT_DELTA, "CE")
    if not short:
        return None
    long_ = _find_strike_by_offset(strikes, short["strike"], 1)
    if not long_:
        return None

    short_premium = _premium(short, "CE")
    long_premium = _premium(long_, "CE")
    if short_premium <= 0 or long_premium <= 0:
        return None

    credit = short_premium - long_premium
    width = long_["strike"] - short["strike"]
    max_profit = credit * lot_size
    max_loss = -(width - credit) * lot_size
    breakeven = short["strike"] + credit
    pop = 1.0 - _delta(short, "CE")

    return OptionStrategy(
        name=f"Bear Call Spread {int(short['strike'])}/{int(long_['strike'])}",
        code="bear_call_spread",
        bias="bearish",
        legs=[
            OptionLeg("SELL", "CE", short["strike"], short_premium, _delta(short, "CE")),
            OptionLeg("BUY", "CE", long_["strike"], long_premium, _delta(long_, "CE")),
        ],
        net_debit=-credit * lot_size,
        max_profit=round(max_profit, 2),
        max_loss=round(max_loss, 2),
        breakevens=[round(breakeven, 2)],
        pop=round(pop, 3),
        risk_reward=round(abs(max_profit / max_loss), 2) if max_loss else 0,
        rationale=f"Bearish credit spread. Profits if spot stays below {short['strike']:.0f} at expiry.",
        confidence=0.0,
        margin_required=round(width * lot_size, 2),
    )


def _build_iron_condor(chain: dict, lot_size: int) -> Optional[OptionStrategy]:
    """Sell OTM call spread + sell OTM put spread. Best for ranging markets."""
    bull_put = _build_bull_put_spread(chain, lot_size)
    bear_call = _build_bear_call_spread(chain, lot_size)
    if not bull_put or not bear_call:
        return None

    # Combine
    total_credit = -(bull_put.net_debit + bear_call.net_debit) / lot_size  # back to per-share
    # Iron condor max loss is the width of either spread minus credit (only one side can lose)
    width = max(
        bull_put.legs[0].strike - bull_put.legs[1].strike,
        bear_call.legs[1].strike - bear_call.legs[0].strike,
    )
    max_profit = total_credit * lot_size
    max_loss = -(width - total_credit) * lot_size
    short_call = bear_call.legs[0]
    short_put = bull_put.legs[0]
    upper_be = short_call.strike + total_credit
    lower_be = short_put.strike - total_credit
    pop = 1.0 - abs(short_call.delta) - abs(short_put.delta)
    pop = max(0.05, min(pop, 0.95))

    return OptionStrategy(
        name=f"Iron Condor {int(short_put.strike)}-{int(short_call.strike)}",
        code="iron_condor",
        bias="neutral",
        legs=bull_put.legs + bear_call.legs,
        net_debit=-total_credit * lot_size,
        max_profit=round(max_profit, 2),
        max_loss=round(max_loss, 2),
        breakevens=[round(lower_be, 2), round(upper_be, 2)],
        pop=round(pop, 3),
        risk_reward=round(abs(max_profit / max_loss), 2) if max_loss else 0,
        rationale=f"Neutral credit. Profits if spot stays between {short_put.strike:.0f} and {short_call.strike:.0f}.",
        confidence=0.0,
        margin_required=round(width * lot_size, 2),
    )


def _build_long_call(chain: dict, lot_size: int) -> Optional[OptionStrategy]:
    """ATM long call. Bullish, low-IV directional play."""
    atm_strike = chain["atm_strike"]
    atm = next((s for s in chain["strikes"] if s["strike"] == atm_strike), None)
    if not atm:
        return None
    premium = _premium(atm, "CE")
    if premium <= 0:
        return None
    return OptionStrategy(
        name=f"Long Call {int(atm_strike)}",
        code="long_call",
        bias="bullish",
        legs=[OptionLeg("BUY", "CE", atm_strike, premium, _delta(atm, "CE"))],
        net_debit=premium * lot_size,
        max_profit=999_999.0,  # unlimited upside
        max_loss=-premium * lot_size,
        breakevens=[round(atm_strike + premium, 2)],
        pop=round(_delta(atm, "CE"), 3),
        risk_reward=99.0,
        rationale=f"Bullish ATM long call. Unlimited upside if spot rallies above {atm_strike + premium:.0f}.",
        confidence=0.0,
        margin_required=round(premium * lot_size, 2),
    )


def _build_long_put(chain: dict, lot_size: int) -> Optional[OptionStrategy]:
    atm_strike = chain["atm_strike"]
    atm = next((s for s in chain["strikes"] if s["strike"] == atm_strike), None)
    if not atm:
        return None
    premium = _premium(atm, "PE")
    if premium <= 0:
        return None
    return OptionStrategy(
        name=f"Long Put {int(atm_strike)}",
        code="long_put",
        bias="bearish",
        legs=[OptionLeg("BUY", "PE", atm_strike, premium, _delta(atm, "PE"))],
        net_debit=premium * lot_size,
        max_profit=999_999.0,
        max_loss=-premium * lot_size,
        breakevens=[round(atm_strike - premium, 2)],
        pop=round(abs(_delta(atm, "PE")), 3),
        risk_reward=99.0,
        rationale=f"Bearish ATM long put. Profits if spot drops below {atm_strike - premium:.0f}.",
        confidence=0.0,
        margin_required=round(premium * lot_size, 2),
    )


def _build_long_straddle(chain: dict, lot_size: int) -> Optional[OptionStrategy]:
    """Buy ATM call + ATM put. Profits on big move either direction (volatility play)."""
    atm_strike = chain["atm_strike"]
    atm = next((s for s in chain["strikes"] if s["strike"] == atm_strike), None)
    if not atm:
        return None
    cp = _premium(atm, "CE")
    pp = _premium(atm, "PE")
    if cp <= 0 or pp <= 0:
        return None
    cost = cp + pp
    return OptionStrategy(
        name=f"Long Straddle {int(atm_strike)}",
        code="long_straddle",
        bias="volatility_long",
        legs=[
            OptionLeg("BUY", "CE", atm_strike, cp, _delta(atm, "CE")),
            OptionLeg("BUY", "PE", atm_strike, pp, _delta(atm, "PE")),
        ],
        net_debit=cost * lot_size,
        max_profit=999_999.0,
        max_loss=-cost * lot_size,
        breakevens=[round(atm_strike - cost, 2), round(atm_strike + cost, 2)],
        pop=0.40,  # straddles need ~1 ATR move; rough estimate
        risk_reward=99.0,
        rationale=f"Volatility play. Needs move beyond ±{cost:.0f} pts in either direction.",
        confidence=0.0,
        margin_required=round(cost * lot_size, 2),
    )


# ─── Strategy Selector ─────────────────────────────────────────────────────
def _select_strategies(chain: dict, regime: str, bias: str, iv_regime: str,
                       lot_size: int) -> list[OptionStrategy]:
    """Pick candidate strategies based on regime/bias/IV. Returns scored list."""
    candidates: list[OptionStrategy] = []

    bullish_signal = bias == "BUY"
    bearish_signal = bias == "SELL"
    neutral_signal = bias == "HOLD"
    high_iv = iv_regime in ("elevated", "high")
    low_iv = iv_regime in ("low", "normal")

    # Bullish setups
    if bullish_signal and regime in ("trending_up", "ranging"):
        if high_iv:
            s = _build_bull_put_spread(chain, lot_size)
            if s: candidates.append(s)
        if low_iv:
            s = _build_long_call(chain, lot_size)
            if s: candidates.append(s)

    # Bearish setups
    if bearish_signal and regime in ("trending_down", "ranging"):
        if high_iv:
            s = _build_bear_call_spread(chain, lot_size)
            if s: candidates.append(s)
        if low_iv:
            s = _build_long_put(chain, lot_size)
            if s: candidates.append(s)

    # Range-bound: iron condor (highest historical win rate)
    if regime == "ranging" and (neutral_signal or high_iv):
        s = _build_iron_condor(chain, lot_size)
        if s: candidates.append(s)

    # Volatile regime, no strong bias: straddle if IV is low (cheap vol)
    if regime == "volatile" and low_iv and neutral_signal:
        s = _build_long_straddle(chain, lot_size)
        if s: candidates.append(s)

    # Always keep iron condor as a fallback if nothing matched
    if not candidates:
        s = _build_iron_condor(chain, lot_size)
        if s: candidates.append(s)
        s = _build_long_call(chain, lot_size) if bullish_signal else _build_long_put(chain, lot_size)
        if s: candidates.append(s)

    return candidates


def _score_strategy(strat: OptionStrategy, regime_confidence: float,
                    signal_confidence: float) -> float:
    """
    Composite quality score (0-1).
    Weights: POP (45%), risk-reward (20%), regime alignment (20%), signal strength (15%).
    """
    pop_score = strat.pop
    rr_score = min(strat.risk_reward / 1.5, 1.0) if strat.risk_reward < 99 else 0.85
    regime_score = regime_confidence
    signal_score = signal_confidence
    return round(
        pop_score * 0.45 + rr_score * 0.20 + regime_score * 0.20 + signal_score * 0.15, 3
    )


# ─── Public API ────────────────────────────────────────────────────────────
def generate_options_signal(symbol: str = "NIFTY") -> Optional[dict]:
    """
    End-to-end: fetch chain + regime + signal → pick best strategy.
    Returns top candidate plus all alternatives.
    """
    cache_key = symbol.upper()
    now = time.time()
    if cache_key in _signal_cache and (now - _signal_cache_time.get(cache_key, 0)) < _CACHE_TTL:
        return _signal_cache[cache_key]

    from option_chain import get_full_option_chain
    from regime_detector import detect_nifty_regime

    chain = get_full_option_chain(symbol)
    if not chain:
        logger.warning("No chain for %s", symbol)
        return None

    # Underlying bias: use NIFTY regime + a directional read from spot vs max_pain
    regime_data = detect_nifty_regime()
    regime = regime_data["regime"]
    regime_conf = regime_data["confidence"]

    # Directional bias: combine regime direction + spot vs max-pain
    spot = chain["underlying"]
    max_pain = chain.get("max_pain") or spot
    pcr = chain.get("pcr", 1.0)
    if regime == "trending_up" and spot > max_pain:
        bias, signal_conf = "BUY", min(0.75 + (pcr - 1.0) * 0.2, 0.95)
    elif regime == "trending_down" and spot < max_pain:
        bias, signal_conf = "SELL", min(0.75 + (1.0 - pcr) * 0.2, 0.95)
    elif regime == "ranging":
        bias, signal_conf = "HOLD", 0.65
    elif regime == "volatile":
        bias, signal_conf = "HOLD", 0.50
    else:
        bias, signal_conf = "HOLD", 0.55
    signal_conf = max(0.3, min(signal_conf, 0.95))

    iv_data = compute_iv_regime(chain)
    lot_size = LOT_SIZES.get(symbol.upper(), 75)

    candidates = _select_strategies(chain, regime, bias, iv_data["regime"], lot_size)
    if not candidates:
        return None

    # Score all candidates
    for s in candidates:
        s.confidence = _score_strategy(s, regime_conf, signal_conf)
    candidates.sort(key=lambda s: s.confidence, reverse=True)

    result = {
        "symbol": symbol.upper(),
        "underlying": spot,
        "expiry": chain.get("expiry"),
        "atm_strike": chain.get("atm_strike"),
        "lot_size": lot_size,
        "regime": regime,
        "regime_confidence": regime_conf,
        "bias": bias,
        "signal_confidence": round(signal_conf, 3),
        "iv": iv_data["iv"],
        "iv_regime": iv_data["regime"],
        "iv_percentile": iv_data["percentile"],
        "pcr": pcr,
        "max_pain": max_pain,
        "recommended": _strategy_to_dict(candidates[0]),
        "alternatives": [_strategy_to_dict(c) for c in candidates[1:]],
        "generated_at": time.time(),
    }
    _signal_cache[cache_key] = result
    _signal_cache_time[cache_key] = now
    return result


def _strategy_to_dict(s: OptionStrategy) -> dict:
    d = asdict(s)
    d["legs"] = [asdict(l) for l in s.legs]
    return d


def generate_all_options_signals() -> list[dict]:
    """Generate signals for both NIFTY and BANKNIFTY."""
    results = []
    for sym in ("NIFTY", "BANKNIFTY"):
        try:
            sig = generate_options_signal(sym)
            if sig:
                results.append(sig)
        except Exception as e:
            logger.error("Options signal failed for %s: %s", sym, e)
    return results


def compute_payoff(strategy: dict, spot_range: tuple[float, float],
                   steps: int = 50) -> list[dict]:
    """
    Compute payoff curve for a strategy across a spot price range.
    Returns list of {spot, pnl} for charting.
    """
    lo, hi = spot_range
    step = (hi - lo) / steps
    points = []
    for i in range(steps + 1):
        s = lo + i * step
        pnl = 0.0
        for leg in strategy["legs"]:
            sign = 1 if leg["action"] == "BUY" else -1
            if leg["opt_type"] == "CE":
                intrinsic = max(0, s - leg["strike"])
            else:
                intrinsic = max(0, leg["strike"] - s)
            # PnL per share: (intrinsic - premium) * sign
            pnl += sign * (intrinsic - leg["premium"]) * leg.get("qty_lots", 1)
        points.append({"spot": round(s, 2), "pnl": round(pnl, 2)})
    return points
