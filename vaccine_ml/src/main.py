import os
from datetime import datetime, timezone

import pandas as pd

from src.config import (
    MIN_HISTORY_READINGS,
    COOLING_MODEL_PATH,
    TEMPERATURE_MODEL_PATH
)

from src.data.preprocessing import create_features

from src.models.cooling_model import (
    FEATURES as COOLING_FEATURES
)

from src.models.temperature_model import (
    load_temperature_model,
    predict_future_temperature
)

from src.control.controller import (
    cooling_action,
    determine_ml_cooling_level,
    determine_trend
)

from src.auto_trainer import maybe_retrain


# =========================================================
# PREDICT
#
# ESP32
#   ↓
# Node Backend
#   ↓
# PostgreSQL history
#   ↓
# Feature generation
#   ↓
# Temperature ML model
#   ↓
# 20 future predictions
#   ↓
# ML cooling decision
#   ↓
# ESP32
#
# IMPORTANT:
#
# CURRENT TEMPERATURE DOES NOT STOP ML PREDICTION.
#
# Even if current temperature is > 12°C,
# we still generate the 20-point forecast.
#
# Cooling decision is made AFTER seeing the forecast.
# =========================================================

def predict(
    inside_temp,
    outside_temp,
    history=None
):

    # =====================================================
    # NORMALIZE INPUT
    # =====================================================

    if history is None:
        history = []


    inside_temp = float(
        inside_temp
    )

    outside_temp = float(
        outside_temp
    )


    # =====================================================
    # AUTOMATIC TRAINING
    #
    # Latest history is passed to auto trainer.
    # =====================================================

    try:

        maybe_retrain(
            history
        )

    except Exception as e:

        print(
            "[AUTO TRAIN] Trigger error:",
            str(e)
        )


    # =====================================================
    # CONVERT HISTORY
    #
    # IMPORTANT:
    #
    # ALL valid temperature readings are used.
    #
    # We do NOT remove readings above 12°C.
    #
    # This is important because the ML model should learn
    # warming/cooling behavior across the complete range.
    # =====================================================

    history_rows = []


    for item in history:

        try:

            timestamp = pd.to_datetime(
                item.get("timestamp"),
                errors="coerce",
                utc=True
            )


            if pd.isna(timestamp):

                continue


            timestamp = (
                timestamp
                .tz_localize(None)
            )


            inside_value = float(
                item.get("inside_temp")
            )


            outside_value = float(
                item.get("outside_temp")
            )


            history_rows.append({

                "timestamp":
                    timestamp,

                "inside_temp":
                    inside_value,

                "outside_temp":
                    outside_value,

                # IMPORTANT:
                # Everything is usable ML history.
                "mode":
                    "ML_CONTROL"

            })


        except (
            TypeError,
            ValueError
        ):

            continue


    # =====================================================
    # CURRENT READING
    # =====================================================

    current_timestamp = (
        datetime.now(
            timezone.utc
        )
        .replace(
            tzinfo=None
        )
    )


    current = pd.DataFrame([{

        "timestamp":
            current_timestamp,

        "inside_temp":
            inside_temp,

        "outside_temp":
            outside_temp,

        "mode":
            "ML_CONTROL"

    }])


    # =====================================================
    # COMBINE HISTORY + CURRENT
    # =====================================================

    if history_rows:

        history_df = pd.DataFrame(
            history_rows
        )


        full_history = pd.concat(

            [
                history_df,
                current
            ],

            ignore_index=True

        )

    else:

        full_history = current.copy()


    # =====================================================
    # SORT CHRONOLOGICALLY
    # =====================================================

    full_history = (

        full_history

        .sort_values(
            "timestamp"
        )

        .reset_index(
            drop=True
        )

    )


    history_count = len(
        full_history
    )


    # =====================================================
    # NOT ENOUGH HISTORY
    #
    # Need enough readings to create lag features.
    # =====================================================

    if history_count < MIN_HISTORY_READINGS:

        level = determine_ml_cooling_level(

            inside_temp,

            []

        )


        action = cooling_action(
            level
        )


        if level == 0:

            risk = "low"

        elif level == 1:

            risk = "medium"

        else:

            risk = "high"


        return {

            "inside_temperature":
                inside_temp,

            "outside_temperature":
                outside_temp,

            "mode":
                "ML_CONTROL",

            "prediction_status":
                "COLLECTING_HISTORY",

            "history_count":
                history_count,

            "required_history":
                MIN_HISTORY_READINGS,

            "cooling_level":
                int(level),

            "cooling_decision":
                action.get(
                    "cooling_decision",
                    "OFF"
                ),

            "peltier":
                action.get(
                    "peltier",
                    "OFF"
                ),

            "fan":
                action.get(
                    "fan",
                    "OFF"
                ),

            "future_temperatures":
                [],

            "trend":
                "STABLE",

            "risk":
                risk

        }


    # =====================================================
    # TEMPERATURE MODEL CHECK
    #
    # Cooling model is NOT required to generate the
    # future temperature forecast.
    #
    # Temperature model is the important model here.
    # =====================================================

    temperature_model_valid = (

        os.path.isfile(
            TEMPERATURE_MODEL_PATH
        )

        and

        os.path.getsize(
            TEMPERATURE_MODEL_PATH
        ) > 0

    )


    if not temperature_model_valid:

        level = determine_ml_cooling_level(

            inside_temp,

            []

        )


        action = cooling_action(
            level
        )


        if level == 0:

            risk = "low"

        elif level == 1:

            risk = "medium"

        else:

            risk = "high"


        return {

            "inside_temperature":
                inside_temp,

            "outside_temperature":
                outside_temp,

            "mode":
                "ML_CONTROL",

            "prediction_status":
                "MODEL_NOT_TRAINED",

            "history_count":
                history_count,

            "cooling_level":
                int(level),

            "cooling_decision":
                action.get(
                    "cooling_decision",
                    "OFF"
                ),

            "peltier":
                action.get(
                    "peltier",
                    "OFF"
                ),

            "fan":
                action.get(
                    "fan",
                    "OFF"
                ),

            "future_temperatures":
                [],

            "trend":
                "STABLE",

            "risk":
                risk,

            "message":
                "Temperature model is not trained yet."

        }


    # =====================================================
    # CREATE FEATURES
    #
    # This creates:
    #
    # inside_lag_1
    # inside_lag_2
    # inside_lag_5
    # inside_lag_10
    #
    # and all other ML features.
    # =====================================================

    feature_history = create_features(
        full_history
    )


    # =====================================================
    # KEEP ONLY ROWS WITH REQUIRED FEATURES
    # =====================================================

    available_features = [

        feature

        for feature in COOLING_FEATURES

        if feature in feature_history.columns

    ]


    # -----------------------------------------------------
    # Safety check
    # -----------------------------------------------------

    missing_features = [

        feature

        for feature in COOLING_FEATURES

        if feature not in feature_history.columns

    ]


    if missing_features:

        print(
            "[ML] Missing features:",
            missing_features
        )


        return {

            "inside_temperature":
                inside_temp,

            "outside_temperature":
                outside_temp,

            "mode":
                "ML_CONTROL",

            "prediction_status":
                "FEATURE_ERROR",

            "history_count":
                history_count,

            "cooling_level":
                0,

            "cooling_decision":
                "OFF",

            "peltier":
                "OFF",

            "fan":
                "OFF",

            "future_temperatures":
                [],

            "trend":
                "STABLE",

            "risk":
                "unknown",

            "message":
                "Required ML features are missing."

        }


    feature_history = (

        feature_history

        .dropna(
            subset=available_features
        )

    )


    # =====================================================
    # FEATURE HISTORY NOT READY
    # =====================================================

    if feature_history.empty:

        level = determine_ml_cooling_level(

            inside_temp,

            []

        )


        action = cooling_action(
            level
        )


        if level == 0:

            risk = "low"

        elif level == 1:

            risk = "medium"

        else:

            risk = "high"


        return {

            "inside_temperature":
                inside_temp,

            "outside_temperature":
                outside_temp,

            "mode":
                "ML_CONTROL",

            "prediction_status":
                "COLLECTING_HISTORY",

            "history_count":
                history_count,

            "required_history":
                MIN_HISTORY_READINGS,

            "cooling_level":
                int(level),

            "cooling_decision":
                action.get(
                    "cooling_decision",
                    "OFF"
                ),

            "peltier":
                action.get(
                    "peltier",
                    "OFF"
                ),

            "fan":
                action.get(
                    "fan",
                    "OFF"
                ),

            "future_temperatures":
                [],

            "trend":
                "STABLE",

            "risk":
                risk

        }


    # =====================================================
    # LATEST FEATURE ROW
    # =====================================================

    latest = (

        feature_history

        .iloc[
            -1:
        ]

    )


    # =====================================================
    # INPUT FOR TEMPERATURE MODEL
    #
    # The temperature model uses the same feature set.
    # =====================================================

    X = latest[
        available_features
    ]


    # =====================================================
    # LOAD TEMPERATURE MODEL
    # =====================================================

    try:

        temperature_model = (
            load_temperature_model()
        )

    except Exception as e:

        print(
            "[ML] Temperature model load failed:",
            str(e)
        )


        return {

            "inside_temperature":
                inside_temp,

            "outside_temperature":
                outside_temp,

            "mode":
                "ML_CONTROL",

            "prediction_status":
                "MODEL_LOAD_ERROR",

            "history_count":
                history_count,

            "cooling_level":
                0,

            "cooling_decision":
                "OFF",

            "peltier":
                "OFF",

            "fan":
                "OFF",

            "future_temperatures":
                [],

            "trend":
                "STABLE",

            "risk":
                "unknown",

            "message":
                str(e)

        }


    # =====================================================
    # 20 FUTURE TEMPERATURE PREDICTIONS
    #
    # IMPORTANT:
    #
    # THIS RUNS REGARDLESS OF CURRENT TEMPERATURE.
    #
    # Current = 8°C
    # Current = 12°C
    # Current = 15°C
    #
    # All can be forecasted.
    # =====================================================

    try:

        future_temperatures = (

            predict_future_temperature(

                temperature_model,

                X

            )

        )


    except Exception as e:

        print(
            "[ML] Future temperature prediction failed:",
            str(e)
        )


        return {

            "inside_temperature":
                inside_temp,

            "outside_temperature":
                outside_temp,

            "mode":
                "ML_CONTROL",

            "prediction_status":
                "PREDICTION_ERROR",

            "history_count":
                history_count,

            "cooling_level":
                0,

            "cooling_decision":
                "OFF",

            "peltier":
                "OFF",

            "fan":
                "OFF",

            "future_temperatures":
                [],

            "trend":
                "STABLE",

            "risk":
                "unknown",

            "message":
                str(e)

        }


    # =====================================================
    # CLEAN PREDICTIONS
    # =====================================================

    future_temperatures = [

        round(
            float(value),
            2
        )

        for value in future_temperatures

        if value is not None

    ]


    # =====================================================
    # TREND
    # =====================================================

    trend = determine_trend(

        inside_temp,

        future_temperatures

    )


    # =====================================================
    # ML COOLING DECISION
    #
    # THIS IS THE IMPORTANT PART.
    #
    # Decision uses:
    #
    # CURRENT TEMPERATURE
    # +
    # FUTURE ML PREDICTIONS
    #
    # Example:
    #
    # Current = 12
    # Future max = 15
    #
    # → Level 2
    #
    # Current = 11
    # Future min = 8
    #
    # → Level 1
    #
    # Current = 7
    # Future = 5
    #
    # → Level 0
    # =====================================================

    level = determine_ml_cooling_level(

        inside_temp,

        future_temperatures

    )


    # =====================================================
    # COOLING ACTION
    # =====================================================

    action = cooling_action(
        level
    )


    # =====================================================
    # RISK
    # =====================================================

    if level == 0:

        risk = "low"

    elif level == 1:

        risk = "medium"

    else:

        risk = "high"


    # =====================================================
    # FORECAST MIN / MAX
    # =====================================================

    if future_temperatures:

        forecast_min = min(
            future_temperatures
        )

        forecast_max = max(
            future_temperatures
        )

    else:

        forecast_min = None

        forecast_max = None


    # =====================================================
    # FINAL RESPONSE
    # =====================================================

    return {

        "inside_temperature":
            inside_temp,

        "outside_temperature":
            outside_temp,

        "mode":
            "ML_CONTROL",

        "prediction_status":
            "ACTIVE",

        "history_count":
            history_count,

        "cooling_level":
            int(level),

        "cooling_decision":
            action.get(
                "cooling_decision",
                "OFF"
            ),

        "peltier":
            action.get(
                "peltier",
                "OFF"
            ),

        "fan":
            action.get(
                "fan",
                "OFF"
            ),

        "risk":
            risk,

        "future_temperatures":
            future_temperatures,

        "trend":
            trend,

        "forecast_min":
            (
                round(
                    forecast_min,
                    2
                )

                if forecast_min is not None

                else None
            ),

        "forecast_max":
            (
                round(
                    forecast_max,
                    2
                )

                if forecast_max is not None

                else None
            ),

        "future_points":
            len(
                future_temperatures
            ),

        "forecast_minutes":
            len(
                future_temperatures
            ) * 5

    }