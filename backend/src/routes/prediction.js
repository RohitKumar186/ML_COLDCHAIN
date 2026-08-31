import { Router } from "express";
import pool from "../db/pool.js";

const router = Router();

const ML_URL =
  "https://cold-chain-ml.onrender.com/predict";

// =========================================================
// ML TIMEOUT
// =========================================================

const ML_TIMEOUT_MS = 5000;


// =========================================================
// GET /api/prediction
//
// PostgreSQL
//     ↓
// Recent sensor history
//     ↓
// Node.js
//     ↓
// Flask ML
//     ↓
// Future temperature prediction
//     ↓
// Frontend
//
// IMPORTANT:
// ML request has a 5-second timeout.
// If ML is unavailable, a safe fallback response
// is returned instead of keeping the request pending.
// =========================================================

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
    // Oldest → Newest
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

        future_temperatures: [],

        projected_min: null,

        projected_max: null,

        future_points: 0,

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
    //
    // IMPORTANT:
    // Maximum 5 seconds wait.
    // =====================================================

    let mlData = null;

    try {

      const controller =
        new AbortController();


      const timeout =
        setTimeout(
          () => {
            controller.abort();
          },
          ML_TIMEOUT_MS
        );


      const response =
        await fetch(
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

              history,

            }),

            signal:
              controller.signal,

          }
        );


      clearTimeout(timeout);


      // ===================================================
      // ML HTTP ERROR
      // ===================================================

      if (!response.ok) {

        throw new Error(
          `ML backend returned HTTP ${response.status}`
        );

      }


      mlData =
        await response.json();


      console.log(
        "[ML] Prediction:",
        mlData
      );


    } catch (mlError) {

      console.error(
        "[ML] Prediction unavailable:",
        mlError.message
      );

      mlData = null;

    }


    // =====================================================
    // FALLBACK WHEN ML IS UNAVAILABLE
    //
    // This prevents the frontend from getting HTTP 500.
    //
    // Safety logic:
    //
    // > 12°C → Level 2 → 100%
    // 2-12°C → Level 1 → 50%
    // < 2°C  → Level 0 → OFF
    // =====================================================

    if (!mlData) {

      let fallbackLevel;

      if (insideTemp > 12) {

        fallbackLevel = 2;

      } else if (insideTemp < 2) {

        fallbackLevel = 0;

      } else {

        fallbackLevel = 1;

      }


      const fallbackCooling =
        fallbackLevel > 0;


      const fallbackRisk =
        fallbackLevel === 2
          ? "high"
          : fallbackLevel === 1
          ? "medium"
          : "low";


      return res.json({

        current:
          insideTemp,

        temperature:
          insideTemp,

        data: [
          {
            x: "Now",

            temp:
              insideTemp,

            forecast:
              insideTemp,
          },
        ],

        min:
          Number(
            insideTemp.toFixed(1)
          ),

        max:
          Number(
            insideTemp.toFixed(1)
          ),

        risk:
          fallbackRisk,

        coolingDecision:
          fallbackCooling
            ? "ON"
            : "OFF",

        coolingLevel:
          fallbackLevel,

        peltier:
          fallbackCooling,

        futureTemperatures: [],

        future_temperatures: [],

        projected_min:
          null,

        projected_max:
          null,

        future_points:
          0,

        trend:
          "WAITING",

        mode:
          insideTemp > 12
            ? "PRE_COOLING"
            : "ML_CONTROL",

        outsideTemperature:
          outsideTemp,

        deviceConnected:
          true,

        timestamp:
          latest.recorded_at,

        prediction_status:
          "ML_TEMPORARILY_UNAVAILABLE",

      });

    }


    // =====================================================
    // COOLING LEVEL FROM ML
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
    // SAFETY OVERRIDE
    //
    // These rules always take priority.
    // =====================================================

    let finalCoolingLevel =
      safeCoolingLevel;


    // Current > 12°C
    // → Level 2

    if (insideTemp > 12) {

      finalCoolingLevel = 2;

    }


    // Current < 2°C
    // → Level 0

    else if (insideTemp < 2) {

      finalCoolingLevel = 0;

    }


    // 2°C - 12°C
    // → ML decision remains active.


    // =====================================================
    // RISK
    // =====================================================

    let risk;

    if (
      finalCoolingLevel === 0
    ) {

      risk = "low";

    } else if (
      finalCoolingLevel === 1
    ) {

      risk = "medium";

    } else {

      risk = "high";

    }


    // =====================================================
    // COOLING DECISION
    // =====================================================

    const coolingDecision =
      finalCoolingLevel > 0
        ? "ON"
        : "OFF";


    // =====================================================
    // PELTIER
    // =====================================================

    const peltier =
      finalCoolingLevel > 0;


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
    // =====================================================

    const data = [];


    data.push({

      x: "Now",

      temp:
        current,

      forecast:
        current,

    });


    futureTemperatures.forEach(
      (
        temperature,
        index
      ) => {

        data.push({

          x:
            `+${(index + 1) * 5}m`,

          temp:
            null,

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
      (
        insideTemp > 12
          ? "PRE_COOLING"
          : "ML_CONTROL"
      );


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
        finalCoolingLevel,

      peltier,

      futureTemperatures,

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

      prediction_status:
        "ACTIVE",

    });


  } catch (error) {

    console.error(
      "GET /api/prediction error:",
      error
    );


    // =====================================================
    // FINAL EMERGENCY FALLBACK
    //
    // Even if database/API processing fails,
    // don't leave frontend hanging.
    // =====================================================

    const insideTemp =
      Number(
        req.body?.inside_temperature
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