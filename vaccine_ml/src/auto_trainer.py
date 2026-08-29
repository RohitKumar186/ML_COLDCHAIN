import os
import threading

import pandas as pd

from src.config import (
    PROCESSED_DATA_PATH,
    COOLING_MODEL_PATH,
    TEMPERATURE_MODEL_PATH
)

from src.data.preprocessing import (
    create_cooling_dataset
)

from src.models.cooling_model import (
    train_cooling_model
)

from src.models.temperature_model import (
    train_temperature_model
)


# =========================================================
# CONFIGURATION
# =========================================================

RETRAIN_EVERY = 100

MIN_TRAINING_ROWS = 30


# =========================================================
# STATE
# =========================================================

_lock = threading.Lock()

_last_trained_count = 0

_training = False


# =========================================================
# PREPARE HISTORY
# =========================================================

def prepare_training_data(history):

    if not history:

        return pd.DataFrame()


    rows = []


    for item in history:

        try:

            timestamp = pd.to_datetime(
                item.get("timestamp"),
                errors="coerce",
                utc=True
            )


            inside_temp = float(
                item.get("inside_temp")
            )


            outside_temp = float(
                item.get("outside_temp")
            )


            cooling_level = int(
                item.get(
                    "cooling_level",
                    0
                )
            )


            if pd.isna(timestamp):

                continue


            if not (
                -20
                <= inside_temp
                <= 60
            ):

                continue


            if not (
                -40
                <= outside_temp
                <= 70
            ):

                continue


            rows.append({

                "timestamp":
                    timestamp,

                "inside_temp":
                    inside_temp,

                "outside_temp":
                    outside_temp,

                "cooling_level":
                    cooling_level,

                "mode":
                    (
                        "PRE_COOLING"
                        if inside_temp > 12
                        else "ML_CONTROL"
                    )

            })

        except (
            TypeError,
            ValueError
        ):

            continue


    if not rows:

        return pd.DataFrame()


    df = pd.DataFrame(
        rows
    )


    df["timestamp"] = (
        pd.to_datetime(
            df["timestamp"],
            utc=True
        )
        .dt
        .tz_localize(None)
    )


    return (
        df
        .sort_values("timestamp")
        .drop_duplicates(
            subset=["timestamp"],
            keep="last"
        )
        .reset_index(drop=True)
    )


# =========================================================
# TRAIN FROM HISTORY
# =========================================================

def train_from_history(history):

    global _last_trained_count
    global _training


    with _lock:

        if _training:

            print(
                "[AUTO TRAIN] "
                "Training already running."
            )

            return False


        _training = True


    try:

        df = prepare_training_data(
            history
        )


        if df.empty:

            print(
                "[AUTO TRAIN] "
                "No valid training data."
            )

            return False


        valid_count = len(df)


        print()
        print("=" * 60)
        print("          AUTOMATIC MODEL TRAINING")
        print("=" * 60)

        print(
            f"Valid readings: {valid_count}"
        )


        if valid_count < MIN_TRAINING_ROWS:

            print(
                f"Need at least "
                f"{MIN_TRAINING_ROWS} "
                f"rows."
            )

            return False


        # =================================================
        # CREATE PROCESSED DATASET
        # =================================================

        processed = (
            create_cooling_dataset(
                df
            )
        )


        if processed.empty:

            print(
                "[AUTO TRAIN] "
                "Processed dataset empty."
            )

            return False


        print(
            f"Training rows: "
            f"{len(processed)}"
        )


        # =================================================
        # TRAIN COOLING MODEL
        # =================================================

        print()
        print(
            "[AUTO TRAIN] "
            "Training cooling model..."
        )


        train_cooling_model()


        # =================================================
        # TRAIN TEMPERATURE MODEL
        # =================================================

        print()
        print(
            "[AUTO TRAIN] "
            "Training temperature model..."
        )


        train_temperature_model(
            processed
        )


        _last_trained_count = valid_count


        print()
        print(
            "[AUTO TRAIN] "
            "Models successfully updated."
        )

        print(
            f"Cooling model: "
            f"{COOLING_MODEL_PATH}"
        )

        print(
            f"Temperature model: "
            f"{TEMPERATURE_MODEL_PATH}"
        )

        print("=" * 60)


        return True


    except Exception as e:

        print(
            "[AUTO TRAIN] "
            f"Training failed: {e}"
        )

        return False


    finally:

        with _lock:

            _training = False


# =========================================================
# CHECK WHETHER RETRAINING IS REQUIRED
# =========================================================

def should_retrain(history):

    global _last_trained_count


    df = prepare_training_data(
        history
    )


    if df.empty:

        return False


    valid_count = len(df)


    if valid_count < MIN_TRAINING_ROWS:

        return False


    # First training

    if not os.path.exists(
        COOLING_MODEL_PATH
    ):

        return True


    if not os.path.exists(
        TEMPERATURE_MODEL_PATH
    ):

        return True


    # New data threshold

    if (
        valid_count
        - _last_trained_count
        >= RETRAIN_EVERY
    ):

        return True


    return False


# =========================================================
# AUTOMATIC TRAINING TRIGGER
# =========================================================

def maybe_retrain(history):

    if not should_retrain(
        history
    ):

        return


    print(
        "[AUTO TRAIN] "
        "New training data threshold reached."
    )


    thread = threading.Thread(

        target=train_from_history,

        args=(history,),

        daemon=True

    )


    thread.start()