export function validationIssue(path, message, code = 'invalid_value') {
  return Object.freeze({ path: Array.isArray(path) ? path : [path], message: String(message), code });
}

export function safeParseJson(raw, validate) {
  let value;
  try {
    value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (error) {
    return {
      success: false,
      error: {
        name: 'ValidationError',
        issues: [validationIssue([], 'Invalid JSON.', 'invalid_json')],
        cause: error,
      },
    };
  }

  try {
    const result = validate(value);
    if (result?.success === false) return result;
    return { success: true, data: result?.data ?? result ?? value };
  } catch (error) {
    return {
      success: false,
      error: {
        name: 'ValidationError',
        issues: error?.issues || [validationIssue([], error?.message || 'Validation failed.')],
        cause: error,
      },
    };
  }
}

export function validateObjectShape(value, shape, { allowUnknown = true } = {}) {
  const issues = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { success: false, error: { name: 'ValidationError', issues: [validationIssue([], 'Expected an object.', 'invalid_type')] } };
  }

  const data = {};
  for (const [key, rule] of Object.entries(shape || {})) {
    const result = rule(value[key], key, value);
    if (result?.success === false) {
      for (const issue of result.error?.issues || []) issues.push(issue);
    } else if (result && 'data' in result) {
      data[key] = result.data;
    } else {
      data[key] = value[key];
    }
  }

  if (!allowUnknown) {
    for (const key of Object.keys(value)) {
      if (!(key in shape)) issues.push(validationIssue([key], 'Unknown field.', 'unrecognized_key'));
    }
  }

  return issues.length
    ? { success: false, error: { name: 'ValidationError', issues } }
    : { success: true, data };
}

export const field = Object.freeze({
  string: ({ required = true, min = 0, max = Infinity, pattern = null } = {}) => (value, key) => {
    if ((value === undefined || value === null) && !required) return { success: true, data: value };
    if (typeof value !== 'string') return { success: false, error: { issues: [validationIssue([key], 'Expected a string.', 'invalid_type')] } };
    if (value.length < min || value.length > max) return { success: false, error: { issues: [validationIssue([key], `String length must be between ${min} and ${max}.`, 'out_of_range')] } };
    if (pattern && !pattern.test(value)) return { success: false, error: { issues: [validationIssue([key], 'String format is invalid.', 'invalid_string')] } };
    return { success: true, data: value };
  },
  number: ({ required = true, min = -Infinity, max = Infinity, integer = false } = {}) => (value, key) => {
    if ((value === undefined || value === null) && !required) return { success: true, data: value };
    const n = typeof value === 'number' ? value : Number.NaN;
    if (!Number.isFinite(n)) return { success: false, error: { issues: [validationIssue([key], 'Expected a finite number.', 'invalid_type')] } };
    if (integer && !Number.isInteger(n)) return { success: false, error: { issues: [validationIssue([key], 'Expected an integer.', 'invalid_type')] } };
    if (n < min || n > max) return { success: false, error: { issues: [validationIssue([key], `Number must be between ${min} and ${max}.`, 'out_of_range')] } };
    return { success: true, data: n };
  },
  stringArray: ({ required = true, maxItems = Infinity } = {}) => (value, key) => {
    if ((value === undefined || value === null) && !required) return { success: true, data: value };
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return { success: false, error: { issues: [validationIssue([key], 'Expected an array of strings.', 'invalid_type')] } };
    if (value.length > maxItems) return { success: false, error: { issues: [validationIssue([key], `Too many items; maximum is ${maxItems}.`, 'too_big')] } };
    return { success: true, data: [...value] };
  },
  literal: (expected) => (value, key) => value === expected
    ? { success: true, data: value }
    : { success: false, error: { issues: [validationIssue([key], `Expected ${JSON.stringify(expected)}.`, 'invalid_literal')] } },
});
