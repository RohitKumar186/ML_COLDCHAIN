from src.config import (
    PRE_COOLING_THRESHOLD,
    STABLE_THRESHOLD,
    MIN_HISTORY_READINGS
)


# =========================================================
# MODE
# =========================================================

def determine_mode(inside_temp):

    inside_temp = float(inside_temp)

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
#
# Temperature > 12°C
# =========================================================

def pre_cooling_action():

    return {
        "cooling_level": 2,
        "cooling_decision": "HIGH",
        "peltier": "ON",
        "fan": "ON"
    }


# =========================================================
# BASIC COOLING LEVEL
#
# Used as a baseline.
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
# FUTURE-AWARE COOLING LEVEL
#
# Current temperature + ML future prediction
#
# The future prediction is used to prevent the
# temperature from leaving the 2-8°C safe range.
# =========================================================

def determine_ml_cooling_level(
    inside_temp,
    future_temperatures
):

    inside_temp = float(inside_temp)

    future_temperatures = [

        float(value)

        for value in future_temperatures

        if value is not None

    ]


    # -----------------------------------------------------
    # No future prediction
    #
    # Fall back to current temperature.
    # -----------------------------------------------------

    if not future_temperatures:

        return determine_cooling_level(
            inside_temp
        )


    max_future = max(
        future_temperatures
    )


    min_future = min(
        future_temperatures
    )


    average_future = (
        sum(future_temperatures)
        / len(future_temperatures)
    )


    # =====================================================
    # HIGH COOLING
    #
    # Current already high OR future temperature is
    # predicted to rise significantly above safe range.
    # =====================================================

    if (
        inside_temp > 12
        or max_future > 10
    ):

        return 2


    # =====================================================
    # LOW COOLING
    #
    # Temperature is inside/near safe range but future
    # prediction shows warming.
    # =====================================================

    if (
        inside_temp >= 8
        or max_future > 8
        or average_future > 8
    ):

        return 1


    # =====================================================
    # LOW TEMPERATURE
    #
    # If temperature is safely below 8°C and future
    # prediction is also safe, cooling can remain OFF.
    # =====================================================

    return 0


# =========================================================
# COOLING ACTION
# =========================================================

def cooling_action(level):

    level = int(level)


    # =====================================================
    # OFF
    # =====================================================

    if level <= 0:

        return {

            "cooling_level": 0,

            "cooling_decision":
                "OFF",

            "peltier":
                "OFF",

            "fan":
                "OFF"

        }


    # =====================================================
    # LOW
    # =====================================================

    if level == 1:

        return {

            "cooling_level": 1,

            "cooling_decision":
                "LOW",

            "peltier":
                "ON",

            "fan":
                "ON"

        }


    # =====================================================
    # HIGH
    # =====================================================

    return {

        "cooling_level": 2,

        "cooling_decision":
            "HIGH",

        "peltier":
            "ON",

        "fan":
            "ON"

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


    current_temperature = float(
        current_temperature
    )


    future_temperatures = [

        float(value)

        for value in future_temperatures

        if value is not None

    ]


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