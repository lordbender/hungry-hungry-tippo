import { Router } from "express";
import { submitPrompt } from "../controllers/prompt.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const promptRouter = Router();

promptRouter.post("/", asyncHandler(authenticate), asyncHandler(submitPrompt));
