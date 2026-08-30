# =========================================================
# COLD CHAIN ML CONTROLLER
# =========================================================
#
# TARGET TEMPERATURE:
#
#       2°C  --------  12°C
#
# Main objective:
# Keep temperature between 2°C and 12°C.
#
# Cooling levels:
#
#       0 = OFF
#       1 = LOW  = 50%
#       2 = HIGH = 100%
#
# ML uses future temperature predictions to decide
# whether cooling should increase before temperature
# crosses 12°C.
# =========================================================


# =========================================================
# TARGET CONFIGURATION
# =========================================================

TARGET_MIN = 2.0
TARGET_MAX = 12.0

# Temperature at which a rising forecast is considered
# to be approaching the upper target.

WATCH_TEMP = 11.0

# Temperature difference considered meaningful.

TREND_TOLERANCE = 0.20


# =========================================================
# MODE
# =========================================================

def determine_mode(inside_temp):
    """
    ML control is always active.

    Current temperature does NOT disable prediction.
    """

    return "ML_CONTROL"


# =========================================================
# HISTORY CHECK
# =========================================================

def has_enough_history(history_count):
    """
    Minimum history required for ML features.

    Lag features include:
        lag 1
        lag 2
        lag 5
        lag 10
    """

    return history_count >= 10


# =========================================================
# PRE-COOLING ACTION
#
# Kept for compatibility with existing code.
#
# This does NOT stop ML prediction.
# =========================================================

def pre_cooling_action():

    return {
        "cooling_level": 2,
        "cooling_decision": "HIGH",
        "peltier": "ON",
        "fan": "ON"
    }


# =========================================================
# COOLING ACTION
# =========================================================

def cooling_action(level):
    """
    Convert cooling level into hardware commands.

    LEVEL 0:
        Peltier OFF
        Fan OFF

    LEVEL 1:
        Peltier ON
        Fan ON
        Arduino applies 50% PWM

    LEVEL 2:
        Peltier ON
        Fan ON
        Arduino applies 100% PWM
    """

    try:

        level = int(level)

    except (
        TypeError,
        ValueError
    ):

        level = 0


    # =====================================================
    # LEVEL 0
    # =====================================================

    if level <= 0:

        return {
            "cooling_level": 0,
            "cooling_decision": "OFF",
            "peltier": "OFF",
            "fan": "OFF"
        }


    # =====================================================
    # LEVEL 1
    # =====================================================

    if level == 1:

        return {
            "cooling_level": 1,
            "cooling_decision": "LOW",
            "peltier": "ON",
            "fan": "ON"
        }


    # =====================================================
    # LEVEL 2
    # =====================================================

    return {
        "cooling_level": 2,
        "cooling_decision": "HIGH",
        "peltier": "ON",
        "fan": "ON"
    }


# =========================================================
# ML COOLING LEVEL
# =========================================================

