import os
import pandas as pd

from src.config import PROCESSED_DATA_PATH

from src.models.cooling_model import (
    train_cooling_model
)

from src.models.temperature_model import (
    train_temperature_model
)


def main():

    print("=" * 60)
    print("        VACCINE ML MODEL TRAINING")
    print("=" * 60)


    # =====================================================
    # CHECK TRAINING DATA
    # =====================================================

    if not os.path.exists(
        PROCESSED_DATA_PATH
    ):

        raise FileNotFoundError(
            f"Training data not found: "
            f"{PROCESSED_DATA_PATH}"
        )


    # =====================================================
    # LOAD DATA
    # =====================================================

    df = pd.read_csv(
        PROCESSED_DATA_PATH
    )


    print()
    print(
        f"Training data: "
        f"{PROCESSED_DATA_PATH}"
    )

    print(
        f"Total rows: {len(df)}"
    )

    print(
        f"Columns: {len(df.columns)}"
    )


    # =====================================================
    # CHECK REQUIRED DATA
    # =====================================================

    if len(df) == 0:

        raise ValueError(
            "Training dataset is empty."
        )


    print()
    print("=" * 60)
    print("TRAINING COOLING MODEL")
    print("=" * 60)


    # =====================================================
    # TRAIN COOLING MODEL
    # =====================================================

    cooling_model = (
        train_cooling_model()
    )


    print()
    print(
        "Cooling model training completed."
    )


    # =====================================================
    # TRAIN TEMPERATURE MODEL
    # =====================================================

    print()
    print("=" * 60)
    print("TRAINING TEMPERATURE MODEL")
    print("=" * 60)


    temperature_model = (
        train_temperature_model(
            df
        )
    )


    print()
    print(
        "Temperature model training completed."
    )


    # =====================================================
    # FINAL
    # =====================================================

    print()
    print("=" * 60)
    print("        TRAINING COMPLETED")
    print("=" * 60)

    print()
    print(
        "Cooling model saved to:"
    )

    print(
        "models/cooling_model.pkl"
    )

    print()

    print(
        "Temperature model saved to:"
    )

    print(
        "models/temperature_model.pkl"
    )

    print()
    print(
        "Models are ready for prediction."
    )


if __name__ == "__main__":

    main()