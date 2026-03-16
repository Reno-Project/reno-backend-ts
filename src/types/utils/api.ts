export type ApiError = {
  message: string;
  details?: unknown;
};

export type ApiSuccess<T> = {
  error: null;
  data: T;
};

export type ApiFailure = {
  error: ApiError;
  data: null;
};

export type APIResponse<T> = ApiSuccess<T> | ApiFailure;
