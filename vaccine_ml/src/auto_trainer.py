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
# CHECK MODEL FILE
#
# exists() alone is NOT enough.
#
# A 0-byte .pkl file technically exists, but it is not
# a valid trained model.
# =========================================================

def valid_model_file(path):

    return (
        os.path.isfile(path)
        and os.path.getsize(path) > 0
    )


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


    # =====================================================
    # NORMALIZE TIMESTAMP
    # =====================================================

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

        .sort_values(
            "timestamp"
        )

        .drop_duplicates(
            subset=["timestamp"],
            keep="last"
        )

        .reset_index(
            drop=True
        )
    )


# =========================================================
# TRAIN FROM HISTORY
# =========================================================

def train_from_history(history):

    global _last_trained_count
    global _training


    # =====================================================
    # PREVENT TWO TRAINING JOBS AT ONCE
    # =====================================================

    with _lock:

        if _training:

            print(
                "[AUTO TRAIN] "
                "Training already running."
            )

            return False


        _training = True


    try:

        # =================================================
        # PREPARE RAW HISTORY
        # =================================================

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
        print(
            "       AUTOMATIC MODEL TRAINING"
        )
        print("=" * 60)


        print(
            f"Valid readings: "
            f"{valid_count}"
        )


        # =================================================
        # MINIMUM DATA CHECK
        # =================================================

        if valid_count < MIN_TRAINING_ROWS:

            print(
                f"Need at least "
                f"{MIN_TRAINING_ROWS} "
                f"valid readings."
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
                "Processed dataset is empty."
            )

            return False


        print(
            f"Training rows: "
            f"{len(processed)}"
        )


        # =================================================
        # SAVE PROCESSED DATASET
        # =================================================

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


        processed.to_csv(
            PROCESSED_DATA_PATH,
            index=False
        )


        print(
            f"Training dataset saved: "
            f"{PROCESSED_DATA_PATH}"
        )


        # =================================================
        # TRAIN COOLING MODEL
        # =================================================

        print()
        print(
            "[AUTO TRAIN] "
            "Training cooling model..."
        )


        cooling_model = (
            train_cooling_model()
        )


        if not valid_model_file(
            COOLING_MODEL_PATH
        ):

            raise RuntimeError(
                "Cooling model was not saved correctly."
            )


        print(
            "[AUTO TRAIN] "
            "Cooling model saved successfully."
        )


        # =================================================
        # TRAIN TEMPERATURE MODEL
        # =================================================

        print()
        print(
            "[AUTO TRAIN] "
            "Training temperature model..."
        )


        temperature_model = (
            train_temperature_model(
                processed
            )
        )


        if not valid_model_file(
            TEMPERATURE_MODEL_PATH
        ):

            raise RuntimeError(
                "Temperature model was not saved correctly."
            )


        print(
            "[AUTO TRAIN] "
            "Temperature model saved successfully."
        )


        # =================================================
        # UPDATE TRAINING STATE
        # =================================================

        _last_trained_count = valid_count


        # =================================================
        # FINAL
        # =================================================

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


        print(
            f"Future points: "
            f"20"
        )


        print("=" * 60)


        return True


    except Exception as e:

        print()
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


    # =====================================================
    # NOT ENOUGH DATA
    # =====================================================

    if valid_count < MIN_TRAINING_ROWS:

        return False


    # =====================================================
    # FIRST TRAINING
    #
    # IMPORTANT:
    # Check FILE SIZE, not only existence.
    # =====================================================

    if not valid_model_file(
        COOLING_MODEL_PATH
    ):

        return True


    if not valid_model_file(
        TEMPERATURE_MODEL_PATH
    ):

        return True


    # =====================================================
    # RETRAIN AFTER NEW DATA
    # =====================================================

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