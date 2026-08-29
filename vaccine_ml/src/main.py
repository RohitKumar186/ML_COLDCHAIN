import os
from datetime import datetime

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
    determine_cooling_level,
    determine_trend
)


# =========================================================
# PREDICT
#
# Current ESP32 reading
#        +
# Recent PostgreSQL history
#        ↓
# Feature generation
#        ↓
# ML prediction
#        ↓
# Cooling decision
# =========================================================

def predict(
    inside_temp,
    outside_temp,
    history=None
):

    # =====================================================
    # HISTORY
    # =====================================================

    if history is None:
        history = []


    # =====================================================
    # CONVERT LIVE HISTORY TO DATAFRAME
    # =====================================================

    history_rows = []

    for item in history:

        try:

            timestamp = pd.to_datetime(
                item.get("timestamp")
            )

            inside_value = float(
                item.get("inside_temp")
            )

            outside_value = float(
                item.get("outside_temp")
            )

            mode_value = item.get("mode")


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

            # Ignore invalid history rows
            continue


    # =====================================================
    # CURRENT READING
    # =====================================================

    current = pd.DataFrame([
        {
            "timestamp": datetime.now(),

            "inside_temp":
                float(inside_temp),

            "outside_temp":
                float(outside_temp),

            "mode":
                determine_mode(
                    inside_temp
                )
        }
    ])


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


    # =====================================================
    # CURRENT MODE
    # =====================================================

    mode = determine_mode(
        inside_temp
    )


    # =====================================================
    # PRE-COOLING
    #
    # > 12°C
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

    ml_history = full_history[
        full_history["mode"] ==
        "ML_CONTROL"
    ].copy()


    history_count = len(
        ml_history
    )


    # =====================================================
    # NOT ENOUGH HISTORY
    # =====================================================

    if not has_enough_history(
        history_count
    ):

        level = determine_cooling_level(
            inside_temp
        )

        action = cooling_action(
            level
        )


        # -------------------------------------------------
        # RISK
        # 0 → LOW
        # 1 → MEDIUM
        # 2 → HIGH
        # -------------------------------------------------

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

            "future_temperatures":
                [],

            "trend":
                "STABLE",

            "risk":
                risk,

            **action
        }


    # =====================================================
    # CHECK MODEL FILES
    # =====================================================

    if (
        not os.path.exists(
            COOLING_MODEL_PATH
        )
        or
        not os.path.exists(
            TEMPERATURE_MODEL_PATH
        )
    ):

        level = determine_cooling_level(
            inside_temp
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

            "future_temperatures":
                [],

            "trend":
                "STABLE",

            "risk":
                risk,

            "message":
                "Models are not trained yet.",

            **action
        }


    # =====================================================
    # CREATE FEATURES
    # =====================================================

    feature_history = create_features(
        full_history
    )


    # =====================================================
    # KEEP ONLY VALID FEATURE ROWS
    # =====================================================

    feature_history = feature_history.dropna(
        subset=COOLING_FEATURES
    )


    # =====================================================
    # FEATURE HISTORY NOT READY
    # =====================================================

    if feature_history.empty:

        level = determine_cooling_level(
            inside_temp
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

            "future_temperatures":
                [],

            "trend":
                "STABLE",

            "risk":
                risk,

            **action
        }


    # =====================================================
    # LATEST FEATURE ROW
    # =====================================================

    latest = feature_history.iloc[
        -1:
    ]


    X = latest[
        COOLING_FEATURES
    ]


    # =====================================================
    # LOAD TRAINED MODELS
    # =====================================================

    cooling_model = (
        load_cooling_model()
    )

    temperature_model = (
        load_temperature_model()
    )


    # =====================================================
    # COOLING LEVEL
    #
    # Current temperature is authoritative:
    #
    # > 12°C → Level 2
    # 8–12°C → Level 1
    # < 8°C  → Level 0
    # =====================================================

    level = determine_cooling_level(
        inside_temp
    )


    # =====================================================
    # FUTURE TEMPERATURE PREDICTION
    # =====================================================

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
    ]


    # =====================================================
    # TREND
    # =====================================================

    trend = determine_trend(
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
    #
    # 0 → LOW
    # 1 → MEDIUM
    # 2 → HIGH
    # =====================================================

    if level == 0:

        risk = "low"

    elif level == 1:

        risk = "medium"

    else:

        risk = "high"


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

        "risk":
            risk,

        "future_temperatures":
            future_temperatures,

        "trend":
            trend,

        **action
    }