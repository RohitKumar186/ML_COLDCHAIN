import { Router } from "express";
import pool from "../db/pool.js";

const router = Router();

/* =========================================================
   GET /api/inventory
   Get all inventory transactions
========================================================= */

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        vaccine,
        transaction_type AS type,
        quantity AS qty,
        date_time AS time,
        device_id AS device,
        created_at
      FROM inventory_transactions
      ORDER BY date_time DESC, id DESC
    `);

    res.json({
      logs: result.rows,
    });
  } catch (error) {
    console.error("GET /api/inventory error:", error);

    res.status(500).json({
      error: "Failed to fetch inventory records",
    });
  }
});


/* =========================================================
   POST /api/inventory
   Add stock-in / stock-out transaction

   Date and time are generated automatically by PostgreSQL.
========================================================= */

router.post("/", async (req, res) => {
  try {
    const {
      vaccine,
      type,
      quantity,
      deviceId,
    } = req.body || {};

    /* -----------------------------------------------------
       VALIDATION
    ----------------------------------------------------- */

    if (
      !vaccine ||
      !String(vaccine).trim() ||
      !type ||
      !["in", "out"].includes(type) ||
      !quantity ||
      Number(quantity) <= 0
    ) {
      return res.status(400).json({
        error:
          "vaccine, type and a positive quantity are required",
      });
    }

    const qty = Number(quantity);
    const vaccineName = String(vaccine).trim();

    /* -----------------------------------------------------
       CHECK STOCK FOR STOCK OUT
    ----------------------------------------------------- */

    if (type === "out") {
      const stockResult = await pool.query(
        `
        SELECT
          COALESCE(
            SUM(
              CASE
                WHEN transaction_type = 'in'
                  THEN quantity
                ELSE -quantity
              END
            ),
            0
          ) AS available_stock
        FROM inventory_transactions
        WHERE LOWER(vaccine) = LOWER($1)
        `,
        [vaccineName]
      );

      const availableStock = Number(
        stockResult.rows[0].available_stock
      );

      if (qty > availableStock) {
        return res.status(400).json({
          error: `Only ${availableStock} doses of ${vaccineName} are currently available.`,
        });
      }
    }

    /* -----------------------------------------------------
       INSERT TRANSACTION
       
       IMPORTANT:
       date_time is NOT supplied here.
       PostgreSQL automatically uses:
       DEFAULT CURRENT_TIMESTAMP
    ----------------------------------------------------- */

    const result = await pool.query(
      `
      INSERT INTO inventory_transactions (
        vaccine,
        transaction_type,
        quantity,
        device_id
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        vaccine,
        transaction_type AS type,
        quantity AS qty,
        date_time AS time,
        device_id AS device,
        created_at
      `,
      [
        vaccineName,
        type,
        qty,
        deviceId || "VFR-2/8-Unit-A",
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("POST /api/inventory error:", error);

    res.status(500).json({
      error: "Failed to save inventory transaction",
    });
  }
});


/* =========================================================
   NO DELETE ROUTE

   Inventory records are permanent history/audit records.
========================================================= */


export default router;