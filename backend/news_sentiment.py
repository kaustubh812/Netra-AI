"""
Netra — News Sentiment Engine
Fetches Indian market news headlines via RSS feeds, matches them to NIFTY 50 stocks,
and scores sentiment using OpenAI GPT-5.4-mini.
"""

import logging
import time
import re
from datetime import datetime, timedelta
from typing import Optional

import feedparser
from openai import OpenAI

import db
from config import (
    OPENAI_API_KEY,
    OPENAI_MODEL,
    NEWS_RSS_FEEDS,
    NEWS_CACHE_TTL,
    NEWS_MAX_HEADLINES_PER_STOCK,
    NIFTY_50_STOCKS,
    STOCK_NAME_MAP,
)

logger = logging.getLogger(__name__)

# ─── Cache ────────────────────────────────────────────────────────────────────
_news_cache: dict = {}
_news_cache_time: float = 0

# ─── OpenAI Client ────────────────────────────────────────────────────────────
_client: Optional[OpenAI] = None


def _get_client() -> Optional[OpenAI]:
    """Lazy-init OpenAI client."""
    global _client
    if _client is None and OPENAI_API_KEY:
        _client = OpenAI(api_key=OPENAI_API_KEY)
    return _client


# ─── RSS Feed Fetching ────────────────────────────────────────────────────────

def _fetch_all_headlines() -> list[dict]:
    """Fetch headlines from all configured RSS feeds."""
    all_headlines = []
    for feed_cfg in NEWS_RSS_FEEDS:
        try:
            feed = feedparser.parse(feed_cfg["url"])
            for entry in feed.entries[:30]:  # Max 30 per feed
                headline = entry.get("title", "").strip()
                link = entry.get("link", "")
                published = entry.get("published", "")

                if headline:
                    all_headlines.append({
                        "headline": headline,
                        "source": feed_cfg["name"],
                        "url": link,
                        "published": published,
                    })
        except Exception as e:
            logger.warning("Failed to fetch RSS feed %s: %s", feed_cfg["name"], e)

    logger.info("Fetched %d total headlines from %d feeds", len(all_headlines), len(NEWS_RSS_FEEDS))
    return all_headlines


# ─── Stock Matching ───────────────────────────────────────────────────────────

def _match_headlines_to_stocks(headlines: list[dict]) -> dict[str, list[dict]]:
    """
    Match headlines to NIFTY 50 stocks using keyword matching.
    Returns {symbol: [matched_headlines]}.
    """
    matched: dict[str, list[dict]] = {}

    for symbol in NIFTY_50_STOCKS:
        keywords = STOCK_NAME_MAP.get(symbol, [])
        # Also add the clean symbol name
        clean_name = symbol.replace(".NS", "").lower()
        keywords = [clean_name] + keywords

        symbol_matches = []
        for h in headlines:
            headline_lower = h["headline"].lower()
            if any(kw in headline_lower for kw in keywords):
                symbol_matches.append(h)

        if symbol_matches:
            matched[symbol] = symbol_matches[:NEWS_MAX_HEADLINES_PER_STOCK]

    # Also collect general market headlines (nifty, sensex, market, rbi, etc.)
    market_keywords = ["nifty", "sensex", "market", "rbi", "reserve bank", "fii", "dii",
                       "bull", "bear", "rally", "crash", "correction", "inflation",
                       "gdp", "interest rate", "repo rate", "budget"]
    market_headlines = []
    for h in headlines:
        headline_lower = h["headline"].lower()
        if any(kw in headline_lower for kw in market_keywords):
            market_headlines.append(h)
    if market_headlines:
        matched["MARKET"] = market_headlines[:20]

    return matched


# ─── OpenAI Sentiment Scoring ─────────────────────────────────────────────────

def _score_headline(headline: str, stock_name: str) -> Optional[dict]:
    """
    Score a single headline using GPT-5.4-mini.
    Returns {"score": float (-1 to 1), "reasoning": str} or None on failure.
    """
    client = _get_client()
    if not client:
        return None

    prompt = f"""You are a financial sentiment analyzer for the Indian stock market (NSE).

Analyze this news headline and score its impact on {stock_name} stock.

Headline: "{headline}"

Respond in EXACTLY this JSON format, nothing else:
{{"score": <float from -1.0 to 1.0>, "reasoning": "<one sentence explanation>"}}

Scoring guide:
- -1.0 = Very bearish (major negative event, scandal, loss, downgrade)
- -0.5 = Moderately bearish (minor negative, sector weakness)
- 0.0 = Neutral (no clear impact)
- +0.5 = Moderately bullish (positive results, upgrade, expansion)
- +1.0 = Very bullish (exceptional results, major deal, breakout)"""

    try:
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_completion_tokens=100,
        )
        text = response.choices[0].message.content.strip()

        # Parse JSON response
        import json
        # Handle potential markdown code blocks
        text = text.strip("`").strip()
        if text.startswith("json"):
            text = text[4:].strip()
        result = json.loads(text)

        score = float(result.get("score", 0))
        score = max(-1.0, min(1.0, score))  # Clamp
        reasoning = result.get("reasoning", "")

        return {"score": score, "reasoning": reasoning}

    except Exception as e:
        logger.warning("OpenAI scoring failed for headline '%s...': %s", headline[:50], e)
        return None


