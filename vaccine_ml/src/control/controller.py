# =========================================================
# COLD CHAIN ML CONTROL
# =========================================================
#
# Cooling decision is based on:
#
# 1. Current temperature
# 2. Future ML predicted temperatures
#
# NOT current temperature alone.
#
# Safe storage range:
#       2°C - 8°C
#
# Cooling levels:
#       0 = OFF
#       1 = LOW
#       2 = HIGH
# =========================================================


# =========================================================
# CONFIGURATION
# =========================================================

SAFE_MIN = 2.0
SAFE_MAX = 8.0

# Early-warning boundary.
# If forecast approaches this level, start cooling.

WATCH_TEMP = 7.0

# Strong warming condition.
HIGH_RISE = 1.0

# Small tolerance to avoid unnecessary switching.

TREND_TOLERANCE = 0.20


# =========================================================
# MODE
# =========================================================

def determine_mode(inside_temp):

    """
    Mode is now always ML_CONTROL.

    IMPORTANT:
    We do NOT stop ML prediction when temperature
    goes above 12°C.

    The forecast itself decides the cooling level.
    """

    return "ML_CONTROL"


# =========================================================
# HISTORY CHECK
# =========================================================

def has_enough_history(history_count):

    """
    Minimum history required before ML forecasting.

    The feature generator requires at least the
    10-step lag history.
    """

    return history_count >= 10


# =========================================================
# PRE-COOLING ACTION
# =========================================================

def pre_cooling_action():

    """
    Kept for compatibility with existing imports.

    Actual system now uses forecast-based control,
    so PRE_COOLING is no longer used as a separate
    prediction-blocking mode.
    """

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
    Convert cooling level into hardware action.

    0 = OFF
    1 = LOW
    2 = HIGH
    """

    level = int(level)


    # -----------------------------------------------------
    # OFF
    # -----------------------------------------------------

    if level <= 0:

        return {

            "cooling_level": 0,

            "cooling_decision": "OFF",

            "peltier": "OFF",

            "fan": "OFF"

        }


    # -----------------------------------------------------
    # LOW
    # -----------------------------------------------------

    if level == 1:

        return {

            "cooling_level": 1,

            "cooling_decision": "LOW",

            "peltier": "ON",

            "fan": "ON"

        }


    # -----------------------------------------------------
    # HIGH
    # -----------------------------------------------------

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
    Forecast-based cooling controller.

    Examples:

    Current = 12°C
    Forecast reaches 15°C
        -> HIGH

    Current = 11°C
    Forecast falls toward 8°C
        -> LOW

    Current = 7°C
    Forecast falls toward 5°C
        -> OFF

    Current = 6°C
    Forecast rises toward 10°C
        -> HIGH


    Priority:

    1. Strong predicted overheating
    2. Predicted warming outside safe range
    3. Current temperature already above safe range
    4. Predicted approach toward upper limit
    5. Predicted cooling toward safe range
    6. Otherwise OFF
    """

    current = float(
        inside_temp
    )


    # =====================================================
    # CLEAN FUTURE VALUES
    # =====================================================

    if future_temperatures is None:

        future = []

    else:

        future = []

        for value in future_temperatures:

            try:

                value = float(value)

                future.append(value)

            except (
                TypeError,
                ValueError
            ):

                continue


    # =====================================================
    # NO FORECAST
    #
    # If ML forecast is unavailable, use conservative
    # current-temperature fallback.
    # =====================================================

    if not future:

        if current > SAFE_MAX:

            return 2


        if current >= WATCH_TEMP:

            return 1


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


    # Maximum warming relative to current.

    max_rise = (
        forecast_max -
        current
    )


    # Final forecast change.

    final_change = (
        last_prediction -
        current
    )


    # =====================================================
    # LEVEL 2 — HIGH
    #
    # Strong future overheating.
    # =====================================================

    # Case:
    #
    # Current 12°C
    # Forecast 15°C
    #
    # HIGH immediately.

    if forecast_max > SAFE_MAX:

        # If it is significantly above the safe range
        # or warming strongly, use HIGH.

        if (
            forecast_max >= 9.0
            or
            max_rise >= HIGH_RISE
            or
            current >= 12.0
        ):

            return 2


    # =====================================================
    # CURRENT ALREADY HIGH
    # =====================================================

    if current > SAFE_MAX:

        return 2


    # =====================================================
    # STRONG WARMING TOWARD HIGH TEMPERATURE
    # =====================================================

    if (
        max_rise >= HIGH_RISE
        and
        forecast_max >= WATCH_TEMP
    ):

        return 2


    # =====================================================
    # LEVEL 1 — LOW
    #
    # Current is above safe range but forecast is
    # moving down toward the safe region.
    #
    # Example:
    #
    # Current = 11
    # Forecast = 10.8 ... 8.0
    #
    # LOW.
    # =====================================================

    if current > SAFE_MAX:

        if (
            last_prediction < current
            and
            forecast_min <= SAFE_MAX
        ):

            return 1


        # Still above safe range but not aggressively
        # warming.

        return 1


    # =====================================================
    # CURRENT WITHIN SAFE RANGE
    # =====================================================

    if (
        SAFE_MIN <= current <= SAFE_MAX
    ):


        # -------------------------------------------------
        # Predicted future overheating
        # -------------------------------------------------

        if forecast_max > SAFE_MAX:

            # Strong future rise -> HIGH

            if (
                max_rise >= HIGH_RISE
                or
                forecast_max >= 9.0
            ):

                return 2


            # Mild approach above safe range -> LOW

            return 1


        # -------------------------------------------------
        # Predicted approach to upper boundary
        # -------------------------------------------------

        if (
            forecast_max >= WATCH_TEMP
            and
            final_change > TREND_TOLERANCE
        ):

            return 1


        # -------------------------------------------------
        # Predicted cooling
        #
        # Example:
        #
        # Current = 7
        # Future = 6, 5, 4...
        #
        # No cooling needed.
        # -------------------------------------------------

        if (
            final_change < -TREND_TOLERANCE
            and
            forecast_max <= SAFE_MAX
        ):

            return 0


        # -------------------------------------------------
        # Stable safe temperature
        # -------------------------------------------------

        return 0


    # =====================================================
    # CURRENT BELOW SAFE RANGE
    # =====================================================

    if current < SAFE_MIN:

        # Temperature is already too cold.
        #
        # Never increase cooling here.

        return 0


    # =====================================================
    # FALLBACK
    # =====================================================

    return 0


# =========================================================
# TREND
# =========================================================

def determine_trend(
    inside_temp,
    future_temperatures
):

    """
    Determine overall forecast direction.

    UP:
        future temperature rises

    DOWN:
        future temperature falls

    STABLE:
        little/no meaningful change
    """

    current = float(
        inside_temp
    )


    if not future_temperatures:

        return "STABLE"


    try:

        future = [

            float(value)

            for value in future_temperatures

        ]

    except (
        TypeError,
        ValueError
    ):

        return "STABLE"


    if not future:

        return "STABLE"


    # =====================================================
    # USE BOTH FIRST AND FINAL PREDICTION
    # =====================================================

    first = future[0]

    final = future[-1]


    change = (
        final -
        current
    )


    # =====================================================
    # UP
    # =====================================================

    if change > TREND_TOLERANCE:

        return "UP"


    # =====================================================
    # DOWN
    # =====================================================

    if change < -TREND_TOLERANCE:

        return "DOWN"


    # =====================================================
    # STABLE
    # =====================================================

    return "STABLE"