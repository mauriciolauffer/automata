import type {
  ApiSpecDefinition,
  OperationDefinition,
  TestSuiteDefinition,
  TestCaseDefinition,
  AssertionRule,
} from "@automata/core";
import { resolvePath } from "@automata/core";

export interface GenerateOpenApiTestOptions {
  defaultHeaders?: Record<string, string>;
  generateNegativeTests?: boolean;
  samplePathValues?: Record<string, string | number>;
}

export function generateOpenApiTests(
  spec: ApiSpecDefinition,
  options?: GenerateOpenApiTestOptions,
): TestSuiteDefinition {
  const tests: TestCaseDefinition[] = [];

  for (const op of spec.operations) {
    const testCase = createOperationTestCase(op, spec.basePath, options);
    tests.push(testCase);

    if (options?.generateNegativeTests && op.requestBody?.required) {
      tests.push({
        id: `${op.id}_missing_body`,
        name: `${op.method} ${op.path} (Negative - Missing Body)`,
        group: op.tags?.[0] || "Operations",
        request: {
          method: op.method,
          path: resolvePath(op.path, options?.samplePathValues),
          headers: {
            ...options?.defaultHeaders,
          },
        },
        expected: {
          statusCode: 400,
          assertions: [
            {
              type: "status",
              expected: 400,
              message: "Expect 400 Bad Request when required body is missing",
            },
          ],
        },
        tags: [...(op.tags || []), "negative"],
      });
    }
  }

  return {
    title: `${spec.title} Test Suite`,
    specType: "openapi",
    basePath: spec.basePath,
    tests,
  };
}

function createOperationTestCase(
  op: OperationDefinition,
  basePath: string,
  options?: GenerateOpenApiTestOptions,
): TestCaseDefinition {
  const primaryResponse =
    op.responses.find((r) => r.statusCode >= 200 && r.statusCode < 300) || op.responses[0];
  const expectedStatus = primaryResponse?.statusCode || 200;

  const pathParams: Record<string, string | number> = {};
  const queryParams: Record<string, string | number | boolean> = {};
  const headers: Record<string, string> = { ...options?.defaultHeaders };

  for (const param of op.parameters) {
    if (param.in === "path") {
      const val =
        options?.samplePathValues?.[param.name] ?? param.example ?? param.default ?? "sample-id";
      pathParams[param.name] =
        typeof val === "string" || typeof val === "number" ? val : String(val);
    } else if (param.in === "query" && param.required) {
      queryParams[param.name] = (param.example ?? param.default ?? "test") as
        | string
        | number
        | boolean;
    } else if (param.in === "header" && param.required) {
      headers[param.name] = String(param.example ?? param.default ?? "test");
    }
  }

  let requestBody: unknown = undefined;
  if (op.requestBody) {
    headers["Content-Type"] = op.requestBody.contentType;
    if (op.requestBody.example !== undefined) {
      requestBody = op.requestBody.example;
    } else if (op.requestBody.schema) {
      requestBody = generateSampleFromSchema(op.requestBody.schema);
    }
  }

  const assertions: AssertionRule[] = [
    {
      type: "status",
      expected: expectedStatus,
      message: `Expected response status to be ${expectedStatus}`,
    },
  ];

  if (primaryResponse?.contentType) {
    assertions.push({
      type: "header",
      headerName: "content-type",
      expected: primaryResponse.contentType,
      message: `Expected Content-Type header to include ${primaryResponse.contentType}`,
    });
  }

  if (primaryResponse?.schema) {
    assertions.push({
      type: "json-schema",
      schema: primaryResponse.schema,
      message: "Response body should match defined schema",
    });
  }

  return {
    id: op.id,
    name: `${op.method} ${op.path}${op.summary ? ` - ${op.summary}` : ""}`,
    description: op.description,
    group: op.tags?.[0] || "Default",
    request: {
      method: op.method,
      path: resolvePath(op.path, pathParams),
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
      body: requestBody,
    },
    expected: {
      statusCode: expectedStatus,
      assertions,
    },
    tags: op.tags,
  };
}

function generateSampleFromSchema(schema: Record<string, any>): unknown {
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;

  const type = schema.type;
  if (type === "string") return "test-string";
  if (type === "number" || type === "integer") return 1;
  if (type === "boolean") return true;
  if (type === "array") {
    return schema.items ? [generateSampleFromSchema(schema.items)] : [];
  }
  if (type === "object" || schema.properties) {
    const obj: Record<string, unknown> = {};
    const props = schema.properties || {};
    for (const [key, propSchema] of Object.entries<any>(props)) {
      obj[key] = generateSampleFromSchema(propSchema);
    }
    return obj;
  }
  return {};
}
