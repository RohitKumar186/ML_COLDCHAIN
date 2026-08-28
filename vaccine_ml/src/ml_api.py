from flask import Flask, request, jsonify
import sys
import os

# Project root ko Python path mein add karo
BASE_DIR = os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))
)

if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from src.main import predict


app = Flask(__name__)


@app.route("/health", methods=["GET"])
def health():

    return jsonify({
        "status": "ok",
        "service": "vaccine-ml"
    })


@app.route("/predict", methods=["POST"])
def prediction():

    try:

        data = request.get_json()

        if not data:
            return jsonify({
                "error": "No JSON data received"
            }), 400

        # -----------------------------
        # Read sensor values
        # -----------------------------

        inside_temp = data.get(
            "inside_temperature",
            data.get("inside_temp")
        )

        outside_temp = data.get(
            "outside_temperature",
            data.get("outside_temp")
        )

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

        inside_temp = float(
            inside_temp
        )

        outside_temp = float(
            outside_temp
        )

        # -----------------------------
        # Run ML system
        # -----------------------------

        result = predict(
            inside_temp=inside_temp,
            outside_temp=outside_temp
        )

        return jsonify(result)

    except Exception as e:

        print(
            "Prediction error:",
            str(e)
        )

        return jsonify({
            "error": "Prediction failed",
            "message": str(e)
        }), 500


if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=8000,
        debug=True
    )