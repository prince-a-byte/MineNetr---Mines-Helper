/** Normalized error for every service call (mock or HTTP). */
export class ApiError extends Error {
  status?: number;
  fields?: Record<string, string>;
  constructor(message: string, opts?: { status?: number; fields?: Record<string, string> }) {
    super(message);
    this.name = 'ApiError';
    this.status = opts?.status;
    this.fields = opts?.fields;
  }
  static notImplemented(where: string): ApiError {
    return new ApiError(`${where} is not implemented for the HTTP backend yet.`, { status: 501 });
  }
  static offline(): ApiError {
    return new ApiError('You appear to be offline. Check your connection and retry.');
  }
}
