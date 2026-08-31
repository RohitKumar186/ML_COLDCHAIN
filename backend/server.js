import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import "./src/db/pool.js";

import esp32Router from "./src/routes/esp32.js";
import monitoringRouter from "./src/routes/monitoring.js";
import historyRouter from "./src/routes/history.js";
import predictionRouter from "./src/routes/prediction.js";
import inventoryRouter from "./src/routes/inventory.js";

// import "./src/dummySensor.js";

dotenv.config();

const app = express();

const PORT =
  process.env.PORT || 4000;


// =========================================================
// CORS
// =========================================================

const allowedOrigins = [
  "https://ml-coldchain.onrender.com",
  "http://localhost:5173",
  "http://localhost:3000"
];

app.use(
  cors({
    origin: function (origin, callback) {

      // Allow requests without Origin
      // such as ESP32 / Postman / server-to-server
      if (!origin) {
        return callback(null, true);
      }

      if (
        allowedOrigins.includes(origin)
      ) {
        return callback(null, true);
      }

      console.log(
        "[CORS] Blocked origin:",
        origin
      );

      return callback(
        new Error("Not allowed by CORS")
      );
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "OPTIONS"
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ],

    credentials: false
  })
);


// =========================================================
// BODY PARSER
// =========================================================

app.use(
  express.json()
);


// =========================================================
// HEALTH
// =========================================================

app.get(
  "/api/health",
  (req, res) => {

    res.json({
      status: "ok"
    });

  }
);


// =========================================================
// ESP32 TEST
// =========================================================

app.get(
  "/api/esp32-test",
  (req, res) => {

    res.json({

      status: "ok",

      route:
        "esp32 route loaded"

    });

  }
);


// =========================================================
// ROUTES
// =========================================================

app.use(
  "/api/monitoring",
  monitoringRouter
);

app.use(
  "/api/history",
  historyRouter
);

app.use(
  "/api/prediction",
  predictionRouter
);

app.use(
  "/api/inventory",
  inventoryRouter
);

app.use(
  "/api/esp32",
  esp32Router
);


// =========================================================
// ROOT
//
// This also makes it easier to verify that the
// Render backend is alive.
// =========================================================

app.get(
  "/",
  (req, res) => {

    res.json({
      status: "ok",
      service: "Cold Chain Dashboard Backend"
    });

  }
);


// =========================================================
// 404
// =========================================================

app.use(
  (req, res) => {

    res.status(404).json({
      error: "Not found"
    });

  }
);


// =========================================================
// ERROR HANDLER
// =========================================================

app.use(
  (error, req, res, next) => {

    console.error(
      "[SERVER ERROR]",
      error.message
    );

    if (
      error.message ===
      "Not allowed by CORS"
    ) {

      return res.status(403).json({
        error:
          "CORS origin not allowed"
      });

    }

    return res.status(500).json({
      error:
        "Internal server error"
    });

  }
);


// =========================================================
// START SERVER
// =========================================================

app.listen(
  PORT,
  () => {

    console.log(
      `Cold Chain dashboard backend running on port ${PORT}`
    );

  }
);