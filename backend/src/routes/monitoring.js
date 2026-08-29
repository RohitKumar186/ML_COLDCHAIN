import { Router } from "express";
import pool from "../db/pool.js";

const router = Router();

// =========================================================
// SENSOR TIMEOUT
//
// ESP32 normally sends approximately every 10 seconds.
// If the complete device stops sending for 30 seconds,
// device is OFFLINE.
//
// For individual sensors:
// If that particular sensor has not produced a valid
// reading for 30 seconds while other sensors are still
// reporting, only that sensor is marked as FAILED.
// =========================================================

const DEVICE_TIMEOUT_SECONDS = 30;
const SENSOR_TIMEOUT_SECONDS = 30;


// =========================================================
// GET /api/monitoring
//
// Returns:
// - latest healthy sensor values
// - device connection state
// - individual sensor failure states
// =========================================================

router.get("/", async (req, res) => {
  try {

    // =====================================================
    // LATEST DEVICE HEARTBEAT
    //
    // This is the latest row received from ESP32.
    // It tells us whether the ESP32/device itself is alive.
    // =====================================================

    const latestResult = await pool.query(`
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
    // NO DATA AT ALL
    // =====================================================

    if (latestResult.rows.length === 0) {

      return res.json({

        insideTemperature: null,
        outsideTemperature: null,
        voltage: null,

        doorOpen: null,
        coolingOn: false,

        deviceConnected: false,

        temperatureFailure: true,
        voltageFailure: true,
        doorFailure: true,

        recordedAt: null,

      });
    }


    const latestRow =
      latestResult.rows[0];


    // =====================================================
    // DEVICE ONLINE CHECK
    // =====================================================

    const latestRecordedTime =
      new Date(
        latestRow.recorded_at
      ).getTime();

    const now =
      Date.now();

    const deviceAgeSeconds =
      (
        now -
        latestRecordedTime
      ) / 1000;


    const deviceOnline =
      deviceAgeSeconds <=
        DEVICE_TIMEOUT_SECONDS &&
      latestRow.device_connected === true;


    // =====================================================
    // DEVICE OFFLINE
    //
    // IMPORTANT:
    // If complete ESP32/device is offline,
    // ALL critical sensors are considered failed.
    // =====================================================

    if (!deviceOnline) {

      return res.json({

        insideTemperature: null,
        outsideTemperature: null,
        voltage: null,

        doorOpen: null,
        coolingOn: false,

        deviceConnected: false,

        temperatureFailure: true,
        voltageFailure: true,
        doorFailure: true,

        recordedAt:
          latestRow.recorded_at,

      });
    }


    // =====================================================
    // GET LATEST VALID READING FOR EACH SENSOR
    //
    // We do NOT simply use the latest row.
    //
    // This allows one sensor to fail while other sensors
    // continue working.
    // =====================================================

    const sensorResult =
      await pool.query(`

        SELECT

          (
            SELECT temperature
            FROM sensor_readings
            WHERE temperature IS NOT NULL
            ORDER BY recorded_at DESC, id DESC
            LIMIT 1
          ) AS latest_temperature,

          (
            SELECT outside_temperature
            FROM sensor_readings
            WHERE outside_temperature IS NOT NULL
            ORDER BY recorded_at DESC, id DESC
            LIMIT 1
          ) AS latest_outside_temperature,

          (
            SELECT voltage
            FROM sensor_readings
            WHERE voltage IS NOT NULL
            ORDER BY recorded_at DESC, id DESC
            LIMIT 1
          ) AS latest_voltage,

          (
            SELECT door_open
            FROM sensor_readings
            WHERE door_open IS NOT NULL
            ORDER BY recorded_at DESC, id DESC
            LIMIT 1
          ) AS latest_door_open,


          (
            SELECT recorded_at
            FROM sensor_readings
            WHERE temperature IS NOT NULL
            ORDER BY recorded_at DESC, id DESC
            LIMIT 1
          ) AS temperature_time,


          (
            SELECT recorded_at
            FROM sensor_readings
            WHERE outside_temperature IS NOT NULL
            ORDER BY recorded_at DESC, id DESC
            LIMIT 1
          ) AS outside_temperature_time,


          (
            SELECT recorded_at
            FROM sensor_readings
            WHERE voltage IS NOT NULL
            ORDER BY recorded_at DESC, id DESC
            LIMIT 1
          ) AS voltage_time,


          (
            SELECT recorded_at
            FROM sensor_readings
            WHERE door_open IS NOT NULL
            ORDER BY recorded_at DESC, id DESC
            LIMIT 1
          ) AS door_time

      `);


    const sensorRow =
      sensorResult.rows[0];


    // =====================================================
    // HELPER
    //
    // Checks whether a sensor's latest valid reading
    // is still fresh.
    // =====================================================

    const isSensorFresh =
      (timestamp) => {

        if (!timestamp) {
          return false;
        }

        const sensorTime =
          new Date(
            timestamp
          ).getTime();

        const age =
          (
            now -
            sensorTime
          ) / 1000;

        return (
          age <=
          SENSOR_TIMEOUT_SECONDS
        );
      };


    // =====================================================
    // INDIVIDUAL SENSOR HEALTH
    // =====================================================

    const temperatureHealthy =
      sensorRow.latest_temperature !== null &&
      isSensorFresh(
        sensorRow.temperature_time
      );


    const voltageHealthy =
      sensorRow.latest_voltage !== null &&
      isSensorFresh(
        sensorRow.voltage_time
      );


    const doorHealthy =
      sensorRow.latest_door_open !== null &&
      isSensorFresh(
        sensorRow.door_time
      );


    // =====================================================
    // SENSOR FAILURE FLAGS
    // =====================================================

    const temperatureFailure =
      !temperatureHealthy;


    const voltageFailure =
      !voltageHealthy;


    const doorFailure =
      !doorHealthy;


    // =====================================================
    // RETURN LIVE MONITORING DATA
    // =====================================================

    return res.json({

      // ---------------------------------------------------
      // TEMPERATURE
      // ---------------------------------------------------

      insideTemperature:
        temperatureHealthy
          ? Number(
              sensorRow.latest_temperature
            )
          : null,


      // ---------------------------------------------------
      // OUTSIDE TEMPERATURE
      //
      // Keep showing it if its own reading is fresh.
      // ---------------------------------------------------

      outsideTemperature:
        sensorRow.latest_outside_temperature !== null &&
        isSensorFresh(
          sensorRow.outside_temperature_time
        )
          ? Number(
              sensorRow.latest_outside_temperature
            )
          : null,


      // ---------------------------------------------------
      // VOLTAGE
      // ---------------------------------------------------

      voltage:
        voltageHealthy
          ? Number(
              sensorRow.latest_voltage
            )
          : null,


      // ---------------------------------------------------
      // DOOR
      // ---------------------------------------------------

      doorOpen:
        doorHealthy
          ? Boolean(
              sensorRow.latest_door_open
            )
          : null,


      // ---------------------------------------------------
      // COOLING
      //
      // Cooling state comes from latest device row.
      // ---------------------------------------------------

      coolingOn:
        Boolean(
          latestRow.cooling_on
        ),


      // ---------------------------------------------------
      // DEVICE
      // ---------------------------------------------------

      deviceConnected:
        true,


      // ---------------------------------------------------
      // INDIVIDUAL FAILURES
      // ---------------------------------------------------

      temperatureFailure,

      voltageFailure,

      doorFailure,


      // ---------------------------------------------------
      // TIMESTAMP
      // ---------------------------------------------------

      recordedAt:
        latestRow.recorded_at,

    });

  } catch (error) {

    console.error(
      "GET /api/monitoring error:",
      error
    );


    res.status(500).json({

      error:
        "Failed to fetch monitoring data",

    });
  }
});


// =========================================================
// POST /api/monitoring
//
// ESP32 → Node → PostgreSQL
//
// IMPORTANT:
// Individual sensor values are allowed to be NULL.
//
// This is required for sensor-failure detection.
//
// Example:
//
// Temperature sensor fails:
//
// inside_temperature = null
// voltage = 230
// door_open = false
//
// Result:
//
// Temperature sensor → FAILURE
// Voltage sensor     → NORMAL
// Door sensor        → NORMAL
// =========================================================

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
    // AT LEAST ONE SENSOR / HEARTBEAT VALUE
    // =====================================================

    if (
      inside_temperature === undefined &&
      outside_temperature === undefined &&
      voltage === undefined &&
      door_open === undefined &&
      device_connected === undefined
    ) {

      return res.status(400).json({

        error:
          "No sensor data received",

      });
    }


    // =====================================================
    // CONVERT NUMERIC VALUES SAFELY
    // =====================================================

    const insideValue =
      inside_temperature === null ||
      inside_temperature === undefined
        ? null
        : Number(
            inside_temperature
          );


    const outsideValue =
      outside_temperature === null ||
      outside_temperature === undefined
        ? null
        : Number(
            outside_temperature
          );


    const voltageValue =
      voltage === null ||
      voltage === undefined
        ? null
        : Number(
            voltage
          );


    // =====================================================
    // INVALID NUMERIC VALUES
    // =====================================================

    if (
      insideValue !== null &&
      !Number.isFinite(
        insideValue
      )
    ) {

      return res.status(400).json({

        error:
          "Invalid inside temperature",

      });
    }


    if (
      outsideValue !== null &&
      !Number.isFinite(
        outsideValue
      )
    ) {

      return res.status(400).json({

        error:
          "Invalid outside temperature",

      });
    }


    if (
      voltageValue !== null &&
      !Number.isFinite(
        voltageValue
      )
    ) {

      return res.status(400).json({

        error:
          "Invalid voltage",

      });
    }


    // =====================================================
    // INSERT
    // =====================================================

    const result =
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

          insideValue,

          outsideValue,

          voltageValue,

          door_open === null ||
          door_open === undefined
            ? null
            : Boolean(
                door_open
              ),

          cooling_on === null ||
          cooling_on === undefined
            ? false
            : Boolean(
                cooling_on
              ),

          device_connected === null ||
          device_connected === undefined
            ? true
            : Boolean(
                device_connected
              ),

        ]
      );


    const row =
      result.rows[0];


    // =====================================================
    // RESPONSE
    // =====================================================

    return res.status(201).json({

      message:
        "Sensor reading stored successfully",

      data: {

        insideTemperature:
          row.temperature !== null
            ? Number(
                row.temperature
              )
            : null,

        outsideTemperature:
          row.outside_temperature !== null
            ? Number(
                row.outside_temperature
              )
            : null,

        voltage:
          row.voltage !== null
            ? Number(
                row.voltage
              )
            : null,

        doorOpen:
          row.door_open !== null
            ? Boolean(
                row.door_open
              )
            : null,

        coolingOn:
          Boolean(
            row.cooling_on
          ),

        deviceConnected:
          Boolean(
            row.device_connected
          ),

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

      error:
        "Failed to store monitoring data",

      details:
        error.message,

    });
  }
});


export default router;