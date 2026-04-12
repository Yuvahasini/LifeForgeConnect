"""
utils/thal_predictor.py
-----------------------
Adaptive transfusion interval predictor for ThalCare patients.

Instead of using a fixed frequency (e.g., every 21 days), this module
analyzes a patient's actual transfusion history to predict the optimal
next transfusion date.

The model uses:
  1. Weighted moving average of past intervals (recent intervals matter more)
  2. Trend detection (intervals getting shorter → patient needs more frequent transfusions)
  3. Safety margin (never suggests longer than the max safe interval)
  4. Confidence scoring (more history = more confident prediction)

For new patients with no history, it falls back to the configured frequency.
"""

from datetime import date, timedelta
from typing import Optional
import math


# ── Configuration ─────────────────────────────────────────────────────────────

# Absolute safety bounds — never predict outside these
MIN_INTERVAL_DAYS = 7     # Minimum days between transfusions
MAX_INTERVAL_DAYS = 42    # Maximum days (6 weeks) — safety ceiling
SAFETY_MARGIN_DAYS = 1    # Subtract this from prediction as safety buffer

# How many past transfusions to consider (older ones get less weight)
MAX_HISTORY_WINDOW = 10

# Minimum number of data points to use adaptive prediction
MIN_DATA_POINTS = 2


def predict_next_interval(
    transfusion_dates: list[str],
    configured_frequency: int = 21,
) -> dict:
    """
    Given a list of past transfusion dates (ISO format, most recent first or any order),
    predict the optimal interval to the next transfusion.

    Returns:
        {
            "predicted_days": int,          # recommended interval in days
            "configured_days": int,         # the static configured frequency
            "confidence": float,            # 0.0 to 1.0 — how confident the prediction is
            "method": str,                  # "adaptive" | "fallback"
            "trend": str,                   # "stable" | "shortening" | "lengthening"
            "trend_detail": str,            # human-readable trend explanation
            "intervals": list[int],         # actual intervals computed from history
            "avg_interval": float | None,   # weighted average
            "next_date": str | None,        # predicted next date if last date is known
        }
    """
    if not transfusion_dates or len(transfusion_dates) < MIN_DATA_POINTS:
        # Not enough history — fall back to configured frequency
        return {
            "predicted_days": configured_frequency,
            "configured_days": configured_frequency,
            "confidence": 0.0,
            "method": "fallback",
            "trend": "stable",
            "trend_detail": "Not enough history for adaptive prediction. Using configured frequency.",
            "intervals": [],
            "avg_interval": None,
            "next_date": None,
        }

    # ── Parse and sort dates (oldest first) ────────────────────────────────
    parsed = []
    for d in transfusion_dates:
        try:
            parsed.append(date.fromisoformat(str(d)[:10]))
        except (ValueError, TypeError):
            continue

    if len(parsed) < MIN_DATA_POINTS:
        return {
            "predicted_days": configured_frequency,
            "configured_days": configured_frequency,
            "confidence": 0.0,
            "method": "fallback",
            "trend": "stable",
            "trend_detail": "Could not parse enough valid dates.",
            "intervals": [],
            "avg_interval": None,
            "next_date": None,
        }

    parsed.sort()  # oldest first

    # ── Compute intervals between consecutive transfusions ─────────────────
    intervals = []
    for i in range(1, len(parsed)):
        gap = (parsed[i] - parsed[i - 1]).days
        if gap > 0:  # skip same-day duplicates
            intervals.append(gap)

    if not intervals:
        return {
            "predicted_days": configured_frequency,
            "configured_days": configured_frequency,
            "confidence": 0.0,
            "method": "fallback",
            "trend": "stable",
            "trend_detail": "No valid intervals computed from history.",
            "intervals": [],
            "avg_interval": None,
            "next_date": None,
        }

    # Limit to recent history
    intervals = intervals[-MAX_HISTORY_WINDOW:]

    # ── Weighted moving average (exponential weights, recent = higher) ─────
    n = len(intervals)
    weights = [math.exp(0.3 * i) for i in range(n)]  # exponential: recent gets more weight
    total_weight = sum(weights)
    weighted_avg = sum(intervals[i] * weights[i] for i in range(n)) / total_weight

    # ── Trend detection ────────────────────────────────────────────────────
    trend = "stable"
    trend_detail = "Transfusion intervals are stable."

    if n >= 3:
        # Compare first half average vs second half average
        mid = n // 2
        first_half_avg = sum(intervals[:mid]) / mid if mid > 0 else weighted_avg
        second_half_avg = sum(intervals[mid:]) / (n - mid) if (n - mid) > 0 else weighted_avg

        change_pct = ((second_half_avg - first_half_avg) / first_half_avg * 100) if first_half_avg > 0 else 0

        if change_pct < -10:  # intervals getting shorter by >10%
            trend = "shortening"
            trend_detail = (
                f"Intervals are shortening ({first_half_avg:.0f} → {second_half_avg:.0f} days). "
                f"Patient may need more frequent transfusions."
            )
        elif change_pct > 10:  # intervals getting longer by >10%
            trend = "lengthening"
            trend_detail = (
                f"Intervals are lengthening ({first_half_avg:.0f} → {second_half_avg:.0f} days). "
                f"Patient responding well to treatment."
            )

    # ── Apply safety bounds ────────────────────────────────────────────────
    predicted = round(weighted_avg) - SAFETY_MARGIN_DAYS
    predicted = max(MIN_INTERVAL_DAYS, min(MAX_INTERVAL_DAYS, predicted))

    # ── Confidence score ───────────────────────────────────────────────────
    # Based on: number of data points + consistency (low std dev = high confidence)
    std_dev = math.sqrt(sum((x - weighted_avg) ** 2 for x in intervals) / n) if n > 1 else 0
    cv = std_dev / weighted_avg if weighted_avg > 0 else 1  # coefficient of variation

    # More data points and lower variation = higher confidence
    data_confidence = min(1.0, n / 6)  # max confidence at 6+ data points
    consistency_confidence = max(0.0, 1.0 - cv)  # low CV = high confidence
    confidence = round(data_confidence * 0.4 + consistency_confidence * 0.6, 2)

    # ── Compute next date from most recent transfusion ─────────────────────
    last_date = parsed[-1]
    next_date = (last_date + timedelta(days=predicted)).isoformat()

    return {
        "predicted_days": predicted,
        "configured_days": configured_frequency,
        "confidence": confidence,
        "method": "adaptive",
        "trend": trend,
        "trend_detail": trend_detail,
        "intervals": intervals,
        "avg_interval": round(weighted_avg, 1),
        "next_date": next_date,
    }


def get_smart_next_date(
    last_transfusion: str,
    configured_freq: int,
    past_transfusion_dates: list[str],
) -> tuple[str, dict]:
    """
    Convenience function that returns (next_date_iso, prediction_details).
    Used by thal.py when marking a transfusion as done.

    If there's enough history, uses adaptive prediction.
    Otherwise, uses configured_freq.
    """
    prediction = predict_next_interval(past_transfusion_dates, configured_freq)

    if prediction["method"] == "adaptive":
        interval = prediction["predicted_days"]
    else:
        interval = configured_freq

    last = date.fromisoformat(str(last_transfusion)[:10])
    next_date = last + timedelta(days=interval)

    prediction["next_date"] = next_date.isoformat()
    return next_date.isoformat(), prediction
