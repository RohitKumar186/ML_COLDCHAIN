
import { Router } from "express";
import pool from "../db/pool.js";

const router = Router();

// Format database row for frontend
function formatVaccine(row) {
  return {
    id: row.id,
    name: row.name,
    productIdentifier: row.product_identifier,
    minStorageTemp:
      row.min_storage_temp === null
        ? null
        : Number(row.min_storage_temp),
    maxStorageTemp:
      row.max_storage_temp === null
        ? null
        : Number(row.max_storage_temp),
    temperatureUnit: row.temperature_unit,
    storageInstructions: row.storage_instructions,
    sourceReference: row.source_reference,
    isActive: row.is_active,
    configurationVerified: row.configuration_verified,
  };
}

// Validate temperature configuration
function isValidTemperatureConfiguration(vaccine) {
  const min = vaccine.minStorageTemp;
  const max = vaccine.maxStorageTemp;

  return (
    typeof min === "number" &&
    Number.isFinite(min) &&
    typeof max === "number" &&
    Number.isFinite(max) &&
    min < max &&
    vaccine.temperatureUnit === "C" &&
    vaccine.configurationVerified === true
  );
}

// Shared database query
const VACCINE_QUERY = `
  SELECT
    id,
    name,
    product_identifier,
    min_storage_temp,
    max_storage_temp,
    temperature_unit,
    storage_instructions,
    source_reference,
    is_active,
    configuration_verified
  FROM vaccines
`;

// GET /api/vaccines
// Fetch all active vaccines
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      ${VACCINE_QUERY}
      WHERE is_active = TRUE
      ORDER BY name ASC, id ASC
    `);

    const vaccines = result.rows.map(formatVaccine);

    return res.status(200).json({
      success: true,
      count: vaccines.length,
      vaccines,
    });
  } catch (error) {
    console.error("VACCINES API ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to fetch vaccines from the database.",
    });
  }
});

// GET /api/vaccines/:id
// Fetch one active vaccine by ID
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid vaccine ID.",
      });
    }

    const result = await pool.query(
      `
        ${VACCINE_QUERY}
        WHERE id = $1 AND is_active = TRUE
        LIMIT 1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Vaccine not found.",
      });
    }

    const vaccine = formatVaccine(result.rows[0]);

    return res.status(200).json({
      success: true,
      vaccine,
      temperatureConfigurationValid:
        isValidTemperatureConfiguration(vaccine),
    });
  } catch (error) {
    console.error("VACCINE DETAIL API ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to fetch vaccine details from the database.",
    });
  }
});

export default router;
