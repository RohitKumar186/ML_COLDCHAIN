import os
import pandas as pd

from src.config import (
    LAG_VALUES,
    PROCESSED_DATA_PATH,
    FUTURE_POINTS
)


# =========================================================
# CREATE FEATURES
# =========================================================

def create_features(df):

    df = df.copy()

    df["timestamp"] = pd.to_datetime(
        df["timestamp"],
        errors="coerce",
        utc=True
    ).dt.tz_localize(None)

    df = df.dropna(
        subset=[
            "timestamp",
            "inside_temp",
            "outside_temp"
        ]
    )

    df = df.sort_values(
        "timestamp"
    ).reset_index(drop=True)


    # =====================================================
    # INSIDE TEMPERATURE LAGS
    # =====================================================

    for lag in LAG_VALUES:

        df[f"inside_lag_{lag}"] = (
            df["inside_temp"].shift(lag)
        )


    # =====================================================
    # OUTSIDE TEMPERATURE LAGS
    # =====================================================

    for lag in [1, 5]:

        df[f"outside_lag_{lag}"] = (
            df["outside_temp"].shift(lag)
        )


    # =====================================================
    # TEMPERATURE CHANGES
    # =====================================================

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


    # =====================================================
    # TIME FEATURES
    # =====================================================

    df["hour"] = (
        df["timestamp"].dt.hour
    )

    df["minute"] = (
        df["timestamp"].dt.minute
    )


    return df


# =========================================================
# CREATE COOLING DATASET
#
# IMPORTANT:
#
# DO NOT FILTER ML_CONTROL HERE.
#
# We want:
#
# 10°C  → collect
# 11°C  → collect
# 12°C  → collect
# 13°C  → collect
# 14°C  → collect
#
# because the box can warm up during travel.
# =========================================================

def create_cooling_dataset(df):

    df = create_features(df)


    # =====================================================
    # VALID SENSOR DATA ONLY
    # =====================================================

    required_columns = [
        "inside_temp",
        "outside_temp",
        "cooling_level"
    ]

    df = df.dropna(
        subset=required_columns
    )


    # =====================================================
    # VALID TEMPERATURE RANGE
    # =====================================================

    df = df[
        df["inside_temp"].between(
            -20,
            60
        )
    ]

    df = df[
        df["outside_temp"].between(
            -40,
            70
        )
    ]


    # =====================================================
    # REMOVE ROWS WITHOUT FEATURE HISTORY
    # =====================================================

    df = df.dropna()


    # =====================================================
    # SAVE
    # =====================================================

    os.makedirs(
        os.path.dirname(
            PROCESSED_DATA_PATH
        ),
        exist_ok=True
    )

    df.to_csv(
        PROCESSED_DATA_PATH,
        index=False
    )


    return df


# =========================================================
# FUTURE TEMPERATURE TARGETS
# =========================================================

def create_future_targets(df):

    df = df.copy()

    for i in range(
        1,
        FUTURE_POINTS + 1
    ):

        df[f"future_{i}"] = (
            df["inside_temp"].shift(-i)
        )

    return df