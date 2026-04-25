"""
Netra — Market Story Composer
Stitches together macro, FII/DII, regime, sectors, breadth, anomalies, and signals
into a structured narrative with plain-English meaning attached to every data point.

Each data point carries: { label, value, tone, meaning }
Tone: "positive" | "negative" | "neutral" | "warning"
"""

import logging
import time
from datetime import datetime
from typing import Optional

import pytz

from config import TIMEZONE

logger = logging.getLogger(__name__)
IST = pytz.timezone(TIMEZONE)

_story_cache: Optional[dict] = None
_story_cache_time: float = 0
_STORY_TTL = 600  # 10 min


# ─── Plain-English meaning helpers ─────────────────────────────────────

def _vix_meaning(vix: float) -> tuple[str, str]:
    if vix < 12:
        return "warning", "Complacent zone — sudden moves possible. Time to be cautious."
    if vix < 16:
        return "positive", "Calm market. Trends tend to persist."
    if vix < 22:
        return "neutral", "Normal volatility. Stay alert."
    return "negative", "Stress mode. Expect wide swings — reduce position size."


def _pcr_meaning(pcr: float) -> tuple[str, str]:
    if pcr > 1.3:
        return "positive", "Heavy put buying — but extreme readings often mark bottoms (contrarian bullish)."
    if pcr > 1.0:
        return "neutral", "More puts than calls — defensive mood."
    if pcr > 0.7:
        return "neutral", "Balanced positioning."
    return "warning", "Call-heavy — markets feel euphoric. Watch for reversals."


def _fii_meaning(fii_5d: float) -> tuple[str, str]:
    if fii_5d > 5000:
        return "positive", f"Foreign money flowing in (₹{fii_5d:,.0f} Cr in 5 days). Strong tailwind."
    if fii_5d > 0:
        return "positive", f"Net foreign buying (₹{fii_5d:,.0f} Cr). Mildly supportive."
    if fii_5d > -5000:
        return "neutral", f"Mild foreign selling (₹{fii_5d:,.0f} Cr). Watch for trend."
    return "negative", f"Heavy foreign outflow (₹{fii_5d:,.0f} Cr). Pressure on indices."


def _dii_meaning(dii_5d: float) -> tuple[str, str]:
    if dii_5d > 0:
        return "positive", f"Domestic institutions absorbing supply (₹{dii_5d:,.0f} Cr). Floor under market."
    return "warning", f"Domestic selling too (₹{dii_5d:,.0f} Cr). No buffer for FII outflows."


def _macro_meaning(score: float, label: str) -> tuple[str, str]:
    if score > 0.65:
        return "positive", "Global setup is supportive — US markets, commodities, currency aligned."
    if score > 0.5:
        return "neutral", "Mixed global cues — some tailwinds, some headwinds."
    if score > 0.35:
        return "warning", "Global headwinds building — be selective."
    return "negative", "Hostile global backdrop — defensive mode warranted."


def _breadth_meaning(bullish: int, bearish: int, total: int) -> tuple[str, str]:
    if total == 0:
        return "neutral", "—"
    bull_pct = bullish / total * 100
    if bull_pct > 60:
        return "positive", f"{bull_pct:.0f}% of NIFTY 50 stocks bullish — broad participation."
    if bull_pct > 40:
        return "neutral", f"{bull_pct:.0f}% bullish — mixed market."
    if bull_pct > 25:
        return "warning", f"Only {bull_pct:.0f}% bullish — narrow rally if any."
    return "negative", f"Just {bull_pct:.0f}% bullish — broad weakness."


def _regime_meaning(regime: str) -> tuple[str, str]:
    return {
        "trending_up":   ("positive", "Uptrend confirmed — pullbacks are buying opportunities."),
        "trending_down": ("negative", "Downtrend in force — rallies are selling opportunities."),
        "volatile":      ("warning",  "Choppy regime — reduce size, widen stops, prefer credit spreads."),
        "ranging":       ("neutral",  "Range-bound — fade extremes, avoid breakout chasing."),
    }.get(regime, ("neutral", "Regime unclear."))


# ─── Section builders ───────────────────────────────────────────────────