def _score_headlines_batch(headlines: list[dict], stock_name: str) -> list[dict]:
    """Score multiple headlines for a stock. Adds score/reasoning to each headline dict."""
    scored = []
    for h in headlines:
        result = _score_headline(h["headline"], stock_name)
        if result:
            h["sentiment_score"] = result["score"]
            h["reasoning"] = result["reasoning"]
            scored.append(h)
        else:
            # Default to neutral if scoring fails
            h["sentiment_score"] = 0.0
            h["reasoning"] = "Scoring unavailable"
            scored.append(h)
    return scored


# ─── Main Pipeline ────────────────────────────────────────────────────────────

def fetch_and_score_news() -> dict:
    """
    Main pipeline: fetch headlines → match to stocks → score with AI → save to DB.
    Returns summary dict.
    """
    global _news_cache, _news_cache_time

    now = time.time()
    if _news_cache and (now - _news_cache_time) < NEWS_CACHE_TTL:
        logger.debug("News sentiment cache hit")
        return _news_cache

    client = _get_client()
    if not client:
        logger.warning("OpenAI API key not configured — skipping news sentiment")
        return {"status": "no_api_key", "scored": 0}

    # Step 1: Fetch all headlines
    headlines = _fetch_all_headlines()
    if not headlines:
        return {"status": "no_headlines", "scored": 0}

    # Step 2: Match to stocks
    matched = _match_headlines_to_stocks(headlines)
    logger.info("Matched headlines to %d stocks", len(matched))

    # Step 3: Score each stock's headlines
    total_scored = 0
    summary = {}

    for symbol, stock_headlines in matched.items():
        stock_name = symbol.replace(".NS", "") if symbol != "MARKET" else "Indian stock market"
        scored = _score_headlines_batch(stock_headlines, stock_name)

        # Save to DB
        for h in scored:
            db.save_news_sentiment(
                symbol=symbol,
                headline=h["headline"],
                source=h["source"],
                url=h.get("url", ""),
                score=h["sentiment_score"],
                reasoning=h.get("reasoning", ""),
            )
            total_scored += 1

        # Compute aggregate for this stock
        scores = [h["sentiment_score"] for h in scored]
        avg_score = sum(scores) / len(scores) if scores else 0
        summary[symbol] = {
            "count": len(scored),
            "avg_sentiment": round(avg_score, 4),
            "headlines": scored,
        }

    result = {
        "status": "ok",
        "scored": total_scored,
        "stocks_with_news": len(matched),
        "summary": summary,
        "timestamp": datetime.now().isoformat(),
    }

    _news_cache = result
    _news_cache_time = now
    logger.info("News sentiment scored: %d headlines across %d stocks", total_scored, len(matched))
    return result


def get_stock_sentiment_score(symbol: str) -> float:
    """
    Get the current sentiment score for a stock (0-1 scale for composite signal).
    Maps from -1..+1 (raw sentiment) to 0..1 (composite scale).
    Returns 0.5 (neutral) if no data available.
    """
    raw_score = db.get_aggregate_sentiment(symbol, hours=24)
    if raw_score is None:
        return 0.5  # Neutral fallback

    # Map -1..+1 → 0..1
    return round((raw_score + 1.0) / 2.0, 4)


def get_stock_news(symbol: str, hours: int = 24) -> dict:
    """Get recent news + sentiment for a specific stock (for API response)."""
    news = db.get_latest_sentiment(symbol, hours=hours)
    agg = db.get_aggregate_sentiment(symbol, hours=hours)

    sentiment_label = "Neutral"
    if agg is not None:
        if agg > 0.3:
            sentiment_label = "Bullish"
        elif agg > 0.1:
            sentiment_label = "Slightly Bullish"
        elif agg < -0.3:
            sentiment_label = "Bearish"
        elif agg < -0.1:
            sentiment_label = "Slightly Bearish"

    return {
        "symbol": symbol,
        "name": symbol.replace(".NS", ""),
        "news": news,
        "count": len(news),
        "aggregate_sentiment": agg,
        "sentiment_label": sentiment_label,
    }


def get_market_news() -> dict:
    """Get overall market news sentiment (for API response)."""
    news = db.get_market_news_sentiment(hours=24)

    # Compute overall market sentiment
    scores = [n["sentiment_score"] for n in news if n.get("sentiment_score") is not None]
    avg = sum(scores) / len(scores) if scores else 0

    sentiment_label = "Neutral"
    if avg > 0.3:
        sentiment_label = "Bullish"
    elif avg > 0.1:
        sentiment_label = "Slightly Bullish"
    elif avg < -0.3:
        sentiment_label = "Bearish"
    elif avg < -0.1:
        sentiment_label = "Slightly Bearish"

    return {
        "news": news,
        "count": len(news),
        "aggregate_sentiment": round(avg, 4) if scores else None,
        "sentiment_label": sentiment_label,
    }
