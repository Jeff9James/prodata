/**
 * Input validation utilities.
 *
 * Keeps validation rules centralized and consistent across all API routes.
 */

const MAX_LABEL_LENGTH = 200;
const MAX_STRING_LENGTH = 1000;
const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate a label string (account name, etc.)
 */
export function validateLabel(value: unknown): ValidationError | null {
  if (typeof value !== "string") {
    return { field: "label", message: "Label must be a string" };
  }
  if (value.trim().length === 0) {
    return { field: "label", message: "Label cannot be empty" };
  }
  if (value.length > MAX_LABEL_LENGTH) {
    return {
      field: "label",
      message: `Label must be at most ${MAX_LABEL_LENGTH} characters`,
    };
  }
  return null;
}

/**
 * Validate a platform string (stripe, gumroad, revenuecat, amazon)
 */
export function validatePlatform(value: unknown): ValidationError | null {
  if (typeof value !== "string") {
    return { field: "platform", message: "Platform must be a string" };
  }
  const validPlatforms = ["stripe", "gumroad", "revenuecat", "amazon"];
  if (!validPlatforms.includes(value.toLowerCase())) {
    return {
      field: "platform",
      message: `Platform must be one of: ${validPlatforms.join(", ")}`,
    };
  }
  return null;
}

/**
 * Validate a metric type for goals (revenue, mrr, sales_count, new_customers)
 */
export function validateMetricType(value: unknown): ValidationError | null {
  if (typeof value !== "string") {
    return { field: "metricType", message: "Metric type must be a string" };
  }
  const validTypes = ["revenue", "mrr", "sales_count", "new_customers"];
  if (!validTypes.includes(value)) {
    return {
      field: "metricType",
      message: `Metric type must be one of: ${validTypes.join(", ")}`,
    };
  }
  return null;
}

/**
 * Validate a goal period (daily, weekly, monthly, quarterly, yearly, custom)
 */
export function validateGoalPeriod(value: unknown): ValidationError | null {
  if (typeof value !== "string") {
    return { field: "period", message: "Period must be a string" };
  }
  const validPeriods = ["daily", "weekly", "monthly", "quarterly", "yearly", "custom"];
  if (!validPeriods.includes(value)) {
    return {
      field: "period",
      message: `Period must be one of: ${validPeriods.join(", ")}`,
    };
  }
  return null;
}

/**
 * Validate a numeric value (for amounts, percentages, etc.)
 */
export function validateNumericValue(
  value: unknown,
  fieldName: string,
  min = 0,
  max?: number
): ValidationError | null {
  if (typeof value !== "number" || isNaN(value)) {
    return { field: fieldName, message: `${fieldName} must be a valid number` };
  }
  if (value < min) {
    return { field: fieldName, message: `${fieldName} must be at least ${min}` };
  }
  if (max !== undefined && value > max) {
    return { field: fieldName, message: `${fieldName} must be at most ${max}` };
  }
  return null;
}

/**
 * Validate a UUID
 */
export function validateUUID(value: unknown): ValidationError | null {
  if (typeof value !== "string") {
    return { field: "id", message: "ID must be a string" };
  }
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(value)) {
    return { field: "id", message: "ID must be a valid UUID" };
  }
  return null;
}

/**
 * Validate an integration ID.
 */
export function validateIntegrationId(value: unknown): ValidationError | null {
  if (typeof value !== "string") {
    return { field: "integrationId", message: "Integration ID must be a string" };
  }
  if (value.length === 0 || value.length > 100) {
    return { field: "integrationId", message: "Invalid integration ID length" };
  }
  if (!ID_PATTERN.test(value)) {
    return {
      field: "integrationId",
      message: "Integration ID contains invalid characters",
    };
  }
  return null;
}

/**
 * Validate credentials object.
 * Must be a non-null object with string keys and string values.
 */
export function validateCredentials(
  value: unknown
): ValidationError | null {
  if (value === null || value === undefined || typeof value !== "object" || Array.isArray(value)) {
    return { field: "credentials", message: "Credentials must be an object" };
  }
  const obj = value as Record<string, unknown>;
  for (const [key, val] of Object.entries(obj)) {
    if (typeof key !== "string" || key.length > MAX_STRING_LENGTH) {
      return {
        field: "credentials",
        message: `Invalid credential key: ${key.slice(0, 50)}`,
      };
    }
    if (typeof val !== "string") {
      return {
        field: "credentials",
        message: `Credential "${key}" must be a string value`,
      };
    }
    if (val.length > MAX_STRING_LENGTH) {
      return {
        field: "credentials",
        message: `Credential "${key}" value exceeds maximum length`,
      };
    }
  }
  return null;
}

/**
 * Validate a boolean value.
 */
export function validateBoolean(
  field: string,
  value: unknown
): ValidationError | null {
  if (typeof value !== "boolean") {
    return { field, message: `${field} must be a boolean` };
  }
  return null;
}

/**
 * Validate a date string in YYYY-MM-DD format.
 */
export function validateDateString(
  field: string,
  value: unknown
): ValidationError | null {
  if (typeof value !== "string") {
    return { field, message: `${field} must be a string` };
  }
  if (!DATE_PATTERN.test(value)) {
    return { field, message: `${field} must be in YYYY-MM-DD format` };
  }
  // Verify it's actually a valid calendar date by round-tripping.
  // JavaScript's Date constructor silently rolls over impossible dates
  // (e.g. Feb 30 → Mar 2), so we parse and verify the components match.
  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  // Use UTC to avoid timezone-related date shifts
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { field, message: `${field} is not a valid date` };
  }
  return null;
}

/**
 * Validate an account ID string.
 * Enforces safe characters to prevent injection via path traversal,
 * HTML, or control characters.
 */
export function validateAccountId(value: unknown): ValidationError | null {
  if (typeof value !== "string") {
    return { field: "accountId", message: "Account ID must be a string" };
  }
  if (value.length === 0 || value.length > 200) {
    return { field: "accountId", message: "Invalid account ID length" };
  }
  if (!ID_PATTERN.test(value)) {
    return {
      field: "accountId",
      message: "Account ID contains invalid characters",
    };
  }
  return null;
}
