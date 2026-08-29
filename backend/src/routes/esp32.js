import { Router } from "express";
import pool from "../db/pool.js";

const router = Router();

const ML_URL =
  "https://cold-chain-ml.onrender.com/predict";

// =========================================================
// POST /api/esp32
//
// ESP32
//   ↓
// Node Backend
//   ↓
// PostgreSQL  ← every sensor reading is saved
//   ↓
// Complete valid sensor history
//   ↓
// Flask ML
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
    // DETERMINE MODE
    //
    // > 12°C  → PRE_COOLING
    // <= 12°C → ML_CONTROL
    //
    // IMPORTANT:
    // This mode is for system control.
    // It is NOT a data collection cutoff.
    // =====================================================

    const mode =
      insideTemp > 12
        ? "PRE_COOLING"
        : "ML_CONTROL";

    // =====================================================
    // SAVE CURRENT SENSOR READING FIRST
    //
    // IMPORTANT:
    // Sensor data must be stored even if ML is temporarily
    // unavailable.
    // =====================================================

    const coolingOnFromTemperature =
      insideTemp > 8;

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
    // GET COMPLETE SENSOR HISTORY
    //
    // No LIMIT 100.
    //
    // Every valid reading is available for ML.
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
            Number(row.inside_temp),

          outside_temp:
            Number(row.outside_temp),

          /*
            Mode is derived from temperature so that
            historical rows remain consistent.
          */

          mode:
            Number(row.inside_temp) > 12
              ? "PRE_COOLING"
              : "ML_CONTROL",

          /*
            Keep actual cooling state available
            for future training logic.
          */

          cooling_level:
            Number(row.cooling_on)
              ? 1
              : 0
        })
      );

    // =====================================================
    // SEND COMPLETE HISTORY TO ML
    // =====================================================

    let prediction = null;

    try {
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

      // ===================================================
      // CHECK ML RESPONSE
      // ===================================================

      if (!mlResponse.ok) {

        const errorText =
          await mlResponse.text();

        throw new Error(
          `ML API returned ${mlResponse.status}: ${errorText}`
        );
      }

      prediction =
        await mlResponse.json();

    } catch (mlError) {

      // ===================================================
      // ML FAILURE MUST NOT DELETE SENSOR DATA
      //
      // PostgreSQL reading is already saved.
      // ===================================================

      console.error(
        "ML API error:",
        mlError
      );

      return res.json({
        success: true,

        inside_temperature:
          insideTemp,

        outside_temperature:
          outsideTemp,

        voltage:
          voltageValue,

        power_present:
          powerPresent,

        device_connected:
          true,

        mode,

        prediction_status:
          "ML_UNAVAILABLE",

        cooling_level:
          0,

        cooling_decision:
          "OFF",

        peltier:
          "OFF",

        fan:
          "OFF",

        trend:
          "STABLE",

        risk:
          insideTemp > 12
            ? "high"
            : insideTemp >= 8
            ? "medium"
            : "low",

        future_temperatures:
          [],

        history_count:
          history.length
      });
    }

    // =====================================================
    // COOLING STATUS FROM ML
    // =====================================================

    const coolingLevel =
      Number(
        prediction.cooling_level ?? 0
      );

    const coolingOn =
      coolingLevel > 0;

    // =====================================================
    // RETURN LIVE ML RESULT
    // =====================================================

    res.json({

      success: true,

      inside_temperature:
        insideTemp,

      outside_temperature:
        outsideTemp,

      voltage:
        voltageValue,

      power_present:
        powerPresent,

      device_connected:
        true,

      mode:
        prediction.mode ||
        mode,

      prediction_status:
        prediction.prediction_status ||
        "ACTIVE",

      cooling_level:
        coolingLevel,

      cooling_decision:
        prediction.cooling_decision ||
        (coolingOn
          ? "ON"
          : "OFF"),

      peltier:
        prediction.peltier ||
        (coolingOn
          ? "ON"
          : "OFF"),

      fan:
        prediction.fan ||
        (coolingOn
          ? "ON"
          : "OFF"),

      trend:
        prediction.trend ||
        "STABLE",

      risk:
        prediction.risk ||
        "low",

      future_temperatures:
        prediction.future_temperatures ||
        [],

      history_count:
        history.length

    });

  } catch (error) {

    console.error(
      "ESP32 API error:",
      error
    );

    res.status(500).json({

      error:
        "Failed to process ESP32 data",

      message:
        error.message

    });
  }
});

export default router;