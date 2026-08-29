from flask import Flask, request, jsonify
import sys
import os

# =========================================================
# PROJECT ROOT
# =========================================================

BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)


from src.main import predict


app = Flask(__name__)


# =========================================================
# HEALTH CHECK
# =========================================================

@app.route(
    "/health",
    methods=["GET"]
)
def health():

    return jsonify({
        "status": "ok",
        "service": "vaccine-ml"
    })


# =========================================================
# PREDICTION
#
# Node Backend
#      ↓
# Current sensor values
#      +
# Recent PostgreSQL history
#      ↓
# Flask ML
# =========================================================

@app.route(
    "/predict",
    methods=["POST"]
)
def prediction():

    try:

        data = request.get_json()


        # -------------------------------------------------
        # Validate JSON
        # -------------------------------------------------

        if not data:

            return jsonify({
                "error":
                    "No JSON data received"
            }), 400


        # -------------------------------------------------
        # Current inside temperature
        # -------------------------------------------------

        inside_temp = data.get(
            "inside_temperature",
            data.get("inside_temp")
        )


        # -------------------------------------------------
        # Current outside temperature
        # -------------------------------------------------

        outside_temp = data.get(
            "outside_temperature",
            data.get("outside_temp")
        )


        # -------------------------------------------------
        # Required validation
        # -------------------------------------------------

        if inside_temp is None:

            return jsonify({
                "error":
                    "inside_temperature is required"
            }), 400


        if outside_temp is None:

            return jsonify({
                "error":
                    "outside_temperature is required"
            }), 400


        # -------------------------------------------------
        # Convert sensor values
        # -------------------------------------------------

        inside_temp = float(
            inside_temp
        )

        outside_temp = float(
            outside_temp
        )


        # -------------------------------------------------
        # Recent sensor history
        #
        # This comes from Node backend.
        # Node gets it from PostgreSQL.
        # -------------------------------------------------

        history = data.get(
            "history",
            []
        )


        if not isinstance(
            history,
            list
        ):

            history = []


        # -------------------------------------------------
        # Run ML prediction
        # -------------------------------------------------

        result = predict(

            inside_temp=
                inside_temp,

            outside_temp=
                outside_temp,

            history=
                history

        )


        # -------------------------------------------------
        # Return prediction
        # -------------------------------------------------

        return jsonify(
            result
        )


    except ValueError as e:

        print(
            "Invalid sensor value:",
            str(e)
        )

        return jsonify({

            "error":
                "Invalid sensor data",

            "message":
                str(e)

        }), 400


    except Exception as e:

        print(
            "Prediction error:",
            str(e)
        )

        return jsonify({

            "error":
                "Prediction failed",

            "message":
                str(e)

        }), 500


# =========================================================
# LOCAL DEVELOPMENT
# =========================================================

if __name__ == "__main__":

    app.run(

        host="0.0.0.0",

        port=8000,

        debug=True

    )