import os
import pandas as pd

from src.config import PROCESSED_DATA_PATH
from src.data.preprocessing import create_cooling_dataset


RAW_DATA_PATH = "data/raw/sensor_data.csv"


def main():

    print("=" * 60)
    print("       BUILDING ML TRAINING DATASET")
    print("=" * 60)

    # =====================================================
    # CHECK RAW DATA
    # =====================================================

    if not os.path.exists(RAW_DATA_PATH):
        raise FileNotFoundError(
            f"Raw sensor data not found: {RAW_DATA_PATH}"
        )

    # =====================================================
    # LOAD RAW DATA
    # =====================================================

    df = pd.read_csv(RAW_DATA_PATH)

    if df.empty:
        raise ValueError(
            "Raw sensor dataset is empty."
        )

    print(f"Raw rows: {len(df)}")

    # =====================================================
    # DATETIME
    # =====================================================

    df["timestamp"] = pd.to_datetime(
        df["timestamp"]
    )

    # =====================================================
    # CREATE FEATURES
    # =====================================================

    processed = create_cooling_dataset(df)

    # =====================================================
    # CHECK RESULT
    # =====================================================

    if processed.empty:
        raise ValueError(
            "No usable ML_CONTROL rows after preprocessing."
        )

    print(
        f"Processed training rows: "
        f"{len(processed)}"
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