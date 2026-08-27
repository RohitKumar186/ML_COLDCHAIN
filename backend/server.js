import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import "./src/db/pool.js";

import monitoringRouter from "./src/routes/monitoring.js";
import historyRouter from "./src/routes/history.js";
import predictionRouter from "./src/routes/prediction.js";
import inventoryRouter from "./src/routes/inventory.js";
import "./src/dummySensor.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/monitoring", monitoringRouter);
app.use("/api/history", historyRouter);
app.use("/api/prediction", predictionRouter);
app.use("/api/inventory", inventoryRouter);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(
    `Cold Chain dashboard backend running on http://localhost:${PORT}`
  );
});