def _overnight_section() -> dict:
    """What happened globally while India was sleeping."""
    points = []
    headline_bits = []

    try:
        from macro_signals import get_macro_overview
        macro = get_macro_overview()
        ind = macro.get("indicators", {}) or {}

        # Pick the most-watched indicators
        keys_to_show = ["sp500", "nasdaq", "dow", "crude", "gold", "usdinr"]
        nice_names = {
            "sp500": "S&P 500", "nasdaq": "NASDAQ", "dow": "Dow Jones",
            "crude": "Crude Oil", "gold": "Gold", "usdinr": "USD/INR"
        }

        for k in keys_to_show:
            v = ind.get(k)
            if not v:
                continue
            chg = v.get("change_pct", 0)
            tone = "positive" if chg > 0.3 else "negative" if chg < -0.3 else "neutral"
            # USD/INR inverts: stronger dollar = bad for India
            if k == "usdinr":
                tone = "negative" if chg > 0.2 else "positive" if chg < -0.2 else "neutral"
            points.append({
                "label": nice_names.get(k, v.get("name", k)),
                "value": f"{v.get('price', 0):,.2f}",
                "delta": f"{chg:+.2f}%",
                "tone": tone,
                "meaning": None,
            })

        score = macro.get("score", 0.5)
        m_tone, m_text = _macro_meaning(score, macro.get("label", ""))
        narrative = m_text
        headline_bits.append(macro.get("label", "Mixed"))
    except Exception as e:
        logger.debug("overnight section: %s", e)
        narrative = "Global data unavailable."
        m_tone = "neutral"

    return {
        "id": "overnight",
        "title": "Overnight Setup",
        "icon": "🌅",
        "narrative": narrative,
        "tone": m_tone,
        "data_points": points,
    }


def _flows_section() -> dict:
    """FII/DII institutional flows — who's buying, who's selling."""
    points = []
    narrative = "Flow data unavailable."
    tone = "neutral"

    try:
        from fii_dii import get_fii_dii_flows
        data = get_fii_dii_flows()
        s = data.get("summary", {})

        fii_5d = s.get("fii_net_5d", 0)
        dii_5d = s.get("dii_net_5d", 0)
        fii_latest = s.get("fii_latest", 0)
        dii_latest = s.get("dii_latest", 0)

        fii_tone, fii_text = _fii_meaning(fii_5d)
        dii_tone, dii_text = _dii_meaning(dii_5d)

        points.append({
            "label": "FII (latest)",
            "value": f"₹{fii_latest:+,.0f} Cr",
            "delta": None,
            "tone": "positive" if fii_latest > 0 else "negative",
            "meaning": None,
        })
        points.append({
            "label": "DII (latest)",
            "value": f"₹{dii_latest:+,.0f} Cr",
            "delta": None,
            "tone": "positive" if dii_latest > 0 else "warning",
            "meaning": None,
        })
        points.append({
            "label": "FII 5-day net",
            "value": f"₹{fii_5d:+,.0f} Cr",
            "delta": None,
            "tone": fii_tone,
            "meaning": None,
        })
        points.append({
            "label": "DII 5-day net",
            "value": f"₹{dii_5d:+,.0f} Cr",
            "delta": None,
            "tone": dii_tone,
            "meaning": None,
        })

        # Net flow story
        net = fii_5d + dii_5d
        if net > 0:
            tone = "positive"
            narrative = f"Net institutional buying of ₹{net:,.0f} Cr over 5 days. {fii_text}"
        else:
            tone = "negative" if net < -3000 else "warning"
            narrative = f"Net institutional selling of ₹{abs(net):,.0f} Cr over 5 days. {fii_text}"

    except Exception as e:
        logger.debug("flows section: %s", e)

    return {
        "id": "flows",
        "title": "Institutional Flows",
        "icon": "💰",
        "narrative": narrative,
        "tone": tone,
        "data_points": points,
    }


