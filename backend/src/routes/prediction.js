import { Router } from "express";

const router = Router();

/*
  GET /api/prediction

  Node.js → Flask ML backend

  Flask ML backend:
  http://localhost:8000/predict
*/

router.get("/", async (req, res) => {
  try {
    // -------------------------------------------------
    // TEMPORARY DUMMY SENSOR DATA
    // -------------------------------------------------
    // Later these values will come from your actual
    // monitoring/ESP32 backend.

    const insideTemp = 6.2;
    const outsideTemp = 28.5;

    // -------------------------------------------------
    // CALL PYTHON ML BACKEND
    // -------------------------------------------------

    const response = await fetch(
      "http://localhost:8000/predict",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          inside_temp: insideTemp,
          outside_temp: outsideTemp,
        }),
      }
    );

    // -------------------------------------------------
    // CHECK ML BACKEND RESPONSE
    // -------------------------------------------------

    if (!response.ok) {
      throw new Error(
        `ML backend returned HTTP ${response.status}`
      );
    }

    const mlData = await response.json();

    console.log(
      "[ML] Prediction:",
      mlData
    );

    // -------------------------------------------------
    // CONVERT ML RESPONSE TO FRONTEND FORMAT
    // -------------------------------------------------

    const futureTemperatures =
      Array.isArray(
        mlData.future_temperatures
      )
        ? mlData.future_temperatures.map(Number)
        : [];

    const current =
      Number(
        mlData.inside_temperature
      );

    // -------------------------------------------------
    // CALCULATE MIN / MAX
    // -------------------------------------------------

    const projectedValues = [
      current,
      ...futureTemperatures,
    ];

    const min =
      projectedValues.length > 0
        ? Math.min(...projectedValues)
        : current;

    const max =
      projectedValues.length > 0
        ? Math.max(...projectedValues)
        : current;

    // -------------------------------------------------
    // CREATE GRAPH DATA
    // -------------------------------------------------

    const data = [];

    // Current point
    data.push({
      x: "Now",
      temp: current,
      forecast: current,
    });

    // Future ML predictions
    futureTemperatures.forEach(
      (temperature, index) => {
        data.push({
          x: `+${(index + 1) * 5}m`,
          temp: null,
          forecast: temperature,
        });
      }
    );

    // -------------------------------------------------
    // SEND DATA TO REACT
    // -------------------------------------------------

    res.json({
      current,

      temperature: current,

      data,

      min: Number(min.toFixed(1)),

      max: Number(max.toFixed(1)),

      risk:
        mlData.risk || "low",

      coolingDecision:
        mlData.cooling_decision || "OFF",

      coolingLevel:
        Number(
          mlData.cooling_level ?? 0
        ),

      peltier:
        Boolean(
          mlData.peltier
        ),

      futureTemperatures,

      trend:
        mlData.trend || "STABLE",

      mode:
        mlData.mode || "ML_CONTROL",

      outsideTemperature:
        Number(
          mlData.outside_temperature
        ),

      timestamp:
        mlData.timestamp ||
        new Date().toISOString(),
    });

  } catch (error) {

    console.error(
      "GET /api/prediction error:",
      error
    );

    res.status(500).json({
      error:
        "Unable to connect to Python ML backend.",
      details:
        error.message,
    });
  }
});

export default router;