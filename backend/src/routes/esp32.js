import { Router } from "express";
import pool from "../db/pool.js";

const router = Router();

const ML_URL =
  "https://cold-chain-ml.onrender.com/predict";

// =========================================================
// ML STATE
// =========================================================

// Latest successful ML prediction
let lastMLPrediction = null;

// Prevent multiple ML requests at the same time
let mlPredictionRunning = false;


// =========================================================
// SAFETY CONTROLLER
//
// Target temperature: 2°C - 12°C
//
// > 12°C  -> Level 2
// < 2°C   -> Level 0
// 2-12°C  -> ML decision
// =========================================================

function getSafetyCoolingLevel(insideTemp) {

  if (insideTemp > 12) {
    return 2;
  }

  if (insideTemp < 2) {
    return 0;
  }

  return null;
}


// =========================================================
// BACKGROUND ML PREDICTION
//
// IMPORTANT:
// This function DOES NOT block ESP32 request.
// =========================================================

async function runMLPrediction(
  insideTemp,
  outsideTemp,
  history
) {

  if (mlPredictionRunning) {

    console.log(
      "[ML] Prediction already running. Skipping duplicate request."
    );

    return;
  }

  mlPredictionRunning = true;

  try {

    console.log(
      "[ML] Starting background prediction..."
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

          })
        }
      );


    if (!mlResponse.ok) {

      throw new Error(
        `ML API returned ${mlResponse.status}`
      );
    }


    const prediction =
      await mlResponse.json();


    if (
      prediction &&
      typeof prediction === "object"
    ) {

      lastMLPrediction =
        prediction;


      console.log(
        "[ML] Background prediction updated:",
        {
          cooling_level:
            prediction.cooling_level,

          trend:
            prediction.trend,

          future_points:
            Array.isArray(
              prediction.future_temperatures
            )
              ? prediction.future_temperatures.length
              : 0
        }
      );
    }

  } catch (error) {

    console.error(
      "[ML] Background prediction failed:",
      error.message
    );

  } finally {

    mlPredictionRunning = false;

  }
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
        error:
          "Missing required sensor data"
      });

    }


    const insideTemp =
      Number(
        inside_temperature
      );


    const outsideTemp =
      Number(
        outside_temperature
      );


    const voltageValue =
      Number(
        voltage
      );


    const powerPresent =
      Boolean(
        power_present
      );


    if (
      !Number.isFinite(insideTemp) ||
      !Number.isFinite(outsideTemp) ||
      !Number.isFinite(voltageValue)
    ) {

      return res.status(400).json({
        error:
          "Invalid sensor values"
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
    // SAVE SENSOR DATA FIRST
    // =====================================================

    const initialCooling =
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
          initialCooling,
          true
        ]
      );


    console.log(
      "[ESP32] Sensor reading saved:",
      insertResult.rows[0]
    );


    // =====================================================
    // SAFETY LEVEL
    // =====================================================

    const safetyLevel =
      getSafetyCoolingLevel(
        insideTemp
      );


    // =====================================================
    // CURRENT COOLING LEVEL
    // =====================================================

    let coolingLevel;


    // -----------------------------------------------------
    // HARD SAFETY
    // -----------------------------------------------------

    if (
      safetyLevel !== null
    ) {

      coolingLevel =
        safetyLevel;

    }


    // -----------------------------------------------------
    // SAFE RANGE: USE LAST ML RESULT
    // -----------------------------------------------------

    else if (
      lastMLPrediction &&
      lastMLPrediction.cooling_level != null
    ) {

      const mlLevel =
        Number(
          lastMLPrediction.cooling_level
        );


      if (
        [0, 1, 2].includes(
          mlLevel
        )
      ) {

        coolingLevel =
          mlLevel;

      } else {

        coolingLevel =
          0;

      }

    }


    // -----------------------------------------------------
    // NO ML RESULT YET
    // -----------------------------------------------------

    else {

      coolingLevel =
        0;

    }


    // =====================================================
    // FINAL SAFETY OVERRIDES
    // =====================================================

    if (
      insideTemp > 12
    ) {

      coolingLevel =
        2;

    }


    if (
      insideTemp < 2
    ) {

      coolingLevel =
        0;

    }


    // =====================================================
    // CURRENT STATUS
    // =====================================================

    const coolingOn =
      coolingLevel > 0;


    const coolingDecision =
      coolingOn
        ? "ON"
        : "OFF";


    // =====================================================
    // ML HISTORY
    //
    // Fetch history for background ML.
    // ESP32 response does NOT wait for ML.
    // =====================================================

    let history = [];


    try {

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


      history =
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
              Number(
                row.inside_temp
              ) > 12
                ? "PRE_COOLING"
                : "ML_CONTROL",

            cooling_level:
              Number(
                row.cooling_on
              )
                ? 1
                : 0

          })
        );

    } catch (historyError) {

      console.error(
        "[ESP32] History query failed:",
        historyError.message
      );

    }


    // =====================================================
    // START ML IN BACKGROUND
    //
    // DO NOT await this.
    // =====================================================

    runMLPrediction(
      insideTemp,
      outsideTemp,
      history
    );


    // =====================================================
    // GET LAST ML INFORMATION
    // =====================================================

    const futureTemperatures =
      lastMLPrediction &&
      Array.isArray(
        lastMLPrediction.future_temperatures
      )
        ? lastMLPrediction.future_temperatures
            .map(Number)
            .filter(
              Number.isFinite
            )
        : [];


    const trend =
      lastMLPrediction?.trend ||
      "STABLE";


    // =====================================================
    // RISK
    // =====================================================

    let risk;


    if (
      coolingLevel === 2
    ) {

      risk =
        "high";

    } else if (
      coolingLevel === 1
    ) {

      risk =
        "medium";

    } else {

      risk =
        "low";

    }


    // =====================================================
    // PREDICTION STATUS
    // =====================================================

    const predictionStatus =
      lastMLPrediction
        ? "ACTIVE"
        : "WAITING_FOR_ML";


    // =====================================================
    // IMMEDIATE ESP32 RESPONSE
    //
    // ESP32 DOES NOT WAIT FOR ML.
    // =====================================================

    return res.json({

      success:
        true,

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
        lastMLPrediction?.mode ||
        mode,

      prediction_status:
        predictionStatus,

      cooling_level:
        coolingLevel,

      cooling_decision:
        coolingDecision,

      peltier:
        coolingOn
          ? "ON"
          : "OFF",

      fan:
        coolingOn
          ? "ON"
          : "OFF",

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
      "[ESP32] API error:",
      error.message
    );


    // =====================================================
    // EMERGENCY RESPONSE
    // =====================================================

    const insideTemp =
      Number(
        req.body?.inside_temperature
      );


    let emergencyLevel =
      0;


    if (
      Number.isFinite(
        insideTemp
      )
    ) {

      if (
        insideTemp > 12
      ) {

        emergencyLevel =
          2;

      } else if (
        insideTemp < 2
      ) {

        emergencyLevel =
          0;

      } else if (
        lastMLPrediction &&
        [0, 1, 2].includes(
          Number(
            lastMLPrediction.cooling_level
          )
        )
      ) {

        emergencyLevel =
          Number(
            lastMLPrediction.cooling_level
          );

      }

    }


    return res.json({

      success:
        true,

      inside_temperature:
        Number.isFinite(
          insideTemp
        )
          ? insideTemp
          : null,

      prediction_status:
        "SAFETY_FALLBACK",

      cooling_level:
        emergencyLevel,

      cooling_decision:
        emergencyLevel > 0
          ? "ON"
          : "OFF",

      peltier:
        emergencyLevel > 0
          ? "ON"
          : "OFF",

      fan:
        emergencyLevel > 0
          ? "ON"
          : "OFF",

      trend:
        "UNKNOWN",

      risk:
        emergencyLevel === 2
          ? "high"
          : "low"

    });

  }

});


export default router;