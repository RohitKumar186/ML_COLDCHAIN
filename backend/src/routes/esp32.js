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
// PostgreSQL
//   ↓
// Recent sensor history
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
    // =====================================================

    const mode =
      insideTemp > 12
        ? "PRE_COOLING"
        : "ML_CONTROL";


    // =====================================================
    // GET CURRENT SENSOR HISTORY
    //
    // We fetch recent readings AFTER the current ESP32
    // reading is received.
    //
    // Old records with NULL outside temperature are
    // ignored because ML requires outside temperature.
    // =====================================================

    const historyResult =
      await pool.query(`
        SELECT
          recorded_at AS timestamp,
          temperature AS inside_temp,
          outside_temperature AS outside_temp,
          cooling_on
        FROM sensor_readings
        WHERE outside_temperature IS NOT NULL
        ORDER BY recorded_at DESC, id DESC
        LIMIT 100
      `);


    // =====================================================
    // CREATE HISTORY FOR ML
    //
    // PostgreSQL returns newest first.
    // ML requires chronological order.
    // =====================================================

    const history =
      historyResult.rows
        .reverse()
        .map((row) => ({
          timestamp: row.timestamp,
          inside_temp: Number(row.inside_temp),
          outside_temp: Number(row.outside_temp),
          mode:
            Number(row.inside_temp) > 12
              ? "PRE_COOLING"
              : "ML_CONTROL"
        }));


    // =====================================================
    // ADD CURRENT READING TO HISTORY
    // =====================================================

    history.push({
      timestamp: new Date().toISOString(),

      inside_temp:
        insideTemp,

      outside_temp:
        outsideTemp,

      mode
    });


    // =====================================================
    // SEND LIVE HISTORY TO ML
    // =====================================================

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


    // =====================================================
    // CHECK ML RESPONSE
    // =====================================================

    if (!mlResponse.ok) {

      const errorText =
        await mlResponse.text();

      throw new Error(
        `ML API returned ${mlResponse.status}: ${errorText}`
      );
    }


    const prediction =
      await mlResponse.json();


    // =====================================================
    // COOLING STATUS
    // =====================================================

    const coolingLevel =
      Number(
        prediction.cooling_level ?? 0
      );


    const coolingOn =
      coolingLevel > 0;


    // =====================================================
    // SAVE CURRENT SENSOR READING
    // =====================================================

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
      `,
      [
        insideTemp,
        outsideTemp,
        voltageValue,
        coolingOn,
        true
      ]
    );


    // =====================================================
    // RETURN LIVE ML RESULT TO ESP32
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
        (coolingOn ? "ON" : "OFF"),

      peltier:
        prediction.peltier ||
        (coolingOn ? "ON" : "OFF"),

      fan:
        prediction.fan ||
        (coolingOn ? "ON" : "OFF"),

      trend:
        prediction.trend ||
        "STABLE",

      risk:
        prediction.risk ||
        "low",

      future_temperatures:
        prediction.future_temperatures ||
        []

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