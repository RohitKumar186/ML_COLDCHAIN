import os
import pandas as pd

from src.config import (
    LAG_VALUES,
    PROCESSED_DATA_PATH,
    FUTURE_POINTS
)


def create_features(df):

    df = df.copy()

    df = df.sort_values(
        "timestamp"
    ).reset_index(drop=True)

    # -------------------------
    # Inside temperature lags
    # -------------------------

    for lag in LAG_VALUES:

        df[f"inside_lag_{lag}"] = (
            df["inside_temp"].shift(lag)
        )

    # -------------------------
    # Outside temperature lags
    # -------------------------

    for lag in [1, 5]:

        df[f"outside_lag_{lag}"] = (
            df["outside_temp"].shift(lag)
        )

    # -------------------------
    # Temperature trends
    # -------------------------

    df["inside_change_1"] = (
        df["inside_temp"]
        - df["inside_lag_1"]
    )

    df["inside_change_5"] = (
        df["inside_temp"]
        - df["inside_lag_5"]
    )

    df["outside_change_1"] = (
        df["outside_temp"]
        - df["outside_lag_1"]
    )

    df["outside_change_5"] = (
        df["outside_temp"]
        - df["outside_lag_5"]
    )

    # -------------------------
    # Time features
    # -------------------------

    df["hour"] = df["timestamp"].dt.hour

    df["minute"] = df["timestamp"].dt.minute

    return df


def create_cooling_dataset(df):

    df = create_features(df)

    # ML should primarily learn from ML_CONTROL
    df = df[
        df["mode"] == "ML_CONTROL"
    ].copy()

    df = df.dropna()

    os.makedirs(
        os.path.dirname(PROCESSED_DATA_PATH),
        exist_ok=True
    )

    df.to_csv(
        PROCESSED_DATA_PATH,
        index=False
    )

    return df


def create_future_targets(df):

    df = df.copy()

    # Future inside temperature

    for i in range(1, FUTURE_POINTS + 1):

        df[f"future_{i}"] = (
            df["inside_temp"].shift(-i)
        )

    return df