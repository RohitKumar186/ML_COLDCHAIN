from src.config import (
    PRE_COOLING_THRESHOLD,
    STABLE_THRESHOLD
)


def determine_mode(inside_temp):

    if inside_temp > PRE_COOLING_THRESHOLD:

        return "PRE_COOLING"

    return "ML_CONTROL"


def pre_cooling_action():

    return {
        "cooling_level": 2,
        "peltier": "HIGH",
        "fan": "HIGH"
    }


def cooling_action(level):

    if level == 0:

        return {
            "cooling_level": 0,
            "peltier": "OFF",
            "fan": "OFF"
        }

    elif level == 1:

        return {
            "cooling_level": 1,
            "peltier": "LOW",
            "fan": "LOW"
        }

    else:

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

    future_average = sum(
        future_temperatures
    ) / len(future_temperatures)

    difference = (
        future_average
        - current_temperature
    )

    if difference > STABLE_THRESHOLD:

        return "UP"

    elif difference < -STABLE_THRESHOLD:

        return "DOWN"

    return "STABLE"