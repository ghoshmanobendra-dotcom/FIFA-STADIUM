/**
 * Tiny, dependency-free request validation helpers.
 *
 * Rather than pull in a schema library, we expose small, composable validators
 * that assert shape, coerce safe types, and enforce bounds. This keeps
 * untrusted input from reaching the services and caps the size of anything
 * forwarded to the AI provider (a cost and abuse-mitigation control). Every
 * failure is a 400 carrying a machine-readable `code` for clients.
 */

/** Maximum length for any free-text field forwarded to the model. */
export const MAX_TEXT_LENGTH = 500;

/** Error with an HTTP status and a stable, machine-readable code. */
export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {number} [status]
   * @param {string} [code]
   */
  constructor(message, status = 400, code = 'bad_request') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** Back-compat alias — validation failures are ApiErrors with status 400. */
export class ValidationError extends ApiError {
  constructor(message, code = 'validation_error') {
    super(message, 400, code);
    this.name = 'ValidationError';
  }
}

/**
 * Require a non-empty string within the allowed length.
 * @param {unknown} value
 * @param {string} field
 * @param {number} [max]
 * @returns {string}
 */
export function requireString(value, field, max = MAX_TEXT_LENGTH) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`"${field}" is required and must be a non-empty string`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new ValidationError(`"${field}" must be ${max} characters or fewer`);
  }
  return trimmed;
}

/**
 * Optional string with the same safety limits.
 * @param {unknown} value
 * @param {string} field
 * @param {number} [max]
 * @returns {string|undefined}
 */
export function optionalString(value, field, max = MAX_TEXT_LENGTH) {
  if (value === undefined || value === null || value === '') return undefined;
  return requireString(value, field, max);
}

/**
 * Require a value from a fixed allow-list.
 * @param {unknown} value
 * @param {string} field
 * @param {ReadonlyArray<string>} allowed
 * @returns {string}
 */
export function requireEnum(value, field, allowed) {
  const str = requireString(value, field, 64);
  if (!allowed.includes(str)) {
    throw new ValidationError(`"${field}" must be one of: ${allowed.join(', ')}`);
  }
  return str;
}

/**
 * Require a finite number within an inclusive range. Accepts numeric strings.
 * @param {unknown} value
 * @param {string} field
 * @param {{ min?: number, max?: number, integer?: boolean }} [opts]
 * @returns {number}
 */
export function requireNumber(
  value,
  field,
  { min = -Infinity, max = Infinity, integer = false } = {},
) {
  const num = typeof value === 'number' ? value : Number(value);
  if (value === '' || value === null || value === undefined || !Number.isFinite(num)) {
    throw new ValidationError(`"${field}" is required and must be a number`);
  }
  if (integer && !Number.isInteger(num)) {
    throw new ValidationError(`"${field}" must be a whole number`);
  }
  if (num < min || num > max) {
    throw new ValidationError(`"${field}" must be between ${min} and ${max}`);
  }
  return num;
}

/**
 * Optional number with the same range checks.
 * @param {unknown} value
 * @param {string} field
 * @param {{ min?: number, max?: number, integer?: boolean }} [opts]
 * @returns {number|undefined}
 */
export function optionalNumber(value, field, opts) {
  if (value === undefined || value === null || value === '') return undefined;
  return requireNumber(value, field, opts);
}

/**
 * Coerce a value to a strict boolean. Missing/invalid becomes the default.
 * @param {unknown} value
 * @param {boolean} [fallback]
 * @returns {boolean}
 */
export function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  return fallback;
}

/**
 * Optional array of short strings, bounded in both count and per-item length.
 * Non-string entries are dropped.
 * @param {unknown} value
 * @param {string} field
 * @param {{ maxItems?: number, maxItemLength?: number }} [opts]
 * @returns {string[]|undefined}
 */
export function optionalStringArray(value, field, { maxItems = 20, maxItemLength = 64 } = {}) {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new ValidationError(`"${field}" must be an array of strings`);
  }
  return value.filter((v) => typeof v === 'string' && v.length <= maxItemLength).slice(0, maxItems);
}
