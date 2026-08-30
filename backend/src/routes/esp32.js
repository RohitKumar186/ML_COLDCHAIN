import { Router } from "express";
import pool from "../db/pool.js";

const router = Router();

const ML_URL =
  "https://cold-chain-ml.onrender.com/predict";

// =========================================================
// ML REQUEST TIMEOUT
//
// ESP32 ko ML training ke liye wait nahi karwana.
// =========================================================

const ML_TIMEOUT_MS = 5000;


// =========================================================
// LAST KNOWN ML RESULT
//
// Agar ML temporarily slow/down hai,
// previous valid ML decision use hoga.
// =========================================================

let lastMLPrediction = null;


// =========================================================
// SAFETY CONTROL
// =========================================================

function safetyCoolingLevel(insideTemp) {

  // Above 12°C
  // MUST COOL HARD

  if (insideTemp > 12) {
    return 2;
  }


  // Below 2°C
  // TOO COLD

  if (insideTemp < 2) {
    return 0;
  }


  // Inside safe range
  return 0;
}


// =========================================================
// POST /api/esp32
// =========================================================

router.post("/", async (req, res) => {

  try {

    const {
      inside_temperature,
      outside_temperature,
      humidity,
      voltage,
      power_present
    } = req.body || {};


    // =====================================================
    // VALIDATION
    // =====================================================

    if (
      inside_temperature == null ||
      outside_temperature == null ||
      voltage == null ||
      power_present == null
    ) {

      return res.status(400).json({
        error: "Missing required sensor data"
      });

    }


    const insideTemp =
      Number(inside_temperature);


    const outsideTemp =
      Number(outside_temperature);


    const voltageValue =
      Number(voltage);


    const powerPresent =
      Boolean(power_present);


    if (
      !Number.isFinite(insideTemp) ||
      !Number.isFinite(outsideTemp) ||
      !Number.isFinite(voltageValue)
    ) {

      return res.status(400).json({
        error: "Invalid sensor values"
      });

    }


    // =====================================================
    // MODE
    // =====================================================

    const mode =
      insideTemp > 12
        ? "PRE_COOLING"
        : "ML_CONTROL";


    // =====================================================
    // SAVE SENSOR READING
    // =====================================================

    const coolingOnFromTemperature =
      insideTemp > 12;


    const insertResult =
      await pool.query(
        `
        INSERT INTO sensor_readings
        (
          temperature,
          outside_temperature,
          voltage,
          door_open,
          cooling_on,
          device_connected,
          recorded_at
        )
        VALUES
        (
          $1,
          $2,
          $3,
          false,
          $4,
          $5,
          NOW()
        )
        RETURNING id, recorded_at
        `,
        [
          insideTemp,
          outsideTemp,
          voltageValue,
          coolingOnFromTemperature,
          true
        ]
      );


    console.log(
      "[ESP32] Sensor reading saved:",
      insertResult.rows[0]
    );


    // =====================================================
    // GET HISTORY
    //
    // Keep complete history for existing training flow.
    // =====================================================

    const historyResult =
      await pool.query(
        `
        SELECT
          id,
          recorded_at AS timestamp,
          temperature AS inside_temp,
          outside_temperature AS outside_temp,
          cooling_on
        FROM sensor_readings
        WHERE
          temperature IS NOT NULL
          AND outside_temperature IS NOT NULL
        ORDER BY
          recorded_at ASC,
          id ASC
        `
      );


    // =====================================================
    // CREATE ML HISTORY
    // =====================================================

    const history =
      historyResult.rows.map(
        (row) => ({

          timestamp:
            row.timestamp,

          inside_temp:
            Number(
              row.inside_temp
            ),

          outside_temp:
            Number(
              row.outside_temp
            ),

          mode:
            Number(row.inside_temp) > 12
              ? "PRE_COOLING"
              : "ML_CONTROL",

          cooling_level:
            Number(row.cooling_on)
              ? 1
              : 0

        })
      );


    // =====================================================
    // IMMEDIATE SAFETY LEVEL
    //
    // This exists BEFORE ML response.
    //
    // So if ML is slow, we still have a valid level.
    // =====================================================

    const immediateSafetyLevel =
      safetyCoolingLevel(
        insideTemp
      );


    // =====================================================
    // ML REQUEST WITH TIMEOUT
    // =====================================================

    let prediction = null;


    try {

      const controller =
        new AbortController();


      const timeout =
        setTimeout(
          () => controller.abort(),
          ML_TIMEOUT_MS
        );


      const mlResponse =
        await fetch(
          ML_URL,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({

              inside_temperature:
                insideTemp,

              outside_temperature:
                outsideTemp,

              history

            }),

            signal:
              controller.signal

          }
        );


      clearTimeout(timeout);


      // ===================================================
      // ML HTTP ERROR
      // ===================================================

      if (!mlResponse.ok) {

        throw new Error(
          `ML API returned ${mlResponse.status}`
        );

      }


      prediction =
        await mlResponse.json();


      // ===================================================
      // SAVE LAST VALID ML RESULT
      // ===================================================

      if (
        prediction &&
        typeof prediction === "object"
      ) {

        lastMLPrediction =
          prediction;

      }


      console.log(
        "[ML] Prediction received:",
        prediction
      );


    } catch (mlError) {

      console.error(
        "[ML] Prediction timeout/unavailable:",
        mlError.message
      );


      // ===================================================
      // USE LAST ML RESULT
      // ===================================================

      if (lastMLPrediction) {

        prediction =
          lastMLPrediction;

        console.log(
          "[ML] Using last known prediction."
        );

      } else {

        prediction = null;

        console.log(
          "[ML] No previous prediction. "
          + "Using safety controller."
        );

      }

    }


    // =====================================================
    // DETERMINE COOLING LEVEL
    // =====================================================

    let coolingLevel = null;


    if (
      prediction &&
      prediction.cooling_level != null
    ) {

      const mlLevel =
        Number(
          prediction.cooling_level
        );


      if (
        [0, 1, 2].includes(
          mlLevel
        )
      ) {

        coolingLevel =
          mlLevel;

      }

    }


    // =====================================================
    // HARD SAFETY OVERRIDES
    // =====================================================

    // -----------------------------------------------------
    // ABOVE 12°C
    //
    // NEVER allow ML to turn cooling OFF.
    // -----------------------------------------------------

    if (insideTemp > 12) {

      coolingLevel = 2;

    }


    // -----------------------------------------------------
    // BELOW 2°C
    //
    // NEVER allow ML to keep Peltier ON.
    // -----------------------------------------------------

    else if (insideTemp < 2) {

      coolingLevel = 0;

    }


    // =====================================================
    // NO ML DECISION
    //
    // Use immediate safety decision.
    // =====================================================

    if (
      coolingLevel === null
    ) {

      coolingLevel =
        immediateSafetyLevel;

    }


    // =====================================================
    // FINAL SAFETY VALIDATION
    // =====================================================

    if (
      ![0, 1, 2].includes(
        coolingLevel
      )
    ) {

      coolingLevel = 0;

    }


    // =====================================================
    // COOLING STATUS
    // =====================================================

    const coolingOn =
      coolingLevel > 0;


    const coolingDecision =
      coolingOn
        ? "ON"
        : "OFF";


    const peltier =
      coolingOn
        ? "ON"
        : "OFF";


    const fan =
      coolingOn
        ? "ON"
        : "OFF";


    // =====================================================
    // FUTURE TEMPERATURES
    // =====================================================

    const futureTemperatures =
      prediction &&
      Array.isArray(
        prediction.future_temperatures
      )
        ? prediction.future_temperatures
            .map(Number)
            .filter(
              Number.isFinite
            )
        : [];


    // =====================================================
    // TREND
    // =====================================================

    const trend =
      prediction?.trend ||
      "STABLE";


    // =====================================================
    // RISK
    // =====================================================

    let risk;


    if (
      coolingLevel === 2
    ) {

      risk = "high";

    } else if (
      coolingLevel === 1
    ) {

      risk = "medium";

    } else {

      risk = "low";

    }


    // =====================================================
    // PREDICTION STATUS
    // =====================================================

    const predictionStatus =
      prediction
        ? "ACTIVE"
        : "SAFETY_FALLBACK";


    // =====================================================
    // FINAL ESP32 RESPONSE
    //
    // IMPORTANT:
    // cooling_level is ALWAYS present.
    // =====================================================

    return res.json({

      success: true,

      inside_temperature:
        insideTemp,

      outside_temperature:
        outsideTemp,

      humidity:
        humidity ?? null,

      voltage:
        voltageValue,

      power_present:
        powerPresent,

      device_connected:
        true,

      mode:
        prediction?.mode ||
        mode,

      prediction_status:
        predictionStatus,

      cooling_level:
        coolingLevel,

      cooling_decision:
        coolingDecision,

      peltier,

      fan,

      trend,

      risk,

      future_temperatures:
        futureTemperatures,

      history_count:
        history.length,

      timestamp:
        insertResult.rows[0]
          .recorded_at

    });


  } catch (error) {

    console.error(
      "ESP32 API error:",
      error
    );


    // =====================================================
    // EVEN OUTER ERROR GETS SAFETY RESPONSE
    //
    // Don't leave ESP32 waiting unnecessarily.
    // =====================================================

    const insideTemp =
      Number(
        req.body?.inside_temperature
      );


    const safeLevel =
      Number.isFinite(
        insideTemp
      )
        ? safetyCoolingLevel(
            insideTemp
          )
        : 0;


    return res.json({

      success: true,

      inside_temperature:
        Number.isFinite(
          insideTemp
        )
          ? insideTemp
          : null,

      prediction_status:
        "SAFETY_FALLBACK",

      cooling_level:
        safeLevel,

      cooling_decision:
        safeLevel > 0
          ? "ON"
          : "OFF",

      peltier:
        safeLevel > 0
          ? "ON"
          : "OFF",

      fan:
        safeLevel > 0
          ? "ON"
          : "OFF",

      trend:
        "UNKNOWN",

      risk:
        safeLevel === 2
          ? "high"
          : "low"

    });

  }

});


export default router;