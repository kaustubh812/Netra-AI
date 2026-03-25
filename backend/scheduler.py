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

    # Retrain models every Sunday at 6 AM IST
    scheduler.add_job(
        _retrain_models_job,
        CronTrigger(day_of_week="sun", hour=6, minute=0, timezone=IST),
        id="retrain_models",
        name="Weekly model retraining",
        replace_existing=True,
    )

    logger.info("Scheduler configured with 3 jobs")
    return scheduler