def _mood_section() -> dict:
    """Regime, VIX, PCR, breadth — the market's pulse."""
    points = []
    narrative_bits = []
    overall_tone = "neutral"

    # Regime
    try:
        from regime_detector import detect_regime
        r = detect_regime()
        reg = r.get("regime", "ranging")
        conf = r.get("confidence", 0)
        r_tone, r_text = _regime_meaning(reg)
        points.append({
            "label": "Regime",
            "value": reg.replace("_", " ").title(),
            "delta": f"{conf:.0%} conf",
            "tone": r_tone,
            "meaning": r_text,
        })
        narrative_bits.append(r_text)
        overall_tone = r_tone
    except Exception as e:
        logger.debug("regime: %s", e)

    # VIX + PCR from option chain / sentiment
    try:
        from option_chain import get_market_sentiment, _fetch_vix_value
        sent = get_market_sentiment() or {}
        pcr = sent.get("pcr")
        vix = sent.get("vix") or _fetch_vix_value()
        if vix:
            v_tone, v_text = _vix_meaning(vix)
            points.append({
                "label": "India VIX",
                "value": f"{vix:.2f}",
                "delta": None,
                "tone": v_tone,
                "meaning": v_text,
            })
        if pcr:
            p_tone, p_text = _pcr_meaning(pcr)
            points.append({
                "label": "Put/Call Ratio",
                "value": f"{pcr:.2f}",
                "delta": None,
                "tone": p_tone,
                "meaning": p_text,
            })
    except Exception as e:
        logger.debug("vix/pcr: %s", e)

    # Breadth
    try:
        import db
        sigs = db.get_latest_signals() or []
        bull = sum(1 for s in sigs if s.get("signal") == "BUY")
        bear = sum(1 for s in sigs if s.get("signal") == "SELL")
        total = len(sigs)
        if total:
            b_tone, b_text = _breadth_meaning(bull, bear, total)
            points.append({
                "label": "Market Breadth",
                "value": f"{bull}/{total} bullish",
                "delta": None,
                "tone": b_tone,
                "meaning": b_text,
            })
            narrative_bits.append(b_text)
    except Exception as e:
        logger.debug("breadth: %s", e)

    return {
        "id": "mood",
        "title": "Market Mood",
        "icon": "🌡️",
        "narrative": " ".join(narrative_bits) or "Mood data assembling…",
        "tone": overall_tone,
        "data_points": points,
    }


def _sectors_section() -> dict:
    """What's leading and what's lagging."""
    points = []
    narrative = "Sector data unavailable."
    tone = "neutral"

    try:
        from sector_rotation import get_cached_sector_scores
        sectors = get_cached_sector_scores() or {}
        if sectors:
            sorted_s = sorted(sectors.items(),
                              key=lambda x: x[1].get("momentum_score", 0),
                              reverse=True)
            top3 = sorted_s[:3]
            bot3 = sorted_s[-3:]

            for name, info in top3:
                points.append({
                    "label": f"🟢 {name}",
                    "value": f"{info.get('momentum_score', 0):+.1f}",
                    "delta": None,
                    "tone": "positive",
                    "meaning": None,
                })
            for name, info in bot3:
                points.append({
                    "label": f"🔴 {name}",
                    "value": f"{info.get('momentum_score', 0):+.1f}",
                    "delta": None,
                    "tone": "negative",
                    "meaning": None,
                })

            top_names = ", ".join(n for n, _ in top3)
            bot_names = ", ".join(n for n, _ in bot3)
            narrative = (
                f"Money rotating into {top_names}. Avoid weakness in {bot_names}. "
                "Trade with the rotation, not against it."
            )
            tone = "positive"
    except Exception as e:
        logger.debug("sectors: %s", e)

    return {
        "id": "sectors",
        "title": "Sector Rotation",
        "icon": "🔄",
        "narrative": narrative,
        "tone": tone,
        "data_points": points,
    }


