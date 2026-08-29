import os
import pandas as pd

from src.config import PROCESSED_DATA_PATH

from src.data.preprocessing import (
    create_cooling_dataset
)


RAW_DATA_PATH = (
    "data/raw/sensor_data.csv"
)


def main():

    print("=" * 60)
    print("       BUILDING ML TRAINING DATASET")
    print("=" * 60)


    # =====================================================
    # CHECK RAW DATA
    # =====================================================

    if not os.path.exists(
        RAW_DATA_PATH
    ):

        raise FileNotFoundError(
            f"Raw sensor data not found: "
            f"{RAW_DATA_PATH}"
        )


    # =====================================================
    # LOAD RAW DATA
    # =====================================================

    df = pd.read_csv(
        RAW_DATA_PATH
    )


    if df.empty:

        raise ValueError(
            "Raw sensor dataset is empty."
        )


    print(
        f"Raw rows: {len(df)}"
    )


    # =====================================================
    # DATETIME
    # =====================================================

    df["timestamp"] = pd.to_datetime(
        df["timestamp"],
        errors="coerce",
        utc=True
    ).dt.tz_localize(None)


    # =====================================================
    # VALID SENSOR DATA
    # =====================================================

    before = len(df)


    df = df.dropna(
        subset=[
            "timestamp",
            "inside_temp",
            "outside_temp",
            "cooling_level"
        ]
    )


    removed = (
        before - len(df)
    )


    print(
        f"Invalid rows removed: {removed}"
    )


    # =====================================================
    # CREATE FEATURES
    #
    # IMPORTANT:
    # ALL VALID TEMPERATURE DATA IS USED.
    # =====================================================

    processed = (
        create_cooling_dataset(
            df
        )
    )


    # =====================================================
    # CHECK RESULT
    # =====================================================

    if processed.empty:

        raise ValueError(
            "No usable training rows "
            "after preprocessing."
        )


    print(
        f"Processed training rows: "
        f"{len(processed)}"
    )


    print(
        f"Temperature range: "
        f"{processed['inside_temp'].min():.2f} "
        f"to "
        f"{processed['inside_temp'].max():.2f} °C"
    )


    print(
        f"Outside temperature range: "
        f"{processed['outside_temp'].min():.2f} "
        f"to "
        f"{processed['outside_temp'].max():.2f} °C"
    )


    print(
        f"Saved to: "
        f"{PROCESSED_DATA_PATH}"
    )


    print("=" * 60)
    print("       TRAINING DATASET READY")
    print("=" * 60)


if __name__ == "__main__":

    main()