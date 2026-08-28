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
    determine_trend
)

def predict(
    inside_temp,
    outside_temp
):

    df = load_sensor_data()

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

    mode = determine_mode(
        inside_temp
    )

    # =========================================
    # PRE-COOLING
    # =========================================

    if mode == "PRE_COOLING":

        action = pre_cooling_action()

        return {
            "inside_temperature": inside_temp,
            "outside_temperature": outside_temp,
            "mode": "PRE_COOLING",
            "prediction_status": "WAITING",
            **action
        }

    # =========================================
    # ML HISTORY
    # =========================================

    ml_history = history[
        history["mode"] == "ML_CONTROL"
    ].copy()

    history_count = len(
        ml_history
    )

    if not has_enough_history(
        history_count
    ):

        action = pre_cooling_action()

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
            **action
        }

    # =========================================
    # CHECK MODEL
    # =========================================

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
            "message":
                "Collect training data and train models first."
        }

    # =========================================
    # FEATURES
    # =========================================

    feature_history = create_features(
        history
    )

    latest = feature_history.iloc[-1:]

    X = latest[
        COOLING_FEATURES
    ]

    # =========================================
    # LOAD XGBOOST MODELS
    # =========================================

    cooling_model = (
        load_cooling_model()
    )

    temperature_model = (
        load_temperature_model()
    )

    # =========================================
    # COOLING LEVEL
    # =========================================

    level = predict_cooling_level(
        cooling_model,
        X
    )

    # =========================================
    # FUTURE TEMPERATURES
    # =========================================

    future_temperatures = (
        predict_future_temperature(
            temperature_model,
            X
        )
    )

    # =========================================
    # TREND
    # =========================================

    trend = determine_trend(
        inside_temp,
        future_temperatures
    )

    # =========================================
    # ACTION
    # =========================================

    action = cooling_action(
        level
    )

    return {
        "inside_temperature": inside_temp,
        "outside_temperature": outside_temp,
        "mode": "ML_CONTROL",
        "prediction_status": "ACTIVE",
        **action,
        "future_temperatures":
            future_temperatures,
        "trend": trend,
        "history_count":
            history_count
    }