def _unusual_section() -> dict:
    """What's moving in unusual ways today."""
    points = []
    narrative = "Nothing unusual right now."
    tone = "neutral"

    try:
        from anomaly_detector import scan_anomalies
        result = scan_anomalies()
        anomalies = result.get("anomalies", []) if isinstance(result, dict) else result
        anomalies = anomalies[:5]  # Top 5

        if anomalies:
            for a in anomalies:
                sym = (a.get("symbol", "") or "").replace(".NS", "")
                a_type = a.get("type", "anomaly").replace("_", " ")
                desc = a.get("description") or a.get("message") or a_type
                sev = a.get("severity", 1)
                t = "warning" if sev >= 2 else "neutral"
                points.append({
                    "label": sym,
                    "value": a_type.title(),
                    "delta": None,
                    "tone": t,
                    "meaning": desc,
                })
            top_syms = ", ".join((a.get("symbol", "") or "").replace(".NS", "") for a in anomalies[:3])
            narrative = f"Unusual activity in {top_syms}. Worth a closer look — these often lead the day."
            tone = "warning"
    except Exception as e:
        logger.debug("anomalies: %s", e)

    return {
        "id": "unusual",
        "title": "Unusual Activity",
        "icon": "⚡",
        "narrative": narrative,
        "tone": tone,
        "data_points": points,
    }


def _watch_section() -> dict:
    """Top conviction picks for today — with WHY."""
    points = []
    narrative = "No high-conviction setups right now."
    tone = "neutral"

    try:
        import db
        sigs = db.get_latest_signals() or []
        # Sort by confidence
        ranked = sorted(
            [s for s in sigs if s.get("signal") in ("BUY", "SELL")],
            key=lambda x: x.get("confidence", 0),
            reverse=True,
        )[:3]

        for s in ranked:
            sym = (s.get("symbol", "") or "").replace(".NS", "")
            sig = s.get("signal", "HOLD")
            conf = s.get("confidence", 0)
            entry = s.get("entry_price")
            tgt = s.get("target_price")
            sl = s.get("stop_loss")

            why_bits = []
            if entry and tgt:
                rr = abs((tgt - entry) / (entry - sl)) if sl and entry != sl else None
                if rr:
                    why_bits.append(f"R:R 1:{rr:.1f}")
            why_bits.append(f"{conf:.0f}% confidence")

            t = "positive" if sig == "BUY" else "negative"
            value_str = f"{sig} @ ₹{entry:,.0f}" if entry else sig

            points.append({
                "label": sym,
                "value": value_str,
                "delta": f"T ₹{tgt:,.0f} · SL ₹{sl:,.0f}" if tgt and sl else None,
                "tone": t,
                "meaning": " · ".join(why_bits),
            })

        if ranked:
            names = ", ".join((s.get("symbol", "") or "").replace(".NS", "") for s in ranked)
            narrative = f"Today's high-conviction list: {names}. Position size matters more than picking — risk 1% per trade."
            tone = "positive"
    except Exception as e:
        logger.debug("watch: %s", e)

    return {
        "id": "watch",
        "title": "What to Watch Today",
        "icon": "🎯",
        "narrative": narrative,
        "tone": tone,
        "data_points": points,
    }


# ─── Main composer ─────────────────────────────────────────────────────

def _compose_headline(sections: list[dict]) -> tuple[str, str]:
    """Generate a one-line market headline from section tones."""
    tones = [s.get("tone", "neutral") for s in sections]
    pos = tones.count("positive")
    neg = tones.count("negative")
    warn = tones.count("warning")

    if pos >= 3 and neg <= 1:
        return ("Tailwinds across the board — buyers in control", "positive")
    if neg >= 3:
        return ("Pressure mounting — defensive positioning warranted", "negative")
    if warn >= 2:
        return ("Mixed signals with caution flags — pick your spots", "warning")
    if pos > neg:
        return ("Cautiously constructive — selective opportunities", "positive")
    if neg > pos:
        return ("Headwinds building — patience required", "warning")
    return ("Range-bound day — let setups come to you", "neutral")


def get_market_story(force_refresh: bool = False) -> dict:
    """Build the structured market story. Cached 10 min."""
    global _story_cache, _story_cache_time

    now = time.time()
    if not force_refresh and _story_cache and (now - _story_cache_time) < _STORY_TTL:
        return _story_cache

    sections = [
        _overnight_section(),
        _mood_section(),
        _flows_section(),
        _sectors_section(),
        _unusual_section(),
        _watch_section(),
    ]

    headline, mood = _compose_headline(sections)

    result = {
        "headline": headline,
        "mood": mood,
        "generated_at": datetime.now(IST).strftime("%Y-%m-%d %H:%M IST"),
        "sections": sections,
    }

    _story_cache = result
    _story_cache_time = now
    return result
