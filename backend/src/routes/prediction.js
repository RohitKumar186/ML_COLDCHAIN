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
  Recent history
      ↓
  Node.js
      ↓
  Flask ML
      ↓
  Future temperature prediction
      ↓
  Frontend
  =========================================================
*/

router.get("/", async (req, res) => {

  try {

    // =====================================================
    // GET RECENT SENSOR HISTORY
    // =====================================================

    const historyResult = await pool.query(`
      SELECT
        temperature,
        outside_temperature,
        recorded_at,
        device_connected
      FROM sensor_readings
      WHERE temperature IS NOT NULL
        AND outside_temperature IS NOT NULL
      ORDER BY recorded_at DESC, id DESC
      LIMIT 100
    `);


    // =====================================================
    // NO SENSOR DATA
    // =====================================================

    if (historyResult.rows.length === 0) {

      return res.status(503).json({
        error: "No sensor data available",
      });

    }


    // =====================================================
    // REVERSE HISTORY
    //
    // ML features need chronological order:
    // oldest → newest
    // =====================================================

    const rows =
      [...historyResult.rows].reverse();


    // =====================================================
    // LATEST READING
    // =====================================================

    const latest =
      rows[rows.length - 1];


    const insideTemp =
      Number(latest.temperature);


    const outsideTemp =
      Number(latest.outside_temperature);


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
    // DEVICE STATUS
    // =====================================================

    const recordedTime =
      new Date(
        latest.recorded_at
      ).getTime();


    const currentTime =
      Date.now();


    const ageInSeconds =
      (
        currentTime -
        recordedTime
      ) / 1000;


    const deviceOnline =
      ageInSeconds <= 30 &&
      latest.device_connected === true;


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

        timestamp:
          latest.recorded_at,

      });

    }


    // =====================================================
    // PREPARE HISTORY FOR FLASK
    //
    // Flask expects:
    // timestamp
    // inside_temp
    // outside_temp
    // mode
    // =====================================================

    const history =
      rows.map((item) => {

        const itemInside =
          Number(
            item.temperature
          );


        const itemOutside =
          Number(
            item.outside_temperature
          );


        return {

          timestamp:
            item.recorded_at,

          inside_temp:
            itemInside,

          outside_temp:
            itemOutside,

          mode:
            itemInside > 12
              ? "PRE_COOLING"
              : "ML_CONTROL",

        };

      });


    // =====================================================
    // CALL FLASK ML BACKEND
    // =====================================================

    const response = await fetch(
      ML_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({

          inside_temperature:
            insideTemp,

          outside_temperature:
            outsideTemp,

          // IMPORTANT:
          // Send history to ML
          history,

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
    // =====================================================

    const coolingLevel =
      Number(
        mlData.cooling_level ?? 0
      );


    const safeCoolingLevel =
      [0, 1, 2].includes(
        coolingLevel
      )
        ? coolingLevel
        : 0;


    // =====================================================
    // RISK
    // =====================================================

    let risk;

    if (
      safeCoolingLevel === 0
    ) {

      risk = "low";

    } else if (
      safeCoolingLevel === 1
    ) {

      risk = "medium";

    } else {

      risk = "high";

    }


    // =====================================================
    // COOLING DECISION
    // =====================================================

    const coolingDecision =
      safeCoolingLevel > 0
        ? "ON"
        : "OFF";


    // =====================================================
    // PELTIER
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
            .filter(
              Number.isFinite
            )
        : [];


    // =====================================================
    // CURRENT
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


    const min =
      projectedValues.length > 0
        ? Math.min(
            ...projectedValues
          )
        : current;


    const max =
      projectedValues.length > 0
        ? Math.max(
            ...projectedValues
          )
        : current;


    // =====================================================
    // GRAPH DATA
    //
    // Current → Future ML predictions
    // =====================================================

    const data = [];


    data.push({

      x: "Now",

      temp: current,

      forecast: current,

    });


    futureTemperatures.forEach(
      (
        temperature,
        index
      ) => {

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
    // FINAL RESPONSE
    // =====================================================

    return res.json({

      current,

      temperature:
        current,

      data,

      min:
        Number(
          min.toFixed(1)
        ),

      max:
        Number(
          max.toFixed(1)
        ),

      risk,

      coolingDecision,

      coolingLevel:
        safeCoolingLevel,

      peltier,

      futureTemperatures,

      // Also provide snake_case
      // for direct ML/frontend compatibility.

      future_temperatures:
        futureTemperatures,

      projected_min:
        futureTemperatures.length
          ? Number(
              Math.min(
                ...futureTemperatures
              ).toFixed(1)
            )
          : null,

      projected_max:
        futureTemperatures.length
          ? Number(
              Math.max(
                ...futureTemperatures
              ).toFixed(1)
            )
          : null,

      future_points:
        futureTemperatures.length,

      trend,

      mode,

      outsideTemperature:
        outsideTemp,

      deviceConnected:
        true,

      timestamp:
        latest.recorded_at,

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