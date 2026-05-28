/**
 * Logger utility with sanitization for sensitive data
 */

/**
 * Sanitizes an object by removing sensitive fields before logging
 * @param obj - The object to sanitize
 * @returns A sanitized copy of the object
 */
function sanitize(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  const sensitiveFields = [
    "password",
    "token",
    "secret",
    "apiKey",
    "creditCard",
    "ssn",
    "authorization",
  ];

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitize(item));
  }

  const sanitized: Record<string, unknown> = {...obj as Record<string, unknown>};

  for (const key in sanitized) {
    if (Object.prototype.hasOwnProperty.call(sanitized, key)) {
      const lowerKey = key.toLowerCase();

      // Check if the key contains any sensitive field name
      if (sensitiveFields.some((field) => lowerKey.includes(field.toLowerCase()))) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
        // Recursively sanitize nested objects
        sanitized[key] = sanitize(sanitized[key]);
      }
    }
  }

  return sanitized;
}

/**
 * Logger object with sanitization methods
 */
export const sanitizedLogger = {
  /**
   * Logs debug information with sanitization
   * @param message - The message to log
   * @param data - Optional data to log (will be sanitized)
   */
  debug(message: string, data?: unknown): void {
    if (data) {
      console.log(`[DEBUG] ${message}`, sanitize(data));
    } else {
      console.log(`[DEBUG] ${message}`);
    }
  },

  /**
   * Logs information with sanitization
   * @param message - The message to log
   * @param data - Optional data to log (will be sanitized)
   */
  info(message: string, data?: unknown): void {
    if (data) {
      console.log(`[INFO] ${message}`, sanitize(data));
    } else {
      console.log(`[INFO] ${message}`);
    }
  },

  /**
   * Logs warnings with sanitization
   * @param message - The warning message
   * @param data - Optional data to log (will be sanitized)
   */
  warn(message: string, data?: unknown): void {
    if (data) {
      console.warn(`[WARN] ${message}`, sanitize(data));
    } else {
      console.warn(`[WARN] ${message}`);
    }
  },

  /**
   * Logs errors with sanitization
   * @param message - The error message
   * @param error - The error object or data
   */
  error(message: string, error?: unknown): void {
    if (error) {
      console.error(`[ERROR] ${message}`, sanitize(error));
    } else {
      console.error(`[ERROR] ${message}`);
    }
  },
};
