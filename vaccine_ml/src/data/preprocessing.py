import os
import pandas as pd

from src.config import (
    PROCESSED_DATA_PATH,
    FUTURE_POINTS
)


# =========================================================
# CREATE FEATURES
# =========================================================

def create_features(df):

    df = df.copy()


    # =====================================================
    # TIMESTAMP
    # =====================================================

    df["timestamp"] = (
        pd.to_datetime(
            df["timestamp"],
            errors="coerce",
            utc=True
        )
        .dt
        .tz_localize(None)
    )


    # =====================================================
    # REQUIRED SENSOR DATA
    # =====================================================

    df = df.dropna(
        subset=[
            "timestamp",
            "inside_temp",
            "outside_temp"
        ]
    )


    # =====================================================
    # CHRONOLOGICAL ORDER
    # =====================================================

    df = (
        df
        .sort_values(
            "timestamp"
        )
        .reset_index(
            drop=True
        )
    )


    # =====================================================
    # INSIDE TEMPERATURE LAGS
    #
    # Cooling model requires:
    #
    # inside_lag_1
    # inside_lag_2
    # inside_lag_5
    # inside_lag_10
    # =====================================================

    for lag in [1, 2, 5, 10]:

        df[f"inside_lag_{lag}"] = (
            df["inside_temp"].shift(lag)
        )


    # =====================================================
    # OUTSIDE TEMPERATURE LAGS
    #
    # Cooling model requires:
    #
    # outside_lag_1
    # outside_lag_5
    # =====================================================

    for lag in [1, 5]:

        df[f"outside_lag_{lag}"] = (
            df["outside_temp"].shift(lag)
        )


    # =====================================================
    # INSIDE TEMPERATURE CHANGES
    # =====================================================

    df["inside_change_1"] = (
        df["inside_temp"]
        -
        df["inside_lag_1"]
    )


    df["inside_change_5"] = (
        df["inside_temp"]
        -
        df["inside_lag_5"]
    )


    # =====================================================
    # OUTSIDE TEMPERATURE CHANGES
    # =====================================================

    df["outside_change_1"] = (
        df["outside_temp"]
        -
        df["outside_lag_1"]
    )


    df["outside_change_5"] = (
        df["outside_temp"]
        -
        df["outside_lag_5"]
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
# We keep both:
#
# PRE_COOLING
# ML_CONTROL
#
# because the temperature can rise again during travel.
# =========================================================

def create_cooling_dataset(df):

    df = create_features(
        df
    )


    # =====================================================
    # REQUIRED COLUMNS
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
    # VALID INSIDE TEMPERATURE
    # =====================================================

    df = df[
        df["inside_temp"].between(
            -20,
            60
        )
    ]


    # =====================================================
    # VALID OUTSIDE TEMPERATURE
    # =====================================================

    df = df[
        df["outside_temp"].between(
            -40,
            70
        )
    ]


    # =====================================================
    # VALID COOLING LEVEL
    #
    # 0 = OFF
    # 1 = LOW
    # 2 = HIGH
    # =====================================================

    df = df[
        df["cooling_level"].isin(
            [0, 1, 2]
        )
    ]


    # =====================================================
    # REMOVE ROWS WITHOUT FEATURE HISTORY
    #
    # We need 10 previous readings because the model
    # uses inside_lag_10.
    # =====================================================

    df = df.dropna()


    # =====================================================
    # SAVE PROCESSED DATASET
    # =====================================================

    processed_directory = (
        os.path.dirname(
            PROCESSED_DATA_PATH
        )
    )


    if processed_directory:

        os.makedirs(
            processed_directory,
            exist_ok=True
        )


    df.to_csv(
        PROCESSED_DATA_PATH,
        index=False
    )


    return df


# =========================================================
# CREATE FUTURE TEMPERATURE TARGETS
#
# FUTURE_POINTS = 20
#
# Creates:
#
# future_1
# future_2
# ...
# future_20
# =========================================================

def create_future_targets(df):

    df = df.copy()


    for i in range(
        1,
        FUTURE_POINTS + 1
    ):

        df[f"future_{i}"] = (
            df["inside_temp"]
            .shift(-i)
        )


    return df