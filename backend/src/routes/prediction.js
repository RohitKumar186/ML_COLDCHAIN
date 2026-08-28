import { Router } from "express";
import pool from "../db/pool.js";

const router = Router();

const ML_URL =
  "https://cold-chain-ml.onrender.com/predict";

/*
  =========================================================
  GET /api/prediction

  ESP32
      ↓
  PostgreSQL
      ↓
  Node.js
      ↓
  Flask ML
      ↓
  Frontend
  =========================================================
*/

router.get("/", async (req, res) => {
  try {

    // =====================================================
    // GET LATEST SENSOR READING
    // =====================================================

    const result = await pool.query(`
      SELECT
        temperature,
        outside_temperature,
        device_connected,
        recorded_at
      FROM sensor_readings
      ORDER BY recorded_at DESC, id DESC
      LIMIT 1
    `);


    // =====================================================
    // NO SENSOR DATA
    // =====================================================

    if (result.rows.length === 0) {

      return res.status(503).json({
        error: "No sensor data available",
      });

    }


    const row = result.rows[0];


    // =====================================================
    // CHECK DEVICE CONNECTION
    // =====================================================

    const recordedTime =
      new Date(row.recorded_at).getTime();

    const currentTime =
      Date.now();

    const ageInSeconds =
      (currentTime - recordedTime) / 1000;


    const deviceOnline =
      ageInSeconds <= 30 &&
      row.device_connected === true;


    // =====================================================
    // DEVICE OFFLINE
    // =====================================================

    if (!deviceOnline) {

      return res.json({

        current: null,

        temperature: null,

        data: [],

        min: null,

        max: null,

        risk: "unknown",

        coolingDecision: "OFF",

        coolingLevel: 0,

        peltier: false,

        futureTemperatures: [],

        trend: "UNKNOWN",

        mode: "DEVICE_OFFLINE",

        outsideTemperature: null,

        deviceConnected: false,

        timestamp: row.recorded_at,

      });

    }


    // =====================================================
    // CURRENT SENSOR VALUES
    // =====================================================

    const insideTemp =
      Number(row.temperature);

    const outsideTemp =
      Number(row.outside_temperature);


    // =====================================================
    // VALIDATE SENSOR DATA
    // =====================================================

    if (
      !Number.isFinite(insideTemp) ||
      !Number.isFinite(outsideTemp)
    ) {

      return res.status(500).json({
        error: "Invalid temperature data",
      });

    }


    // =====================================================
    // CALL FLASK ML BACKEND
    // =====================================================

    const response = await fetch(
      ML_URL,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({

          inside_temperature:
            insideTemp,

          outside_temperature:
            outsideTemp,

        }),
      }
    );


    // =====================================================
    // CHECK ML RESPONSE
    // =====================================================

    if (!response.ok) {

      throw new Error(
        `ML backend returned HTTP ${response.status}`
      );

    }


    const mlData =
      await response.json();


    console.log(
      "[ML] Prediction:",
      mlData
    );


    // =====================================================
    // COOLING LEVEL
    //
    // 0 = OFF
    // 1 = LOW
    // 2 = HIGH
    // =====================================================

    const coolingLevel =
      Number(
        mlData.cooling_level ?? 0
      );


    // =====================================================
    // VALIDATE COOLING LEVEL
    // =====================================================

    const safeCoolingLevel =
      [0, 1, 2].includes(coolingLevel)
        ? coolingLevel
        : 0;


    // =====================================================
    // RISK
    //
    // 0 = LOW
    // 1 = MEDIUM
    // 2 = HIGH
    // =====================================================

    let risk;

    if (safeCoolingLevel === 0) {

      risk = "low";

    } else if (safeCoolingLevel === 1) {

      risk = "medium";

    } else {

      risk = "high";

    }


    // =====================================================
    // COOLING DECISION
    //
    // Level 0 → OFF
    // Level 1 → ON
    // Level 2 → ON
    // =====================================================

    const coolingDecision =
      safeCoolingLevel > 0
        ? "ON"
        : "OFF";


    // =====================================================
    // PELTIER STATUS
    //
    // IMPORTANT:
    // Peltier follows cooling level.
    //
    // 0 → OFF
    // 1 → ON
    // 2 → ON
    //
    // Do NOT use mlData.peltier here.
    // =====================================================

    const peltier =
      safeCoolingLevel > 0;


    // =====================================================
    // FUTURE TEMPERATURES
    // =====================================================

    const futureTemperatures =
      Array.isArray(
        mlData.future_temperatures
      )
        ? mlData.future_temperatures
            .map(Number)
            .filter(Number.isFinite)
        : [];


    // =====================================================
    // CURRENT TEMPERATURE
    //
    // Always use actual ESP32/DB value.
    // =====================================================

    const current =
      insideTemp;


    // =====================================================
    // PROJECTED VALUES
    // =====================================================

    const projectedValues = [

      current,

      ...futureTemperatures,

    ];


    // =====================================================
    // MINIMUM
    // =====================================================

    const min =
      projectedValues.length > 0
        ? Math.min(
            ...projectedValues
          )
        : current;


    // =====================================================
    // MAXIMUM
    // =====================================================

    const max =
      projectedValues.length > 0
        ? Math.max(
            ...projectedValues
          )
        : current;


    // =====================================================
    // GRAPH DATA
    // =====================================================

    const data = [];


    // Current reading
    data.push({

      x: "Now",

      temp: current,

      forecast: current,

    });


    // Future ML predictions
    futureTemperatures.forEach(
      (temperature, index) => {

        data.push({

          x:
            `+${(index + 1) * 5}m`,

          temp: null,

          forecast:
            temperature,

        });

      }
    );


    // =====================================================
    // TREND
    // =====================================================

    const trend =
      mlData.trend ||
      "STABLE";


    // =====================================================
    // MODE
    // =====================================================

    const mode =
      mlData.mode ||
      "ML_CONTROL";


    // =====================================================
    // RESPONSE TO FRONTEND
    // =====================================================

    return res.json({

      // ---------------------------------------------------
      // Current temperature
      // ---------------------------------------------------

      current,

      temperature:
        current,


      // ---------------------------------------------------
      // Graph
      // ---------------------------------------------------

      data,


      // ---------------------------------------------------
      // Projected range
      // ---------------------------------------------------

      min:
        Number(
          min.toFixed(1)
        ),

      max:
        Number(
          max.toFixed(1)
        ),


      // ---------------------------------------------------
      // Risk
      // ---------------------------------------------------

      risk,


      // ---------------------------------------------------
      // Cooling
      // ---------------------------------------------------

      coolingDecision,

      coolingLevel:
        safeCoolingLevel,


      // ---------------------------------------------------
      // Peltier
      // ---------------------------------------------------

      peltier,


      // ---------------------------------------------------
      // Forecast
      // ---------------------------------------------------

      futureTemperatures,


      // ---------------------------------------------------
      // Trend
      // ---------------------------------------------------

      trend,


      // ---------------------------------------------------
      // Mode
      // ---------------------------------------------------

      mode,


      // ---------------------------------------------------
      // Outside temperature
      // ---------------------------------------------------

      outsideTemperature:
        outsideTemp,


      // ---------------------------------------------------
      // Device status
      // ---------------------------------------------------

      deviceConnected:
        true,


      // ---------------------------------------------------
      // Timestamp
      // ---------------------------------------------------

      timestamp:
        mlData.timestamp ||
        row.recorded_at,

    });

  } catch (error) {

    console.error(
      "GET /api/prediction error:",
      error
    );


    return res.status(500).json({

      error:
        "Unable to process prediction.",

      details:
        error.message,

    });

  }
});


export default router;