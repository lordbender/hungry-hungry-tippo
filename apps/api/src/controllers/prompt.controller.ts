import type { Request, Response } from "express";
import { PromptRequestSchema } from "@hhh/contracts";
import { promptWorkflowService } from "../services/prompt-workflow.service.js";

export async function submitPrompt(req: Request, res: Response) {
  const request = PromptRequestSchema.parse(req.body);
  const result = await promptWorkflowService.submitPrompt(request);

  res.status(201).json(result);
}
