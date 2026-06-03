export type ApprovalSubmissionStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "PARTIALLY_APPROVED"
  | "CANCELLED";

export type ApprovalSubmissionDTO = {
  id: number;
  category: string | null;
  contextType: string;
  contextId: number;
  status: ApprovalSubmissionStatus;
  requestedBy: number;
  requestedAt: string;
  requestNote: string | null;
  requestPayload: string | null;
  reviewedBy: number | null;
  reviewedAt: string | null;
  reviewNote: string | null;
};

export type ApprovalSubmissionItemStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ApprovalSubmissionItemDTO = {
  id: number;
  submissionId: number;
  itemType: string;
  itemId: number;
  itemSnapshot: string | null;
  status: ApprovalSubmissionItemStatus;
  decidedAt: string | null;
  itemNote: string | null;
};

export type ReviewAllApprovalSubmissionDTO = {
  submission: ApprovalSubmissionDTO;
  items: ApprovalSubmissionItemDTO[];
};
