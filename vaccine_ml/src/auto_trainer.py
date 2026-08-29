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

# Retrain after every 20 NEW valid readings
RETRAIN_EVERY = 20

# Minimum readings required for first training
MIN_TRAINING_ROWS = 30


# =========================================================
# STATE
# =========================================================

_lock = threading.Lock()

_last_trained_count = 0

_training = False


# =========================================================
# CHECK MODEL FILE
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
                -20 <= inside_temp <= 60
            ):

                continue


            if not (
                -40 <= outside_temp <= 70
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

                # IMPORTANT:
                # Do NOT use PRE_COOLING cutoff.
                #
                # Every valid reading is ML training data.

                "mode":
                    "ML_CONTROL"

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


    # =====================================================
    # SORT + REMOVE DUPLICATES
    # =====================================================

    df = (

        df

        .sort_values(
            "timestamp"
        )

        .drop_duplicates(
            subset=[
                "timestamp"
            ],
            keep="last"
        )

        .reset_index(
            drop=True
        )

    )


    return df


# =========================================================
# TRAIN FROM HISTORY
# =========================================================

def train_from_history(history):

    global _last_trained_count
    global _training


    # =====================================================
    # PREVENT MULTIPLE TRAINING JOBS
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
        # PREPARE HISTORY
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


        valid_count = len(
            df
        )


        print()
        print(
            "=" * 60
        )

        print(
            "       AUTOMATIC MODEL TRAINING"
        )

        print(
            "=" * 60
        )


        print(
            f"Valid readings: "
            f"{valid_count}"
        )


        # =================================================
        # MINIMUM DATA
        # =================================================

        if (
            valid_count
            < MIN_TRAINING_ROWS
        ):

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
        # SAVE TRAINING DATASET
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


        try:

            train_cooling_model()


            if valid_model_file(
                COOLING_MODEL_PATH
            ):

                print(
                    "[AUTO TRAIN] "
                    "Cooling model saved successfully."
                )

            else:

                print(
                    "[AUTO TRAIN] "
                    "Cooling model was not saved."
                )


        except Exception as e:

            print(
                "[AUTO TRAIN] "
                "Cooling model skipped:"
            )

            print(
                str(e)
            )


        # =================================================
        # TRAIN TEMPERATURE MODEL
        #
        # This must continue even if cooling model fails.
        # =================================================

        print()
        print(
            "[AUTO TRAIN] "
            "Training temperature model..."
        )


        try:

            train_temperature_model(
                processed
            )


            if valid_model_file(
                TEMPERATURE_MODEL_PATH
            ):

                print(
                    "[AUTO TRAIN] "
                    "Temperature model saved successfully."
                )

            else:

                print(
                    "[AUTO TRAIN] "
                    "Temperature model was not saved."
                )


        except Exception as e:

            print(
                "[AUTO TRAIN] "
                "Temperature model failed:"
            )

            print(
                str(e)
            )


        # =================================================
        # UPDATE TRAINING COUNTER
        #
        # IMPORTANT:
        #
        # Only update this AFTER training attempt.
        #
        # This prevents training from being triggered
        # repeatedly for the same dataset.
        # =================================================

        _last_trained_count = valid_count


        # =================================================
        # FINAL STATUS
        # =================================================

        cooling_ready = (
            valid_model_file(
                COOLING_MODEL_PATH
            )
        )


        temperature_ready = (
            valid_model_file(
                TEMPERATURE_MODEL_PATH
            )
        )


        print()
        print(
            "=" * 60
        )

        print(
            "       AUTOMATIC TRAINING COMPLETE"
        )

        print(
            "=" * 60
        )


        print(
            f"Cooling model ready: "
            f"{cooling_ready}"
        )


        print(
            f"Temperature model ready: "
            f"{temperature_ready}"
        )


        print(
            "Future points: 20"
        )


        print(
            "Retrain interval: "
            f"{RETRAIN_EVERY} new readings"
        )


        print(
            "=" * 60
        )


        return temperature_ready


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


    valid_count = len(
        df
    )


    # =====================================================
    # MINIMUM DATA
    # =====================================================

    if (
        valid_count
        < MIN_TRAINING_ROWS
    ):

        return False


    # =====================================================
    # FIRST TRAINING
    #
    # Temperature model missing/empty:
    # train immediately.
    # =====================================================

    if not valid_model_file(
        TEMPERATURE_MODEL_PATH
    ):

        return True


    # =====================================================
    # INITIALIZE COUNTER AFTER SERVER RESTART
    #
    # If model already exists but counter reset to 0,
    # don't immediately retrain the entire dataset.
    #
    # Start counting NEW readings from the current dataset.
    # =====================================================

    if (
        _last_trained_count == 0
    ):

        _last_trained_count = valid_count

        return False


    # =====================================================
    # COOLING MODEL STATUS
    #
    # Cooling model can be unavailable.
    # Temperature prediction can still work.
    # =====================================================

    if not valid_model_file(
        COOLING_MODEL_PATH
    ):

        print(
            "[AUTO TRAIN] "
            "Cooling model unavailable; "
            "temperature model remains eligible."
        )


    # =====================================================
    # NEW DATA COUNT
    # =====================================================

    new_readings = (

        valid_count
        -
        _last_trained_count

    )


    # =====================================================
    # RETRAIN EVERY 20 NEW READINGS
    # =====================================================

    if (
        new_readings
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


    print()
    print(
        "[AUTO TRAIN] "
        "20 NEW TRAINING READINGS REACHED."
    )


    print(
        "[AUTO TRAIN] "
        "Starting automatic retraining..."
    )


    thread = threading.Thread(

        target=train_from_history,

        args=(history,),

        daemon=True

    )


    thread.start()