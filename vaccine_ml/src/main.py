import os
from datetime import datetime

import pandas as pd

from src.config import (
    MIN_HISTORY_READINGS,
    COOLING_MODEL_PATH,
    TEMPERATURE_MODEL_PATH
)

from src.data.storage import load_sensor_data

from src.data.preprocessing import create_features

from src.models.cooling_model import (
    load_cooling_model,
    predict_cooling_level,
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


def predict(
    inside_temp,
    outside_temp
):

    # =====================================================
    # LOAD SENSOR HISTORY
    # =====================================================

    df = load_sensor_data()

    # =====================================================
    # CURRENT READING
    # =====================================================

    current = pd.DataFrame([
        {
            "timestamp": datetime.now(),
            "inside_temp": inside_temp,
            "outside_temp": outside_temp,
            "mode": determine_mode(inside_temp)
        }
    ])

    history = pd.concat(
        [df, current],
        ignore_index=True
    )

    # =====================================================
    # CURRENT MODE
    # =====================================================

    mode = determine_mode(
        inside_temp
    )

    # =====================================================
    # PRE-COOLING
    # Temperature > 12°C
    # =====================================================

    if mode == "PRE_COOLING":

        action = pre_cooling_action()

        return {
            "inside_temperature": inside_temp,
            "outside_temperature": outside_temp,
            "mode": "PRE_COOLING",
            "prediction_status": "WAITING",
            "future_temperatures": [],
            "trend": "STABLE",
            **action
        }

    # =====================================================
    # ML HISTORY
    # =====================================================

    ml_history = history[
        history["mode"] == "ML_CONTROL"
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

        # Use the actual temperature-based
        # cooling logic instead of always HIGH.

        level = determine_cooling_level(
            inside_temp
        )

        action = cooling_action(
            level
        )

        return {
            "inside_temperature": inside_temp,
            "outside_temperature": outside_temp,
            "mode": "ML_CONTROL",
            "prediction_status":
                "COLLECTING_HISTORY",
            "history_count":
                history_count,
            "required_history":
                MIN_HISTORY_READINGS,
            "future_temperatures": [],
            "trend": "STABLE",
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

        return {
            "inside_temperature": inside_temp,
            "outside_temperature": outside_temp,
            "mode": "ML_CONTROL",
            "prediction_status":
                "MODEL_NOT_TRAINED",
            "history_count":
                history_count,
            "future_temperatures": [],
            "trend": "STABLE",
            "message":
                "Collect training data and train models first."
        }

    # =====================================================
    # CREATE FEATURES
    # =====================================================

    feature_history = create_features(
        history
    )

    latest = feature_history.iloc[-1:]

    X = latest[
        COOLING_FEATURES
    ]

    # =====================================================
    # LOAD XGBOOST MODELS
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
    # > 12°C  → Level 2
    # 8–12°C  → Level 1
    # < 8°C   → Level 0
    #
    # Temperature logic is authoritative.
    # =====================================================

    level = determine_cooling_level(
        inside_temp
    )

    # =====================================================
    # FUTURE TEMPERATURES
    # =====================================================

    future_temperatures = (
        predict_future_temperature(
            temperature_model,
            X
        )
    )

    # =====================================================
    # TREND
    # =====================================================

    trend = determine_trend(
        inside_temp,
        future_temperatures
    )

    # =====================================================
    # ACTION
    # =====================================================

    action = cooling_action(
        level
    )

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

        **action,

        "future_temperatures":
            future_temperatures,

        "trend":
            trend,

        "history_count":
            history_count
    }