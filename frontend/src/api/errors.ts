export interface ParsedApiError {
  message: string;
  fieldErrors: Record<string, string>;
  status?: number;
}

/**
 * Safely parse any API or Axios error into a human-readable message and field-specific errors.
 * Ensures the returned message is ALWAYS a string, preventing React runtime crashes
 * from rendering non-primitive children (such as FastAPI 422 validation error arrays).
 */
export function parseApiError(
  err: any,
  defaultMessage = 'An unexpected error occurred. Please try again.'
): ParsedApiError {
  const result: ParsedApiError = {
    message: defaultMessage,
    fieldErrors: {},
    status: err?.response?.status,
  };

  if (!err) {
    return result;
  }

  // 1. Network / Connection Errors
  if (!err.response) {
    if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
      result.message =
        'Unable to connect to the server. Please check your network connection and ensure the backend is running.';
    } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      result.message = 'The server took too long to respond. Please try again.';
    } else if (typeof err.message === 'string' && err.message.trim()) {
      result.message = err.message;
    }
    return result;
  }

  const { status, data } = err.response;

  // 2. HTTP 409 Conflict (e.g. Duplicate Email)
  if (status === 409) {
    const detail =
      typeof data?.detail === 'string'
        ? data.detail
        : 'An account with this email address already exists.';
    result.message = detail;
    if (detail.toLowerCase().includes('email')) {
      result.fieldErrors.email = detail;
    }
    return result;
  }

  // 3. HTTP 401 Unauthorized
  if (status === 401) {
    result.message =
      typeof data?.detail === 'string'
        ? data.detail
        : 'Authentication failed. Please verify your credentials.';
    return result;
  }

  // 4. HTTP 403 Forbidden
  if (status === 403) {
    result.message =
      typeof data?.detail === 'string'
        ? data.detail
        : 'You do not have permission to perform this action.';
    return result;
  }

  // 5. HTTP 404 Not Found
  if (status === 404) {
    result.message =
      typeof data?.detail === 'string'
        ? data.detail
        : 'The requested resource was not found.';
    return result;
  }

  // 6. HTTP 500+ Server Errors
  if (status >= 500) {
    result.message =
      'A platform server error occurred. Please try again later or contact support.';
    return result;
  }

  // 7. HTTP 422 Unprocessable Entity (FastAPI / Pydantic validation errors)
  if (status === 422 || data?.detail) {
    const detail = data?.detail;

    // detail is a simple string
    if (typeof detail === 'string') {
      result.message = detail;
      if (detail.toLowerCase().includes('email') && detail.toLowerCase().includes('exists')) {
        result.fieldErrors.email = detail;
      }
      return result;
    }

    // detail is a list of Pydantic validation error objects
    if (Array.isArray(detail)) {
      const messages: string[] = [];

      for (const item of detail) {
        if (typeof item === 'string') {
          messages.push(item);
          continue;
        }

        if (item && typeof item === 'object') {
          const loc = Array.isArray(item.loc) ? item.loc : [];
          // Extract the field name: ['body', 'business_email'] -> 'business_email'
          const field = loc.filter((p: any) => p !== 'body').pop();
          const rawMsg = item.msg || 'Invalid value';

          // Format clean field label for user-facing string
          const fieldLabel = field
            ? String(field)
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (c) => c.toUpperCase())
            : '';

          const userFriendlyMsg = fieldLabel ? `${fieldLabel}: ${rawMsg}` : rawMsg;
          messages.push(userFriendlyMsg);

          if (field) {
            result.fieldErrors[String(field)] = rawMsg;
          }
        }
      }

      if (messages.length > 0) {
        result.message = messages.join('. ');
      }
      return result;
    }

    // detail is a single dictionary / object
    if (detail && typeof detail === 'object') {
      result.message = detail.msg || detail.message || JSON.stringify(detail);
      return result;
    }
  }

  // 8. Other JSON error formats ({ message: '...' } or { error: '...' })
  if (typeof data?.message === 'string' && data.message.trim()) {
    result.message = data.message;
    return result;
  }

  if (typeof data?.error === 'string' && data.error.trim()) {
    result.message = data.error;
    return result;
  }

  if (typeof data === 'string' && data.trim()) {
    result.message = data;
    return result;
  }

  return result;
}
