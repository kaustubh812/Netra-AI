"""
Netra — AI Market Daily Brief
Generates pre-market and post-market natural language summaries
using GPT-5.4-mini from existing Netra data (signals, regime, sectors, macro, news).
"""

import logging
import time
from datetime import datetime, timezone
from typing import Optional

from openai import OpenAI

from config import OPENAI_API_KEY, OPENAI_MODEL

logger = logging.getLogger(__name__)

client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

# Cache for 30 minutes
_brief_cache: Optional[dict] = None
_brief_cache_time: float = 0
_BRIEF_CACHE_TTL = 1800


def _gather_market_context() -> str:
    """Collect current market state from all Netra engines into a context string."""
    sections = []

    # 1. Market overview (Nifty, BankNifty)
    try:
        from live_prices import get_live_prices, is_market_open
        market_open = is_market_open()
        sections.append(f"Market Status: {'OPEN' if market_open else 'CLOSED'}")
    except Exception:
        market_open = False

    # 2. Regime
    try:
        from regime_detector import detect_regime
        regime = detect_regime()
        sections.append(f"Market Regime: {regime.get('regime', 'unknown')} (confidence: {regime.get('confidence', 0):.0%})")
    except Exception as e:
        logger.debug("Regime unavailable: %s", e)

    # 3. Latest signals summary
    try:
        import db
        signals = db.get_latest_signals()
        if signals:
            buys = [s for s in signals if s.get("signal") == "BUY"]
            sells = [s for s in signals if s.get("signal") == "SELL"]
            holds = [s for s in signals if s.get("signal") == "HOLD"]
            sections.append(f"Signals: {len(buys)} BUY, {len(sells)} SELL, {len(holds)} HOLD out of {len(signals)} stocks")
            if buys:
                top_buys = sorted(buys, key=lambda x: x.get("confidence", 0), reverse=True)[:3]
                buy_names = [f"{s.get('name', s.get('symbol', '?'))} ({s.get('confidence', 0):.0f}%)" for s in top_buys]
                sections.append(f"Top BUY signals: {', '.join(buy_names)}")
            if sells:
                top_sells = sorted(sells, key=lambda x: x.get("confidence", 0), reverse=True)[:3]
                sell_names = [f"{s.get('name', s.get('symbol', '?'))} ({s.get('confidence', 0):.0f}%)" for s in top_sells]
                sections.append(f"Top SELL signals: {', '.join(sell_names)}")
    except Exception as e:
        logger.debug("Signals unavailable: %s", e)

    # 4. Sector rotation
    try:
        from sector_rotation import get_cached_sector_scores
        sectors = get_cached_sector_scores()
        if sectors:
            sorted_sectors = sorted(sectors.items(), key=lambda x: x[1].get("momentum_score", 0), reverse=True)
            top_3 = [(k, v.get("momentum_score", 0)) for k, v in sorted_sectors[:3]]
            bottom_3 = [(k, v.get("momentum_score", 0)) for k, v in sorted_sectors[-3:]]
            sections.append(f"Top sectors: {', '.join(f'{k} ({v:.1f})' for k, v in top_3)}")
            sections.append(f"Weak sectors: {', '.join(f'{k} ({v:.1f})' for k, v in bottom_3)}")
    except Exception as e:
        logger.debug("Sectors unavailable: %s", e)

    # 5. Macro indicators
    try:
        from macro_signals import get_macro_overview
        macro = get_macro_overview()
        if macro and macro.get("indicators"):
            macro_lines = []
            for key, ind in macro["indicators"].items():
                if ind:
                    macro_lines.append(f"{ind.get('name', key)}: {ind.get('price', 0):.2f} ({ind.get('change_pct', 0):+.2f}%)")
            if macro_lines:
                sections.append(f"Macro: {'; '.join(macro_lines)}")
            sections.append(f"Macro score: {macro.get('score', 0):.2f} ({macro.get('label', 'unknown')})")
    except Exception as e:
        logger.debug("Macro unavailable: %s", e)

    # 6. News sentiment
    try:
        from news_sentiment import get_market_news_overview
        news = get_market_news_overview()
        if news:
            sections.append(f"Market news sentiment: {news.get('sentiment_label', 'neutral')} (score: {news.get('aggregate_sentiment', 0)})")
            headlines = news.get("news", [])[:5]
            if headlines:
                hl_text = "; ".join(h.get("headline", "")[:80] for h in headlines)
                sections.append(f"Key headlines: {hl_text}")
    except Exception as e:
        logger.debug("News unavailable: %s", e)

    # 7. FII/DII
    try:
        from fii_dii import get_fii_dii_data
        fii = get_fii_dii_data()
        if fii and fii.get("summary"):
            s = fii["summary"]
            sections.append(f"FII net (latest): Rs {s.get('fii_latest', 0):.0f} Cr, DII net: Rs {s.get('dii_latest', 0):.0f} Cr")
            sections.append(f"FII streak: {s.get('fii_streak', 0)} days {s.get('fii_streak_direction', '')}")
    except Exception as e:
        logger.debug("FII/DII unavailable: %s", e)

    return "\n".join(sections) if sections else "No market data available."


def generate_daily_brief() -> dict:
    """Generate AI market brief using current market context."""
    global _brief_cache, _brief_cache_time

    now = time.time()
    if _brief_cache and (now - _brief_cache_time) < _BRIEF_CACHE_TTL:
        return _brief_cache

    if not client:
        return {
            "brief": "AI brief unavailable — OpenAI API key not configured.",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "available": False,
        }

    context = _gather_market_context()

    prompt = f"""You are Netra AI, an Indian stock market intelligence system. Generate a concise market brief (150-250 words) based on the following real-time data.

MARKET DATA:
{context}

INSTRUCTIONS:
- Write in a professional, confident analyst tone
- Start with overall market sentiment (1 sentence)
- Cover: key index moves, regime implications, top signal picks, sector momentum, global macro impact, FII/DII activity
- Use specific numbers and stock names from the data
- End with 1-2 key things to watch
- Use INR (Rs) for Indian values
- Do NOT use markdown headers or bullet points — write flowing paragraphs
- Keep it actionable and insightful"""

    try:
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_completion_tokens=500,
        )
        brief_text = response.choices[0].message.content.strip()
    except Exception as e:
        logger.error("Failed to generate daily brief: %s", e)
        brief_text = "Brief generation failed. Please try again later."

    result = {
        "brief": brief_text,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "available": True,
        "context_summary": {
            "data_points": len(context.split("\n")),
        },
    }

    _brief_cache = result
    _brief_cache_time = time.time()
    return result
