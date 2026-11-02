import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseOpenApi, generateOpenApiTests } from "../src/index.js";

describe("@automata/openapi", () => {
  const yamlContent = readFileSync(join(__dirname, "fixtures/petstore-3.2.1.yaml"), "utf-8");

  it("throws error when neither openapi nor swagger property is found", () => {
    expect(() => parseOpenApi({})).toThrow("Invalid API specification");
    expect(() => parseOpenApi("title: Invalid")).toThrow("Invalid API specification");
  });

  it("parses OpenAPI 3.2.1 YAML correctly", () => {
    const spec = parseOpenApi(yamlContent);
    expect(spec.title).toBe("PetStore Sample API");
    expect(spec.basePath).toBe("/api/v1");
    expect(spec.operations.length).toBe(3);

    const listPets = spec.operations.find((o) => o.id === "listPets");
    expect(listPets).toBeDefined();
    expect(listPets?.method).toBe("GET");
    expect(listPets?.parameters[0].name).toBe("limit");

    const showPetById = spec.operations.find((o) => o.id === "showPetById");
    expect(showPetById).toBeDefined();
    expect(showPetById?.parameters[0].name).toBe("petId");
  });

  it("parses JSON format and handles custom basePath or server with non-root URL", () => {
    const jsonSpec = JSON.stringify({
      openapi: "3.0.0",
      info: { title: "JSON API", version: "2.0.0" },
      servers: [{ url: "https://api.example.com/v2" }],
      paths: {
        "/items": {
          parameters: [{ name: "commonId", in: "header", required: true }],
          get: {
            operationId: "getItems",
            parameters: [
              { name: "X-Header", in: "header", required: true, example: "h-val" },
              { name: "sort", in: "query", required: true, default: "asc" },
              { name: "extra", in: "header", required: true },
              { name: "extraQ", in: "query", required: true },
              { name: "optQ", in: "query", required: false },
              { name: "optH", in: "header", required: false },
            ],
            responses: {
              "200": {
                description: "Success",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        name: { type: "string", example: "Widget" },
                        price: { type: "number", default: 9.99 },
                        active: { type: "boolean" },
                        tags: { type: "array", items: { type: "string" } },
                        emptyArray: { type: "array" },
                        unknown: { type: "unknown_type" },
                      },
                    },
                  },
                },
              },
            },
          },
          post: {
            operationId: "createItem",
            parameters: [
              { name: "customId", in: "path", default: "def-123" },
              { name: "otherId", in: "path" },
            ],
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "string",
                    default: "sample-default",
                  },
                },
              },
            },
            responses: {
              "201": {
                description: "Created",
              },
            },
          },
          put: {
            operationId: "putItem",
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "integer",
                  },
                },
              },
            },
            responses: {
              "204": { description: "No content" },
            },
          },
          patch: {
            operationId: "patchItem",
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "boolean",
                  },
                },
              },
            },
            responses: {
              "200": {
                description: "Patched",
              },
            },
          },
          delete: {
            operationId: "deleteItem",
            responses: {
              invalidStatus: { description: "Invalid" },
            },
          },
        },
        "/invalid-path": null,
      },
    });

    const parsed = parseOpenApi(jsonSpec, { basePath: "/v2" });
    expect(parsed.basePath).toBe("/v2");
    expect(parsed.operations.length).toBe(5);

    const tests = generateOpenApiTests(parsed, {
      defaultHeaders: { "X-Auth": "Token" },
      samplePathValues: { customId: 999, otherId: { toString: () => "obj-val" } as any },
    });
    expect(tests.tests.length).toBe(5);
    expect(tests.tests[0].request.headers?.["X-Header"]).toBe("h-val");
    expect(tests.tests[0].request.queryParams?.["sort"]).toBe("asc");
    expect(tests.tests[1].request.body).toBe("sample-default");
    expect(tests.tests[2].request.body).toBe(1);
    expect(tests.tests[3].request.body).toBe(true);
    expect(tests.tests[4].expected.statusCode).toBe(200);
  });

  it("parses OpenAPI without responses or servers and provides defaults", () => {
    const minSpec = {
      openapi: "3.0.0",
      info: {},
      paths: {
        "/ping": {
          get: {
            summary: "Ping",
          },
        },
      },
    };
    const parsed = parseOpenApi(minSpec);
    expect(parsed.operations[0].responses[0].statusCode).toBe(200);

    const tests = generateOpenApiTests(parsed);
    expect(tests.tests[0].expected.statusCode).toBe(200);
  });

  it("generates test definitions from parsed OpenAPI spec", () => {
    const spec = parseOpenApi(yamlContent);
    const suite = generateOpenApiTests(spec, {
      generateNegativeTests: true,
      samplePathValues: { petId: "42" },
    });

    expect(suite.title).toBe("PetStore Sample API Test Suite");
    expect(suite.tests.length).toBe(4);

    const getByIdTest = suite.tests.find((t) => t.id === "showPetById");
    expect(getByIdTest).toBeDefined();
    expect(getByIdTest?.request.path).toBe("/pets/42");
    expect(getByIdTest?.expected.statusCode).toBe(200);

    const postNegTest = suite.tests.find((t) => t.id === "createPet_missing_body");
    expect(postNegTest).toBeDefined();
    expect(postNegTest?.expected.statusCode).toBe(400);
  });
});
