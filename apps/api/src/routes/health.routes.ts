import { Router } from "express";
import { pool } from "../database/pool.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const healthRouter = Router();

healthRouter.get("/", asyncHandler(async (_req, res) => {
  await pool.query("select 1");
  res.json({ status: "ok" });
}));
