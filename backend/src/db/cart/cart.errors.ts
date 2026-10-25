// Business errors are different from unexpected database failures.
// The route can use these to return the correct HTTP status.
export class CartBusinessError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
