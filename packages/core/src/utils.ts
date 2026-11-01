import { XMLParser } from "fast-xml-parser";

/**
 * Builds URL query string from object or KeyValuePair.
 */
export function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) return "";
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  }

  const str = searchParams.toString();
  return str ? `?${str}` : "";
}

/**
 * Resolves full path with path parameters replaced.
 * e.g. /users/{id} with { id: '123' } => /users/123
 */
export function resolvePath(
  pathTemplate: string,
  pathParams?: Record<string, string | number>,
): string {
  if (!pathParams) return pathTemplate;
  let resolved = pathTemplate;
  for (const [key, value] of Object.entries(pathParams)) {
    resolved = resolved.replace(new RegExp(`\\{${key}\\}`, "g"), encodeURIComponent(String(value)));
  }
  return resolved;
}

/**
 * Combines base path and endpoint path safely.
 */
export function joinPaths(basePath: string, subPath: string): string {
  const cleanBase = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  const cleanSub = subPath.startsWith("/") ? subPath : `/${subPath}`;
  if (!cleanBase) return cleanSub;
  return `${cleanBase}${cleanSub}`;
}

/**
 * XML parsing wrapper using fast-xml-parser
 */
export function parseXml<T = unknown>(xmlContent: string): T {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    textNodeName: "#text",
  });
  return parser.parse(xmlContent) as T;
}

/**
 * Minimal lightweight JSON schema validator helper for basic schema validation in tests
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateSchema(data: unknown, schema?: Record<string, unknown>): ValidationResult {
  if (!schema) {
    return { valid: true, errors: [] };
  }

  const errors: string[] = [];

  const expectedType = schema.type as string | undefined;
  if (expectedType) {
    const actualType = Array.isArray(data) ? "array" : data === null ? "null" : typeof data;

    if (expectedType === "integer") {
      if (typeof data !== "number" || !Number.isInteger(data)) {
        errors.push(`Expected integer, received ${typeof data}`);
      }
    } else if (actualType !== expectedType) {
      errors.push(`Expected type ${expectedType}, received ${actualType}`);
    }
  }

  if (
    schema.required &&
    Array.isArray(schema.required) &&
    typeof data === "object" &&
    data !== null
  ) {
    const record = data as Record<string, unknown>;
    for (const reqKey of schema.required) {
      if (!(reqKey in record)) {
        errors.push(`Missing required property: ${reqKey}`);
      }
    }
  }

  if (
    schema.properties &&
    typeof schema.properties === "object" &&
    typeof data === "object" &&
    data !== null
  ) {
    const record = data as Record<string, unknown>;
    const properties = schema.properties as Record<string, Record<string, unknown>>;
    for (const [propName, propSchema] of Object.entries(properties)) {
      if (propName in record) {
        const subResult = validateSchema(record[propName], propSchema);
        if (!subResult.valid) {
          for (const err of subResult.errors) {
            errors.push(`${propName}: ${err}`);
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
