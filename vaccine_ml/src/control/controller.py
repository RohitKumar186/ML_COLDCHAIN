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
#       1 = LOW
#       2 = HIGH
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

# Start preventive cooling when forecast approaches
# the upper target.

WATCH_TEMP = 10.0

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

    LEVEL 2:
        Peltier ON
        Fan ON
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

    Target:
        2°C - 12°C


    -------------------------------------------------------
    SCENARIO 1
    -------------------------------------------------------

    Current > 12°C
        -> LEVEL 2

    Example:
        13°C -> LEVEL 2
        15°C -> LEVEL 2


    -------------------------------------------------------
    SCENARIO 2
    -------------------------------------------------------

    Current < 2°C
        -> LEVEL 0

    Peltier must be OFF.


    -------------------------------------------------------
    SCENARIO 3
    -------------------------------------------------------

    Current 8-12°C

    Forecast crosses 12°C
        -> LEVEL 2

    Forecast approaches 12°C
        -> LEVEL 2

    Forecast stable/falling
        -> LEVEL 0


    -------------------------------------------------------
    SCENARIO 4
    -------------------------------------------------------

    Current 5-8°C

    Forecast reaches 12°C
        -> LEVEL 2

    Forecast rises strongly
        -> LEVEL 1

    Forecast stable/falling
        -> LEVEL 0


    -------------------------------------------------------
    SCENARIO 5
    -------------------------------------------------------

    Current 2-5°C

    Forecast reaches 12°C
        -> LEVEL 2

    Forecast approaches 10°C
        -> LEVEL 1

    Forecast stable/falling
        -> LEVEL 0
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
    # NO ML FORECAST
    #
    # Use safe current-temperature fallback.
    # =====================================================

    if not future:

        # Above target
        if current > TARGET_MAX:

            return 2


        # Below minimum
        if current < TARGET_MIN:

            return 0


        # Inside target
        return 0


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


    # Maximum predicted rise from current.

    max_rise = (
        forecast_max
        -
        current
    )


    # Overall change from current to final prediction.

    final_change = (
        last_prediction
        -
        current
    )


    # =====================================================
    # SCENARIO 1
    #
    # CURRENT ABOVE 12°C
    #
    # HARD COOLING REQUIREMENT.
    #
    # ML cannot turn cooling OFF.
    # =====================================================

    if current > TARGET_MAX:

        return 2


    # =====================================================
    # SCENARIO 2
    #
    # CURRENT BELOW 2°C
    #
    # TOO COLD.
    #
    # PELTIER OFF.
    # =====================================================

    if current < TARGET_MIN:

        return 0


    # =====================================================
    # SCENARIO 3
    #
    # CURRENT 8-12°C
    # =====================================================

    if current >= 8.0:


        # -------------------------------------------------
        # Forecast crosses 12°C
        # -------------------------------------------------

        if forecast_max >= TARGET_MAX:

            return 2


        # -------------------------------------------------
        # Forecast approaches upper limit
        #
        # Example:
        #
        # 8°C
        # 9°C
        # 10°C
        # 11°C
        #
        # Preventive cooling.
        # -------------------------------------------------

        if (
            forecast_max >= WATCH_TEMP
            and
            final_change > TREND_TOLERANCE
        ):

            return 2


        # -------------------------------------------------
        # Strong warming
        # -------------------------------------------------

        if (
            max_rise >= 1.0
            and
            final_change > TREND_TOLERANCE
        ):

            return 2


        # -------------------------------------------------
        # Temperature stable/falling
        # -------------------------------------------------

        return 0


    # =====================================================
    # SCENARIO 4
    #
    # CURRENT 5-8°C
    # =====================================================

    if current >= 5.0:


        # -------------------------------------------------
        # Forecast crosses 12°C
        # -------------------------------------------------

        if forecast_max >= TARGET_MAX:

            return 2


        # -------------------------------------------------
        # Forecast approaches 10°C+ while rising
        # -------------------------------------------------

        if (
            forecast_max >= WATCH_TEMP
            and
            final_change > TREND_TOLERANCE
        ):

            return 2


        # -------------------------------------------------
        # Strong upward movement
        #
        # Example:
        #
        # Current 6°C
        # Forecast 7 → 8 → 9
        #
        # Start low cooling.
        # -------------------------------------------------

        if (
            max_rise >= 2.0
            and
            final_change > TREND_TOLERANCE
        ):

            return 1


        # -------------------------------------------------
        # Stable / falling
        # -------------------------------------------------

        return 0


    # =====================================================
    # SCENARIO 5
    #
    # CURRENT 2-5°C
    # =====================================================

    if current >= TARGET_MIN:


        # -------------------------------------------------
        # Forecast crosses 12°C
        #
        # Very strong future warming.
        # -------------------------------------------------

        if forecast_max >= TARGET_MAX:

            return 2


        # -------------------------------------------------
        # Forecast approaches 10°C
        # -------------------------------------------------

        if (
            forecast_max >= WATCH_TEMP
            and
            final_change > TREND_TOLERANCE
        ):

            return 1


        # -------------------------------------------------
        # Safe temperature
        # -------------------------------------------------

        return 0


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

    if change > TREND_TOLERANCE:

        return "UP"


    # =====================================================
    # FALLING
    # =====================================================

    if change < -TREND_TOLERANCE:

        return "DOWN"


    # =====================================================
    # STABLE
    # =====================================================

    return "STABLE"