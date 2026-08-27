from flask import Flask, request, jsonify
import random

app = Flask(__name__)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ML backend running",
        "mode": "DUMMY"
    })


@app.route("/predict", methods=["POST"])
def predict():

    try:
        data = request.get_json()

        inside_temp = float(data.get("inside_temp", 5.5))
        outside_temp = float(data.get("outside_temp", 28.0))

        # -------------------------------------------------
        # DUMMY FUTURE TEMPERATURE PREDICTION
        # -------------------------------------------------

        future_temperatures = []

        temperature = inside_temp

        for _ in range(6):

            temperature += random.uniform(
                -0.15,
                0.30
            )

            temperature = max(
                1.0,
                min(9.5, temperature)
            )

            future_temperatures.append(
                round(temperature, 1)
            )

        # -------------------------------------------------
        # DUMMY COOLING DECISION
        # -------------------------------------------------

        if inside_temp >= 7.0:

            cooling_level = 2
            cooling_decision = "HIGH"
            peltier = True

        elif inside_temp >= 5.5:

            cooling_level = 1
            cooling_decision = "LOW"
            peltier = True

        else:

            cooling_level = 0
            cooling_decision = "OFF"
            peltier = False

        # -------------------------------------------------
        # TREND
        # -------------------------------------------------

        if future_temperatures[-1] > inside_temp + 0.2:
            trend = "RISING"

        elif future_temperatures[-1] < inside_temp - 0.2:
            trend = "FALLING"

        else:
            trend = "STABLE"

        # -------------------------------------------------
        # RISK
        # -------------------------------------------------

        minimum = min(
            [inside_temp] + future_temperatures
        )

        maximum = max(
            [inside_temp] + future_temperatures
        )

        if maximum > 8 or minimum < 2:
            risk = "high"

        elif maximum > 7.4 or minimum < 2.6:
            risk = "watch"

        else:
            risk = "low"

        # -------------------------------------------------
        # RESPONSE
        # -------------------------------------------------

        return jsonify({

            "inside_temperature": inside_temp,

            "outside_temperature": outside_temp,

            "mode": "ML_CONTROL",

            "future_temperatures":
                future_temperatures,

            "cooling_level":
                cooling_level,

            "cooling_decision":
                cooling_decision,

            "peltier":
                peltier,

            "trend":
                trend,

            "risk":
                risk,

            "timestamp":
                __import__("datetime")
                .datetime.now()
                .isoformat()

        })

    except Exception as error:

        print(
            "Prediction error:",
            error
        )

        return jsonify({
            "error": str(error)
        }), 500


if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=8000,
        debug=True
    )