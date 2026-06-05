export type ApprovalSubmissionStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "PARTIALLY_APPROVED"
  | "CANCELLED";

export type ApprovalSubmissionRequesterDTO = {
  id: number;
  role: string | null;
  is_deleted: number;
  is_block: number;
};

export type ApprovalSubmissionDTO = {
  id: number;
  category: string | null;
  contextType: string;
  contextId: number;
  status: ApprovalSubmissionStatus;
  requestedBy: ApprovalSubmissionRequesterDTO;
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
  itemId: string;
  itemSnapshot: string | null;
  status: ApprovalSubmissionItemStatus;
  decidedAt: string | null;
  itemNote: string | null;
};

export type ReviewAllApprovalSubmissionDTO = {
  submission: ApprovalSubmissionDTO;
  items: ApprovalSubmissionItemDTO[];
};

export type ApprovalSubmissionWithItemsDTO = ApprovalSubmissionDTO & {
  items: ApprovalSubmissionItemDTO[];
};

export type ListApprovalSubmissionsDTO = {
  submissions: ApprovalSubmissionWithItemsDTO[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
};
