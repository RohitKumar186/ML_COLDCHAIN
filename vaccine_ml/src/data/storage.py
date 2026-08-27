import os
import pandas as pd

from src.config import RAW_DATA_PATH


def save_sensor_data(
    timestamp,
    inside_temp,
    outside_temp,
    cooling_level,
    mode
):
    os.makedirs(
        os.path.dirname(RAW_DATA_PATH),
        exist_ok=True
    )

    new_data = pd.DataFrame([
        {
            "timestamp": timestamp,
            "inside_temp": inside_temp,
            "outside_temp": outside_temp,
            "cooling_level": cooling_level,
            "mode": mode
        }
    ])

    if os.path.exists(RAW_DATA_PATH):
        new_data.to_csv(
            RAW_DATA_PATH,
            mode="a",
            header=False,
            index=False
        )
    else:
        new_data.to_csv(
            RAW_DATA_PATH,
            index=False
        )


def load_sensor_data():

    if not os.path.exists(RAW_DATA_PATH):
        raise FileNotFoundError(
            f"Sensor data not found: {RAW_DATA_PATH}"
        )

    df = pd.read_csv(RAW_DATA_PATH)

    df["timestamp"] = pd.to_datetime(
        df["timestamp"]
    )

    return df.sort_values(
        "timestamp"
    ).reset_index(drop=True)