def determine_ml_cooling_level(
    inside_temp,
    future_temperatures
):
    """
    Determine cooling level using:

        CURRENT TEMPERATURE
                 +
        ML FUTURE FORECAST


    TARGET:
        2°C - 12°C


    -------------------------------------------------------
    LEVEL 0
    -------------------------------------------------------

    Current < 2°C

        -> PELTIER OFF


    -------------------------------------------------------
    LEVEL 2
    -------------------------------------------------------

    Current > 12°C

        -> HIGH COOLING

    OR

    Forecast > 12°C

        -> HIGH COOLING

    OR

    Temperature is rising and approaching 12°C

        -> HIGH COOLING


    -------------------------------------------------------
    LEVEL 1
    -------------------------------------------------------

    Current 2°C - 12°C

    Forecast remains safe
    OR
    Forecast is stable
    OR
    Forecast is falling

        -> LOW COOLING / 50%


    -------------------------------------------------------
    IMPORTANT
    -------------------------------------------------------

    Level 1 is the normal operating state inside
    the safe temperature range.

    This prevents the temperature from unnecessarily
    falling toward the 2°C lower limit.
    """


    # =====================================================
    # CURRENT TEMPERATURE
    # =====================================================

    try:

        current = float(
            inside_temp
        )

    except (
        TypeError,
        ValueError
    ):

        return 0


    # =====================================================
    # HARD SAFETY: BELOW MINIMUM
    #
    # Temperature is already too cold.
    # =====================================================

    if current < TARGET_MIN:

        return 0


    # =====================================================
    # HARD SAFETY: ABOVE MAXIMUM
    #
    # Temperature is already too high.
    # =====================================================

    if current > TARGET_MAX:

        return 2


    # =====================================================
    # CLEAN FUTURE PREDICTIONS
    # =====================================================

    future = []


    if future_temperatures:

        for value in future_temperatures:

            try:

                value = float(
                    value
                )


                # Reject NaN

                if value != value:

                    continue


                future.append(
                    value
                )


            except (
                TypeError,
                ValueError
            ):

                continue


    # =====================================================
    # NO FORECAST
    #
    # Current temperature is already inside the
    # target range.
    #
    # Keep LOW cooling.
    # =====================================================

    if not future:

        return 1


    # =====================================================
    # FORECAST STATISTICS
    # =====================================================

    forecast_min = min(
        future
    )

    forecast_max = max(
        future
    )

    first_prediction = future[0]

    last_prediction = future[-1]


    # Maximum predicted rise from current

    max_rise = (
        forecast_max
        -
        current
    )


    # Overall change from current to final prediction

    final_change = (
        last_prediction
        -
        current
    )


    # =====================================================
    # TREND
    # =====================================================

    rising = (
        final_change
        >
        TREND_TOLERANCE
    )


    falling = (
        final_change
        <
        -TREND_TOLERANCE
    )


    stable = (
        abs(final_change)
        <=
        TREND_TOLERANCE
    )


    # =====================================================
    # SCENARIO 1
    #
    # FORECAST CROSSES 12°C
    #
    # Example:
    #
    # Current = 8°C
    # Forecast = 9 → 10 → 12.5
    #
    # HIGH COOLING
    # =====================================================

    if forecast_max > TARGET_MAX:

        return 2


    # =====================================================
    # SCENARIO 2
    #
    # RISING + APPROACHING 12°C
    #
    # Example:
    #
    # Current = 8°C
    # Forecast = 9 → 10.5 → 11.5
    #
    # It has not crossed 12 yet,
    # but it is approaching the upper limit.
    #
    # HIGH COOLING
    # =====================================================

    if (
        rising
        and
        forecast_max >= WATCH_TEMP
    ):

        return 2


    # =====================================================
    # SCENARIO 3
    #
    # CURRENT 2°C - 12°C
    #
    # FORECAST SAFE / FALLING / STABLE
    #
    # LOW COOLING
    #
    # PELTIER = 50%
    # =====================================================

    if (
        TARGET_MIN
        <=
        current
        <=
        TARGET_MAX
    ):

        return 1


    # =====================================================
    # FINAL SAFETY FALLBACK
    # =====================================================

    return 0


# =========================================================
# TEMPERATURE TREND
# =========================================================

def determine_trend(
    inside_temp,
    future_temperatures
):
    """
    Determine overall ML forecast trend.

    UP:
        Temperature expected to rise.

    DOWN:
        Temperature expected to fall.

    STABLE:
        Little meaningful change.
    """

    try:

        current = float(
            inside_temp
        )

    except (
        TypeError,
        ValueError
    ):

        return "STABLE"


    # =====================================================
    # NO FORECAST
    # =====================================================

    if not future_temperatures:

        return "STABLE"


    # =====================================================
    # CLEAN VALUES
    # =====================================================

    future = []


    for value in future_temperatures:

        try:

            value = float(
                value
            )


            # Reject NaN

            if value != value:

                continue


            future.append(
                value
            )


        except (
            TypeError,
            ValueError
        ):

            continue


    if not future:

        return "STABLE"


    # =====================================================
    # FINAL PREDICTION
    # =====================================================

    final_prediction = future[-1]


    change = (
        final_prediction
        -
        current
    )


    # =====================================================
    # RISING
    # =====================================================

    if (
        change
        >
        TREND_TOLERANCE
    ):

        return "UP"


    # =====================================================
    # FALLING
    # =====================================================

    if (
        change
        <
        -TREND_TOLERANCE
    ):

        return "DOWN"


    # =====================================================
    # STABLE
    # =====================================================

    return "STABLE"