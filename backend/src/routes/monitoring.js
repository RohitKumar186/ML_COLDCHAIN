import { Router } from "express";
import pool from "../db/pool.js";

const router = Router();

/*
  =========================================================
  GET /api/monitoring

  Returns the latest sensor reading from PostgreSQL.

  IMPORTANT:
  ESP32 normally sends data every ~10 seconds.
  If no new reading is received for 30 seconds,
  the device is considered OFFLINE.

  When OFFLINE:
  - Temperature → null
  - Outside temperature → null
  - Voltage → null
  - Cooling → OFF
  - Door → false
  - Device connected → false
  =========================================================
*/

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        temperature,
        outside_temperature,
        voltage,
        door_open,
        cooling_on,
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
      return res.json({
        insideTemperature: null,
        outsideTemperature: null,
        voltage: null,

        doorOpen: false,
        coolingOn: false,
        deviceConnected: false,

        recordedAt: null,
      });
    }

    const row = result.rows[0];

    // =====================================================
    // CHECK ESP32 CONNECTION
    // =====================================================

    const recordedTime =
      new Date(row.recorded_at).getTime();

    const currentTime = Date.now();

    const ageInSeconds =
      (currentTime - recordedTime) / 1000;

    /*
      ESP32 sends approximately every 10 seconds.

      Allow 30 seconds before declaring
      the device offline.
    */

    const deviceOnline =
      ageInSeconds <= 30 &&
      row.device_connected === true;

    // =====================================================
    // ESP32 OFFLINE
    // =====================================================

    if (!deviceOnline) {
      return res.json({
        insideTemperature: null,
        outsideTemperature: null,
        voltage: null,

        doorOpen: false,
        coolingOn: false,

        deviceConnected: false,

        recordedAt: row.recorded_at,
      });
    }

    // =====================================================
    // ESP32 ONLINE
    // =====================================================

    return res.json({
      insideTemperature:
        Number(row.temperature),

      outsideTemperature:
        Number(row.outside_temperature),

      voltage:
        row.voltage !== null
          ? Number(row.voltage)
          : null,

      doorOpen:
        row.door_open,

      coolingOn:
        row.cooling_on,

      deviceConnected: true,

      recordedAt:
        row.recorded_at,
    });

  } catch (error) {
    console.error(
      "GET /api/monitoring error:",
      error
    );

    res.status(500).json({
      error: "Failed to fetch monitoring data",
    });
  }
});


/*
  =========================================================
  POST /api/monitoring

  ESP32 → Node Backend → PostgreSQL

  Stores sensor readings.
  =========================================================
*/

router.post("/", async (req, res) => {
  try {
    const {
      inside_temperature,
      outside_temperature,
      voltage,
      door_open,
      cooling_on,
      device_connected,
    } = req.body;


    // =====================================================
    // VALIDATION
    // =====================================================

    if (
      inside_temperature === undefined ||
      outside_temperature === undefined
    ) {
      return res.status(400).json({
        error:
          "inside_temperature and outside_temperature are required",
      });
    }


    // =====================================================
    // INSERT SENSOR READING
    // =====================================================

    const result = await pool.query(
      `
      INSERT INTO sensor_readings (
        temperature,
        outside_temperature,
        voltage,
        door_open,
        cooling_on,
        device_connected,
        recorded_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        NOW()
      )
      RETURNING
        id,
        temperature,
        outside_temperature,
        voltage,
        door_open,
        cooling_on,
        device_connected,
        recorded_at
      `,
      [
        Number(inside_temperature),

        Number(outside_temperature),

        voltage !== undefined
          ? Number(voltage)
          : null,

        door_open ?? false,

        cooling_on ?? false,

        device_connected ?? true,
      ]
    );


    const row = result.rows[0];


    // =====================================================
    // RESPONSE
    // =====================================================

    return res.status(201).json({
      message:
        "Sensor reading stored successfully",

      data: {
        insideTemperature:
          Number(row.temperature),

        outsideTemperature:
          Number(row.outside_temperature),

        voltage:
          row.voltage !== null
            ? Number(row.voltage)
            : null,

        doorOpen:
          row.door_open,

        coolingOn:
          row.cooling_on,

        deviceConnected:
          row.device_connected,

        recordedAt:
          row.recorded_at,
      },
    });

  } catch (error) {
    console.error(
      "POST /api/monitoring error:",
      error
    );

    res.status(500).json({
      error: "Failed to store monitoring data",
      details: error.message,
    });
  }
});


export default router;