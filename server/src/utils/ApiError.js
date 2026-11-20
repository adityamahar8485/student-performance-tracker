// Throwing with a statusCode lets the central error handler respond 4xx not 500
export default class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}
