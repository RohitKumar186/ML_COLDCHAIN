from src.config import (
    PRE_COOLING_THRESHOLD,
    STABLE_THRESHOLD,
    MIN_HISTORY_READINGS
)


# =========================================================
# MODE
# =========================================================

def determine_mode(inside_temp):

    if inside_temp > PRE_COOLING_THRESHOLD:
        return "PRE_COOLING"

    return "ML_CONTROL"


# =========================================================
# HISTORY
# =========================================================

def has_enough_history(history_count):

    return history_count >= MIN_HISTORY_READINGS


# =========================================================
# PRE-COOLING ACTION
# Temperature > 12°C
# =========================================================

def pre_cooling_action():

    return {
        "cooling_level": 2,
        "peltier": "HIGH",
        "fan": "HIGH"
    }


# =========================================================
# COOLING LEVEL FROM TEMPERATURE
#
# > 12°C  → Level 2
# 8-12°C  → Level 1
# < 8°C   → Level 0
# =========================================================

def determine_cooling_level(inside_temp):

    inside_temp = float(inside_temp)

    if inside_temp > 12:
        return 2

    if inside_temp >= 8:
        return 1

    return 0


# =========================================================
# COOLING ACTION
# =========================================================

def cooling_action(level):

    level = int(level)

    if level <= 0:

        return {
            "cooling_level": 0,
            "peltier": "OFF",
            "fan": "OFF"
        }

    if level == 1:

        return {
            "cooling_level": 1,
            "peltier": "LOW",
            "fan": "LOW"
        }

    return {
        "cooling_level": 2,
        "peltier": "HIGH",
        "fan": "HIGH"
    }


# =========================================================
# TREND
# =========================================================

def determine_trend(
    current_temperature,
    future_temperatures
):

    if not future_temperatures:
        return "STABLE"

    average_future = (
        sum(future_temperatures)
        / len(future_temperatures)
    )

    difference = (
        average_future
        - current_temperature
    )

    if difference > STABLE_THRESHOLD:
        return "UP"

    if difference < -STABLE_THRESHOLD:
        return "DOWN"

    return "STABLE"