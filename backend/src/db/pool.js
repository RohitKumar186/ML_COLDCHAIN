
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

// =========================================================
// VALIDATE DATABASE CONFIGURATION
// =========================================================

const required = [
  "DB_HOST",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
  "DB_PORT",
];

const missing = required.filter(
  (key) => !process.env[key] || !String(process.env[key]).trim()
);

if (missing.length > 0) {
  throw new Error(
    `Missing database environment variables: ${missing.join(", ")}`
  );
}

const port = Number(process.env.DB_PORT);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("DB_PORT must be a valid port number.");
}

// =========================================================
// SSL CONFIGURATION
// Local PostgreSQL: DB_SSL=disable
// Render PostgreSQL: DB_SSL=require
// =========================================================

const sslMode = String(
  process.env.DB_SSL || "disable"
).toLowerCase();

let ssl = false;

if (["true", "require", "on"].includes(sslMode)) {
  ssl = {
    rejectUnauthorized:
      process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
  };
} else if (!["false", "disable", "off", ""].includes(sslMode)) {
  throw new Error("DB_SSL must be disable or require.");
}

// =========================================================
// POSTGRESQL CONNECTION POOL
// =========================================================

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: String(process.env.DB_PASSWORD),
  port,
  ssl,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

// =========================================================
// CONNECTION EVENTS
// =========================================================

pool.on("connect", () => {
  console.log("PostgreSQL connection established.");
});

pool.on("error", (error) => {
  console.error(
    "Unexpected PostgreSQL pool error:",
    error.message
  );
});

export default pool;
