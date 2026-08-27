import os
import joblib
import pandas as pd

from xgboost import XGBRegressor

from sklearn.multioutput import MultiOutputRegressor
from sklearn.metrics import mean_absolute_error

from src.config import (
    FUTURE_POINTS,
    TEMPERATURE_MODEL_PATH
)


FEATURES = [
    "inside_temp",

    "outside_temp",

    "inside_lag_1",
    "inside_lag_2",
    "inside_lag_5",
    "inside_lag_10",

    "outside_lag_1",
    "outside_lag_5",

    "inside_change_1",
    "inside_change_5",

    "outside_change_1",
    "outside_change_5",

    "hour",
    "minute"
]


TARGETS = [
    f"future_{i}"
    for i in range(1, FUTURE_POINTS + 1)
]


def train_temperature_model(df):

    df = df.copy()

    # Only ML control data

    df = df[
        df["mode"] == "ML_CONTROL"
    ].copy()

    # Create future targets

    for i in range(
        1,
        FUTURE_POINTS + 1
    ):

        df[f"future_{i}"] = (
            df["inside_temp"].shift(-i)
        )

    df = df.dropna()

    X = df[FEATURES]

    y = df[TARGETS]

    split = int(
        len(df) * 0.8
    )

    X_train = X.iloc[:split]
    X_test = X.iloc[split:]

    y_train = y.iloc[:split]
    y_test = y.iloc[split:]

    base_model = XGBRegressor(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=5,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="reg:squarederror",
        random_state=42
    )

    model = MultiOutputRegressor(
        base_model
    )

    model.fit(
        X_train,
        y_train
    )

    predictions = model.predict(
        X_test
    )

    mae = mean_absolute_error(
        y_test,
        predictions
    )

    print("\nFuture Temperature Model")
    print("========================")
    print(
        f"Average MAE: {mae:.3f} °C"
    )

    os.makedirs(
        os.path.dirname(
            TEMPERATURE_MODEL_PATH
        ),
        exist_ok=True
    )

    joblib.dump(
        model,
        TEMPERATURE_MODEL_PATH
    )

    print(
        f"Model saved: {TEMPERATURE_MODEL_PATH}"
    )

    return model


def load_temperature_model():

    return joblib.load(
        TEMPERATURE_MODEL_PATH
    )


def predict_future_temperature(
    model,
    feature_data
):

    prediction = model.predict(
        feature_data
    )

    return prediction[0].tolist()