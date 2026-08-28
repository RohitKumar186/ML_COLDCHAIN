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
// PostgreSQL + ML
// =========================================================

router.post("/", async (req, res) => {
  try {
    const {
      inside_temperature,
      outside_temperature,
      voltage,
      power_present
    } = req.body;

    // -----------------------------------------------------
    // Validate sensor data
    // -----------------------------------------------------

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

    // -----------------------------------------------------
    // Send temperatures to ML service
    // -----------------------------------------------------

    const mlResponse = await fetch(ML_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        inside_temperature:
          Number(inside_temperature),

        outside_temperature:
          Number(outside_temperature)
      })
    });

    if (!mlResponse.ok) {
      throw new Error(
        `ML API returned ${mlResponse.status}`
      );
    }

    const prediction =
      await mlResponse.json();

    // -----------------------------------------------------
    // Cooling status from ML decision
    // -----------------------------------------------------

    const coolingOn =
      Number(
        prediction.cooling_level ?? 0
      ) > 0;

    // -----------------------------------------------------
    // Save ESP32 reading
    // -----------------------------------------------------

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
        Number(inside_temperature),

        Number(outside_temperature),

        Number(voltage),

        coolingOn,

        Boolean(power_present)
      ]
    );

    // -----------------------------------------------------
    // Return ML decision to ESP32
    // -----------------------------------------------------

    res.json({
      success: true,

      inside_temperature:
        Number(inside_temperature),

      outside_temperature:
        Number(outside_temperature),

      cooling_level:
        Number(
          prediction.cooling_level ?? 0
        ),

      peltier:
        prediction.peltier || "OFF",

      fan:
        prediction.fan || "OFF",

      trend:
        prediction.trend || "STABLE"
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