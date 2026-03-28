"""
Netra — Scheduler
APScheduler jobs to fetch data and generate signals after market close.
"""

import logging
from datetime import datetime

import pytz
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from config import TIMEZONE

logger = logging.getLogger(__name__)
IST = pytz.timezone(TIMEZONE)


def _fetch_data_job():
    """Job: Fetch latest data after market close."""
    from data_fetcher import fetch_all_stocks
    logger.info("Scheduler: Fetching latest market data...")
    results = fetch_all_stocks(incremental=True)
    logger.info("Scheduler: Data fetch complete — %s", results)


def _generate_signals_job():
    """Job: Generate fresh signals."""
    from signals import generate_all_signals
    logger.info("Scheduler: Generating signals...")
    signals = generate_all_signals()
    logger.info("Scheduler: Generated %d signals", len(signals))


def _fetch_news_job():
    """Job: Fetch and score news sentiment."""
    from news_sentiment import fetch_and_score_news
    logger.info("Scheduler: Fetching news sentiment...")
    result = fetch_and_score_news()
    logger.info("Scheduler: News sentiment done — scored %d headlines", result.get("scored", 0))


def _fetch_fundamentals_job():
    """Job: Refresh fundamentals data (weekly)."""
    from fundamentals import fetch_all_fundamentals
    logger.info("Scheduler: Fetching fundamentals...")
    fetch_all_fundamentals()
    logger.info("Scheduler: Fundamentals refresh done")


def _fetch_intraday_job():
    """Job: Fetch latest 5m intraday candles."""
    from data_fetcher import fetch_latest_intraday_all
    logger.info("Scheduler: Fetching intraday 5m data...")
    results = fetch_latest_intraday_all()
    logger.info("Scheduler: Intraday fetch complete — %s symbols", len(results))


def _generate_intraday_signals_job():
    """Job: Generate intraday signals from 5m candles."""
    from intraday_signals import generate_all_intraday_signals
    logger.info("Scheduler: Generating intraday signals...")
    signals = generate_all_intraday_signals()
    logger.info("Scheduler: Generated %d intraday signals", len(signals))


def _cleanup_intraday_job():
    """Job: Remove intraday data older than 30 days."""
    from db import cleanup_old_intraday_data
    from config import INTRADAY_DATA_RETENTION_DAYS
    logger.info("Scheduler: Cleaning up old intraday data...")
    cleanup_old_intraday_data(INTRADAY_DATA_RETENTION_DAYS)
    logger.info("Scheduler: Intraday cleanup done")


def _scan_alerts_job():
    """Job: Scan for alert conditions."""
    from alerts import scan_for_alerts
    logger.info("Scheduler: Scanning for alerts...")
    scan_for_alerts()
    logger.info("Scheduler: Alert scan complete")


def _retrain_models_job():
    """Job: Retrain all models (weekly)."""
    from model import train_all_models
    logger.info("Scheduler: Retraining models...")
    results = train_all_models(optimize=False)
    logger.info("Scheduler: Retrained %d models", len(results))


def create_scheduler() -> BackgroundScheduler:
    """
    Create and configure the scheduler with jobs:
    - 3:45 PM IST weekdays: Fetch latest data
    - 3:50 PM IST weekdays: Generate signals
    - Sunday 6:00 AM IST: Retrain models
    """
    scheduler = BackgroundScheduler(timezone=IST)

    # Fetch data at 3:45 PM IST, Monday-Friday
    scheduler.add_job(
        _fetch_data_job,
        CronTrigger(day_of_week="mon-fri", hour=15, minute=45, timezone=IST),
        id="fetch_data",
        name="Fetch market data after close",
        replace_existing=True,
    )

    # Generate signals at 3:50 PM IST, Monday-Friday
    scheduler.add_job(
        _generate_signals_job,
        CronTrigger(day_of_week="mon-fri", hour=15, minute=50, timezone=IST),
        id="generate_signals",
        name="Generate trading signals",
        replace_existing=True,
    )

    # Fetch news sentiment every 30 minutes during market hours (8:30 AM - 4 PM)
    scheduler.add_job(
        _fetch_news_job,
        CronTrigger(day_of_week="mon-fri", hour="8-15", minute="0,30", timezone=IST),
        id="fetch_news",
        name="Fetch and score news sentiment",
        replace_existing=True,
    )

    # Pre-market news at 8:30 AM IST
    scheduler.add_job(
        _fetch_news_job,
        CronTrigger(day_of_week="mon-fri", hour=8, minute=30, timezone=IST),
        id="premarket_news",
        name="Pre-market news fetch",
        replace_existing=True,
    )

    # Refresh fundamentals every Saturday at 7 AM IST (weekly, slow-moving data)
    scheduler.add_job(
        _fetch_fundamentals_job,
        CronTrigger(day_of_week="sat", hour=7, minute=0, timezone=IST),
        id="fetch_fundamentals",
        name="Weekly fundamentals refresh",
        replace_existing=True,
    )

    # Retrain models every Sunday at 6 AM IST
    scheduler.add_job(
        _retrain_models_job,
        CronTrigger(day_of_week="sun", hour=6, minute=0, timezone=IST),
        id="retrain_models",
        name="Weekly model retraining",
        replace_existing=True,
    )

    # ─── Intraday Jobs ──────────────────────────────────────────────────────

    # Fetch 5m intraday candles every 5 min during market hours
    scheduler.add_job(
        _fetch_intraday_job,
        CronTrigger(day_of_week="mon-fri", hour="9-15", minute="*/5", timezone=IST),
        id="fetch_intraday",
        name="Fetch 5m intraday candles",
        replace_existing=True,
    )

    # Generate intraday signals offset by 1 min (at :01, :06, :11, etc.)
    scheduler.add_job(
        _generate_intraday_signals_job,
        CronTrigger(day_of_week="mon-fri", hour="9-15", minute="1,6,11,16,21,26,31,36,41,46,51,56", timezone=IST),
        id="generate_intraday_signals",
        name="Generate intraday signals",
        replace_existing=True,
    )

    # Cleanup old intraday data every Sunday at 5 AM
    scheduler.add_job(
        _cleanup_intraday_job,
        CronTrigger(day_of_week="sun", hour=5, minute=0, timezone=IST),
        id="cleanup_intraday",
        name="Cleanup old intraday data",
        replace_existing=True,
    )

    # ─── Alert Scanning ────────────────────────────────────────────────────
    # Scan for alerts every 5 minutes during market hours
    scheduler.add_job(
        _scan_alerts_job,
        CronTrigger(day_of_week="mon-fri", hour="9-15", minute="*/5", timezone=IST),
        id="scan_alerts",
        name="Scan for alert conditions",
        replace_existing=True,
    )

    # Also scan after signal generation (at 3:55 PM)
    scheduler.add_job(
        _scan_alerts_job,
        CronTrigger(day_of_week="mon-fri", hour=15, minute=55, timezone=IST),
        id="scan_alerts_post_signal",
        name="Post-signal alert scan",
        replace_existing=True,
    )

    logger.info("Scheduler configured with 11 jobs")
    return scheduler
