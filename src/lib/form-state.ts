import type { DatasetImportSummary, DatasetSpecImportSummary } from "@/lib/types";

export type ActionFormStatus = "idle" | "error" | "success";

export type ActionFormState = {
  status: ActionFormStatus;
  message: string | null;
  eventId: number | null;
  redirectTo: string | null;
  navigationMode: "push" | "replace" | null;
  shouldRefresh: boolean;
};

export type DatasetImportActionState = ActionFormState & {
  summary: DatasetImportSummary | null;
};

export type DatasetSpecImportActionState = ActionFormState & {
  summary: DatasetSpecImportSummary | null;
};

export const EMPTY_ACTION_FORM_STATE: ActionFormState = {
  status: "idle",
  message: null,
  eventId: null,
  redirectTo: null,
  navigationMode: null,
  shouldRefresh: false,
};

export const EMPTY_DATASET_IMPORT_ACTION_STATE: DatasetImportActionState = {
  ...EMPTY_ACTION_FORM_STATE,
  summary: null,
};

export const EMPTY_DATASET_SPEC_IMPORT_ACTION_STATE: DatasetSpecImportActionState = {
  ...EMPTY_ACTION_FORM_STATE,
  summary: null,
};
