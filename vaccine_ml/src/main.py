from datetime import datetime

import pandas as pd

from src.data.storage import (
    save_sensor_data,
    load_sensor_data
)

from src.data.preprocessing import (
    create_features,
    create_cooling_dataset
)

from src.models.cooling_model import (
    train_cooling_model,
    load_cooling_model,
    predict_cooling_level,
    FEATURES as COOLING_FEATURES
)

from src.models.temperature_model import (
    train_temperature_model,
    load_temperature_model,
    predict_future_temperature
)

from src.control.controller import (
    determine_mode,
    pre_cooling_action,
    cooling_action,
    determine_trend
)


def train_models():

    print("\nPreparing training data...")

    df = load_sensor_data()

    create_cooling_dataset(df)

    print("\nTraining cooling model...")

    cooling_model = train_cooling_model()

    print("\nTraining temperature model...")

    temperature_model = train_temperature_model(
        df
    )

    print("\nTraining completed.")


def predict(
    inside_temp,
    outside_temp
):

    df = load_sensor_data()

    # Add current reading temporarily
    current = pd.DataFrame([
        {
            "timestamp": datetime.now(),
            "inside_temp": inside_temp,
            "outside_temp": outside_temp
        }
    ])

    history = pd.concat(
        [
            df,
            current
        ],
        ignore_index=True
    )

    history = create_features(
        history
    )

    latest = history.iloc[-1:]

    mode = determine_mode(
        inside_temp
    )

    # -------------------------
    # PRE-COOLING
    # -------------------------

    if mode == "PRE_COOLING":

        action = pre_cooling_action()

        return {
            "inside_temperature": inside_temp,
            "outside_temperature": outside_temp,
            "mode": mode,
            **action
        }

    # -------------------------
    # ML CONTROL
    # -------------------------

    cooling_model = load_cooling_model()

    temperature_model = load_temperature_model()

    X = latest[
        COOLING_FEATURES
    ]

    level = predict_cooling_level(
        cooling_model,
        X
    )

    future_temperatures = (
        predict_future_temperature(
            temperature_model,
            X
        )
    )

    trend = determine_trend(
        inside_temp,
        future_temperatures
    )

    action = cooling_action(
        level
    )

    return {
        "inside_temperature": inside_temp,
        "outside_temperature": outside_temp,
        "mode": mode,
        **action,
        "future_temperatures":
            future_temperatures,
        "trend": trend
    }


if __name__ == "__main__":

    print(
        "Vaccine Cooling ML System"
    )

    print(
        "1. Train models"
    )

    print(
        "2. Predict"
    )

    choice = input(
        "\nSelect option: "
    )

    if choice == "1":

        train_models()

    elif choice == "2":

        inside = float(
            input(
                "Inside temperature: "
            )
        )

        outside = float(
            input(
                "Outside temperature: "
            )
        )

        result = predict(
            inside,
            outside
        )

        print("\nPrediction")
        print("================")

        for key, value in result.items():

            print(
                f"{key}: {value}"
            )