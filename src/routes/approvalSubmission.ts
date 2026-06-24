import { Router } from "express";
import {
  approveAllApprovalSubmission,
  createApprovalSubmission,
  createApprovalSubmissionItem,
  getApprovalSubmission,
  getApprovalSubmissionItem,
  listApprovalSubmissions,
  listMyApprovalSubmissions,
  rejectAllApprovalSubmission,
  updateApprovalSubmissionItemStatus,
  updateApprovalSubmissionStatus,
} from "../controllers/approvalSubmission";
import { verifyToken } from "../middleware/auth";

const approvalSubmissionRouter = Router();

approvalSubmissionRouter.get("/", verifyToken, listApprovalSubmissions);
approvalSubmissionRouter.get("/user-submissions", verifyToken, listMyApprovalSubmissions);
approvalSubmissionRouter.get("/:id", verifyToken, getApprovalSubmission);
approvalSubmissionRouter.post("/", verifyToken, createApprovalSubmission);
approvalSubmissionRouter.patch("/:id/status", verifyToken, updateApprovalSubmissionStatus);
approvalSubmissionRouter.post("/:id/approve-all", verifyToken, approveAllApprovalSubmission);
approvalSubmissionRouter.post("/:id/reject-all", verifyToken, rejectAllApprovalSubmission);
approvalSubmissionRouter.post(
  "/:submissionId/items",
  verifyToken,
  createApprovalSubmissionItem
);
approvalSubmissionRouter.get("/items/:itemId", verifyToken, getApprovalSubmissionItem);
approvalSubmissionRouter.patch(
  "/items/:itemId/status",
  verifyToken,
  updateApprovalSubmissionItemStatus
);

export default approvalSubmissionRouter;
