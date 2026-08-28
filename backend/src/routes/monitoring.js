import { Router } from "express";
import pool from "../db/pool.js";

const router = Router();

/*
  =========================================================
  GET /api/monitoring

  Returns the latest sensor reading from PostgreSQL.
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

    res.json({
      insideTemperature: Number(row.temperature),
      outsideTemperature: Number(row.outside_temperature),
      voltage: Number(row.voltage),

      doorOpen: row.door_open,
      coolingOn: row.cooling_on,
      deviceConnected: row.device_connected,

      recordedAt: row.recorded_at,
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
      device_connected
    } = req.body;


    // -----------------------------------------------------
    // Validate required values
    // -----------------------------------------------------

    if (
      inside_temperature === undefined ||
      outside_temperature === undefined
    ) {
      return res.status(400).json({
        error:
          "inside_temperature and outside_temperature are required"
      });
    }


    // -----------------------------------------------------
    // Insert sensor reading
    // -----------------------------------------------------

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
        device_connected ?? true
      ]
    );


    const row = result.rows[0];


    // -----------------------------------------------------
    // Response to ESP32
    // -----------------------------------------------------

    res.status(201).json({
      message: "Sensor reading stored successfully",

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
          row.recorded_at
      }
    });

  } catch (error) {

    console.error(
      "POST /api/monitoring error:",
      error
    );

    res.status(500).json({
      error: "Failed to store monitoring data",
      details: error.message
    });
  }
});


export default router;