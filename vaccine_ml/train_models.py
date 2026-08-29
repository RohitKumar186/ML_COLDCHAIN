import os
import pandas as pd

from src.config import (
    PROCESSED_DATA_PATH
)

from src.models.cooling_model import (
    train_cooling_model
)

from src.models.temperature_model import (
    train_temperature_model
)


def train_all_models():

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


    if df.empty:

        raise ValueError(
            "Training dataset is empty."
        )


    # =====================================================
    # COOLING MODEL
    # =====================================================

    print()
    print("=" * 60)
    print("TRAINING COOLING MODEL")
    print("=" * 60)


    cooling_model = (
        train_cooling_model()
    )


    print(
        "Cooling model training completed."
    )


    # =====================================================
    # TEMPERATURE MODEL
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

    print(
        "Cooling model saved to:"
    )

    print(
        "models/cooling_model.pkl"
    )

    print(
        "Temperature model saved to:"
    )

    print(
        "models/temperature_model.pkl"
    )

    print(
        "Models are ready for prediction."
    )


    return {
        "cooling_model": cooling_model,
        "temperature_model": temperature_model
    }


def main():

    train_all_models()


if __name__ == "__main__":

    main()