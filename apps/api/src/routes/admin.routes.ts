import { Router } from "express";
import {
  createInvoice,
  getOrganizationUsage,
  getOverview,
  listInvoices,
  listOrganizations
} from "../controllers/admin.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireAdmin } from "../middleware/require-admin.js";

export const adminRouter = Router();

adminRouter.use(asyncHandler(authenticate), requireAdmin);

adminRouter.get("/organizations", asyncHandler(listOrganizations));
adminRouter.get("/reports/overview", asyncHandler(getOverview));
adminRouter.get("/reports/organizations/:organizationId", asyncHandler(getOrganizationUsage));
adminRouter.get("/invoices", asyncHandler(listInvoices));
adminRouter.post("/invoices", asyncHandler(createInvoice));
