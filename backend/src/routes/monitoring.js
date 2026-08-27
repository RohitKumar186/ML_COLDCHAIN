import { Router } from "express";
import pool from "../db/pool.js";

const router = Router();

/*
  GET /api/monitoring

  Returns the latest sensor reading from PostgreSQL.
*/

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        temperature,
        humidity,
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
        temperature: null,
        humidity: null,
        voltage: null,
        doorOpen: false,
        coolingOn: false,
        deviceConnected: false,
        recordedAt: null,
      });
    }

    const row = result.rows[0];

    res.json({
      temperature: Number(row.temperature),
      humidity: Number(row.humidity),
      voltage: Number(row.voltage),

      doorOpen: row.door_open,
      coolingOn: row.cooling_on,
      deviceConnected: row.device_connected,

      recordedAt: row.recorded_at,
    });

  } catch (error) {
    console.error("GET /api/monitoring error:", error);

    res.status(500).json({
      error: "Failed to fetch monitoring data",
    });
  }
});

export default router;