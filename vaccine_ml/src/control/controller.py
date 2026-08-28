from src.config import (
    PRE_COOLING_THRESHOLD,
    STABLE_THRESHOLD,
    MIN_HISTORY_READINGS
)


def determine_mode(inside_temp):

    if inside_temp > PRE_COOLING_THRESHOLD:
        return "PRE_COOLING"

    return "ML_CONTROL"


def has_enough_history(history_count):

    return history_count >= MIN_HISTORY_READINGS


def pre_cooling_action():

    return {
        "cooling_level": 2,
        "peltier": "HIGH",
        "fan": "HIGH"
    }


def cooling_action(level):

    level = int(level)

    if level == 0:
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