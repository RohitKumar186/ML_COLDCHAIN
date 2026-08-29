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
    load_cooling_model,
    FEATURES as COOLING_FEATURES
)

from src.models.temperature_model import (
    load_temperature_model,
    predict_future_temperature
)

from src.control.controller import (
    determine_mode,
    has_enough_history,
    pre_cooling_action,
    cooling_action,
    determine_ml_cooling_level,
    determine_trend
)

from src.auto_trainer import maybe_retrain


# =========================================================
# PREDICT
# =========================================================

def predict(
    inside_temp,
    outside_temp,
    history=None
):

    if history is None:
        history = []


    # =====================================================
    # AUTOMATIC TRAINING
    # =====================================================

    maybe_retrain(history)


    # =====================================================
    # CONVERT HISTORY
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


            mode_value = item.get(
                "mode"
            )


            if mode_value is None:

                mode_value = (
                    "PRE_COOLING"
                    if inside_value > 12
                    else "ML_CONTROL"
                )


            history_rows.append({

                "timestamp":
                    timestamp,

                "inside_temp":
                    inside_value,

                "outside_temp":
                    outside_value,

                "mode":
                    mode_value

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
            float(inside_temp),

        "outside_temp":
            float(outside_temp),

        "mode":
            determine_mode(
                inside_temp
            )

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


    full_history = (
        full_history
        .sort_values("timestamp")
        .reset_index(drop=True)
    )


    # =====================================================
    # CURRENT MODE
    # =====================================================

    mode = determine_mode(
        inside_temp
    )


    # =====================================================
    # PRE-COOLING
    # =====================================================

    if mode == "PRE_COOLING":

        action = pre_cooling_action()

        return {

            "inside_temperature":
                float(inside_temp),

            "outside_temperature":
                float(outside_temp),

            "mode":
                "PRE_COOLING",

            "prediction_status":
                "WAITING",

            "history_count":
                len(full_history),

            "future_temperatures":
                [],

            "trend":
                "STABLE",

            "risk":
                "high",

            **action

        }


    # =====================================================
    # ML CONTROL HISTORY
    # =====================================================

    ml_history = (
        full_history[
            full_history["mode"] ==
            "ML_CONTROL"
        ]
        .copy()
    )


    history_count = len(
        ml_history
    )


    # =====================================================
    # NOT ENOUGH HISTORY
    # =====================================================

    if not has_enough_history(
        history_count
    ):

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
                float(inside_temp),

            "outside_temperature":
                float(outside_temp),

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

            "future_temperatures":
                [],

            "trend":
                "STABLE",

            "risk":
                risk,

            **action

        }


    # =====================================================
    # CHECK TEMPERATURE MODEL
    #
    # Temperature prediction is independent from
    # cooling model availability.
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
                float(inside_temp),

            "outside_temperature":
                float(outside_temp),

            "mode":
                "ML_CONTROL",

            "prediction_status":
                "MODEL_NOT_TRAINED",

            "history_count":
                history_count,

            "cooling_level":
                int(level),

            "future_temperatures":
                [],

            "trend":
                "STABLE",

            "risk":
                risk,

            "message":
                "Temperature model is not trained yet.",

            **action

        }


    # =====================================================
    # CREATE FEATURES
    # =====================================================

    feature_history = create_features(
        full_history
    )


    # =====================================================
    # VALID FEATURE ROWS
    # =====================================================

    feature_history = (
        feature_history
        .dropna(
            subset=COOLING_FEATURES
        )
    )


    if feature_history.empty:

        level = determine_ml_cooling_level(
            inside_temp,
            []
        )

        action = cooling_action(
            level
        )


        return {

            "inside_temperature":
                float(inside_temp),

            "outside_temperature":
                float(outside_temp),

            "mode":
                "ML_CONTROL",

            "prediction_status":
                "COLLECTING_FEATURES",

            "history_count":
                history_count,

            "cooling_level":
                int(level),

            "future_temperatures":
                [],

            "trend":
                "STABLE",

            "risk":
                "medium",

            **action

        }


    # =====================================================
    # LATEST FEATURE ROW
    # =====================================================

    latest = feature_history.iloc[-1:]


    X = latest[
        COOLING_FEATURES
    ]


    # =====================================================
    # TEMPERATURE MODEL
    #
    # IMPORTANT:
    #
    # Temperature prediction happens FIRST.
    #
    # Cooling model is NOT required for this.
    # =====================================================

    try:

        temperature_model = (
            load_temperature_model()
        )


        future_temperatures = (
            predict_future_temperature(
                temperature_model,
                X
            )
        )


        future_temperatures = [

            round(
                float(value),
                2
            )

            for value in future_temperatures

            if value is not None

        ]


    except Exception as e:

        print(
            "[PREDICTION] "
            f"Temperature prediction failed: {e}"
        )


        return {

            "inside_temperature":
                float(inside_temp),

            "outside_temperature":
                float(outside_temp),

            "mode":
                "ML_CONTROL",

            "prediction_status":
                "PREDICTION_ERROR",

            "history_count":
                history_count,

            "future_temperatures":
                [],

            "trend":
                "STABLE",

            "risk":
                "medium",

            "message":
                str(e)

        }


    # =====================================================
    # CHECK ACTUAL PREDICTION OUTPUT
    # =====================================================

    if not future_temperatures:

        return {

            "inside_temperature":
                float(inside_temp),

            "outside_temperature":
                float(outside_temp),

            "mode":
                "ML_CONTROL",

            "prediction_status":
                "NO_FORECAST",

            "history_count":
                history_count,

            "future_temperatures":
                [],

            "trend":
                "STABLE",

            "risk":
                "medium",

            "message":
                "Temperature model returned no future predictions."

        }


    # =====================================================
    # TREND
    # =====================================================

    trend = determine_trend(
        inside_temp,
        future_temperatures
    )


    # =====================================================
    # ML COOLING LEVEL
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
    # PROJECTED RANGE
    #
    # Explicitly calculated from future predictions.
    # =====================================================

    projected_min = min(
        future_temperatures
    )

    projected_max = max(
        future_temperatures
    )


    # =====================================================
    # FINAL RESPONSE
    # =====================================================

    return {

        "inside_temperature":
            float(inside_temp),

        "outside_temperature":
            float(outside_temp),

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

        "trend":
            trend,

        "future_temperatures":
            future_temperatures,

        "projected_min":
            projected_min,

        "projected_max":
            projected_max,

        "future_points":
            len(
                future_temperatures
            )

    }