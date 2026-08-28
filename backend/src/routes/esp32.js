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
// Flask ML
//   ↓
// PostgreSQL
//
// IMPORTANT:
// ESP32 readings are stored in PostgreSQL.
// Training dataset generation remains a separate step.
// =========================================================

router.post("/", async (req, res) => {
  try {

    const {
      inside_temperature,
      outside_temperature,
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
    // SEND TEMPERATURE TO ML SERVICE
    // =====================================================

    const mlResponse = await fetch(
      ML_URL,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({

          inside_temperature:
            insideTemp,

          outside_temperature:
            outsideTemp

        })
      }
    );


    // =====================================================
    // CHECK ML RESPONSE
    // =====================================================

    if (!mlResponse.ok) {

      throw new Error(
        `ML API returned ${mlResponse.status}`
      );

    }


    const prediction =
      await mlResponse.json();


    console.log(
      "[ESP32 → ML]",
      prediction
    );


    // =====================================================
    // COOLING LEVEL
    //
    // 0 → OFF
    // 1 → LOW
    // 2 → HIGH
    // =====================================================

    const rawCoolingLevel =
      Number(
        prediction.cooling_level ?? 0
      );


    const coolingLevel =
      [0, 1, 2].includes(
        rawCoolingLevel
      )
        ? rawCoolingLevel
        : 0;


    // =====================================================
    // COOLING STATUS
    //
    // Level 0 → OFF
    // Level 1 → ON
    // Level 2 → ON
    // =====================================================

    const coolingOn =
      coolingLevel > 0;


    // =====================================================
    // PELTIER STATUS
    //
    // Cooling level is authoritative.
    //
    // Do NOT trust prediction.peltier.
    // =====================================================

    const peltier =
      coolingOn
        ? "ON"
        : "OFF";


    // =====================================================
    // FAN STATUS
    // =====================================================

    const fan =
      prediction.fan ||
      (coolingOn ? "HIGH" : "OFF");


    // =====================================================
    // SAVE ESP32 READING
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

        powerPresent

      ]
    );


    // =====================================================
    // RESPONSE TO ESP32
    // =====================================================

    return res.json({

      success: true,


      inside_temperature:
        insideTemp,


      outside_temperature:
        outsideTemp,


      cooling_level:
        coolingLevel,


      cooling_decision:
        coolingOn
          ? "ON"
          : "OFF",


      peltier,


      fan,


      trend:
        prediction.trend ||
        "STABLE"

    });


  } catch (error) {

    console.error(
      "ESP32 API error:",
      error
    );


    return res.status(500).json({

      error:
        "Failed to process ESP32 data",

      message:
        error.message

    });

  }
});


export default router;