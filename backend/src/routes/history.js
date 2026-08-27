import { Router } from "express";
import { generateHistory } from "../data/dummy.js";

const router = Router();

// GET /api/history -> { data: [...readings], events: [...device/failure events] }
router.get("/", (req, res) => {
  res.json(generateHistory());
});

export default router;
