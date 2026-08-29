import os
import pandas as pd
import psycopg2

from dotenv import load_dotenv

from src.config import RAW_DATA_PATH


# =========================================================
# LOAD BACKEND ENV
# =========================================================

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

BACKEND_ENV = os.path.abspath(
    os.path.join(
        BASE_DIR,
        "..",
        "backend",
        ".env"
    )
)

load_dotenv(BACKEND_ENV)


# =========================================================
# DATABASE CONFIG
# =========================================================

DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_PORT = os.getenv("DB_PORT", "5432")
def main():

    print("=" * 60)
    print("       EXPORTING SENSOR DATA")
    print("=" * 60)


    # =====================================================
    # CHECK DATABASE CONFIG
    # =====================================================

    required = {
        "DB_HOST": DB_HOST,
        "DB_NAME": DB_NAME,
        "DB_USER": DB_USER,
        "DB_PASSWORD": DB_PASSWORD,
        "DB_PORT": DB_PORT,
    }


    missing = [
        key
        for key, value in required.items()
        if not value
    ]


    if missing:

        raise RuntimeError(
            "Missing database environment variables: "
            + ", ".join(missing)
        )


    # =====================================================
    # CONNECT TO POSTGRESQL
    # =====================================================

    print()
    print("Connecting to PostgreSQL...")


    connection = psycopg2.connect(

        host=DB_HOST,

        database=DB_NAME,

        user=DB_USER,

        password=DB_PASSWORD,

        port=int(DB_PORT),

        sslmode="require"

    )


    print("PostgreSQL connected.")


    try:

        # =================================================
        # GET SENSOR DATA
        # =================================================

        query = """
        SELECT
            recorded_at AS timestamp,
            temperature AS inside_temp,
            outside_temperature AS outside_temp,
            cooling_on,
            device_connected
        FROM sensor_readings
        ORDER BY recorded_at ASC
        """


        df = pd.read_sql_query(
            query,
            connection
        )


    finally:

        connection.close()


    # =====================================================
    # CHECK DATA
    # =====================================================

    if df.empty:

        raise ValueError(
            "PostgreSQL sensor_readings table is empty."
        )


    print(
        f"Sensor readings found: {len(df)}"
    )


    # =====================================================
    # DATETIME
    # =====================================================

    df["timestamp"] = pd.to_datetime(
        df["timestamp"]
    )


    # =====================================================
    # COOLING LEVEL
    #
    # 0 → OFF
    # 1 → MEDIUM
    # 2 → HIGH
    #
    # Existing project logic:
    #
    # > 12°C  → Level 2
    # 8–12°C  → Level 1
    # < 8°C   → Level 0
    # =====================================================

    def determine_cooling_level(temp):

        if temp > 12:

            return 2

        elif temp >= 8:

            return 1

        else:

            return 0


    df["cooling_level"] = (
        df["inside_temp"]
        .apply(determine_cooling_level)
    )


    # =====================================================
    # MODE
    #
    # Existing project logic:
    #
    # > 12°C → PRE_COOLING
    # <= 12°C → ML_CONTROL
    # =====================================================

    df["mode"] = (
        df["inside_temp"]
        .apply(
            lambda temp:
                "PRE_COOLING"
                if temp > 12
                else "ML_CONTROL"
        )
    )


    # =====================================================
    # SELECT TRAINING COLUMNS
    # =====================================================

    training_data = df[
        [
            "timestamp",
            "inside_temp",
            "outside_temp",
            "cooling_level",
            "mode"
        ]
    ].copy()


    # =====================================================
    # SAVE RAW DATA
    # =====================================================

    os.makedirs(

        os.path.dirname(
            RAW_DATA_PATH
        ),

        exist_ok=True

    )


    training_data.to_csv(

        RAW_DATA_PATH,

        index=False

    )


    # =====================================================
    # SUMMARY
    # =====================================================

    print()
    print("=" * 60)

    print(
        f"Exported rows: "
        f"{len(training_data)}"
    )

    print(
        f"ML_CONTROL rows: "
        f"{len(training_data[training_data['mode'] == 'ML_CONTROL'])}"
    )

    print(
        f"PRE_COOLING rows: "
        f"{len(training_data[training_data['mode'] == 'PRE_COOLING'])}"
    )

    print()

    print(
        f"Saved to:"
    )

    print(
        RAW_DATA_PATH
    )

    print("=" * 60)

    print(
        "EXPORT COMPLETED"
    )

    print("=" * 60)


if __name__ == "__main__":

    main()