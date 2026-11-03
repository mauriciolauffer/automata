import { describe, it, expect } from "vitest";
import { generateVitestCode, generateTestsFromSpec, specToTestSuite } from "../src/index.js";
import type { TestSuiteDefinition } from "@automata/core";

describe("@automata/generator", () => {
  const dummySuite: TestSuiteDefinition = {
    title: "Test Service",
    specType: "openapi",
    basePath: "/api",
    tests: [
      {
        id: "test_get_users",
        name: "GET /users",
        group: "Users",
        request: {
          method: "GET",
          path: "/users",
          headers: { "X-Custom": "value" },
          queryParams: { page: 1 },
          body: { query: "test" },
        },
        expected: {
          statusCode: 200,
          assertions: [
            { type: "status", expected: 200 },
            { type: "header", headerName: "content-type", expected: "application/json" },
            { type: "body-contains", expected: "success" },
            { type: "json-schema", schema: { type: "object" } },
            { type: "custom" as any },
          ],
        },
      },
      {
        id: "test_post_raw_string",
        name: "POST /raw",
        request: {
          method: "POST",
          path: "/raw",
          body: "raw-string-body",
        },
        expected: {
          statusCode: 200,
          assertions: [{ type: "status", expected: 200 }],
        },
      },
    ],
  };

  it("generates Cloudflare Worker vitest test code with SELF.fetch and cloudflare:test imports", () => {
    const code = generateVitestCode(dummySuite, { target: "cloudflare-worker" });
    expect(code).toContain("import { SELF, env } from 'cloudflare:test'");
    expect(code).toContain('describe("Test Service"');
    expect(code).toContain('describe("Users"');
    expect(code).toContain("const response = await SELF.fetch(targetUrl, reqOptions);");
    expect(code).toContain("expect(response.status).toBe(200);");
    expect(code).toContain(
      'expect(response.headers.get("content-type") || \'\').toContain("application/json");',
    );
    expect(code).toContain('expect(text).toContain("success");');
    expect(code).toContain("const validation = validateSchema(json, schema);");
  });

  it("generates standard vitest test code when target is standard", () => {
    const code = generateVitestCode(dummySuite, {
      target: "standard",
      baseUrl: "https://example.com",
    });
    expect(code).not.toContain("cloudflare:test");
    expect(code).toContain("const response = await fetch(targetUrl, reqOptions);");
  });

  it("converts OData v2 spec to test suite and generated code", () => {
    const v2Xml = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="1.0" xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx">
  <edmx:DataServices>
    <Schema Namespace="Test">
      <EntityType Name="Item">
        <Key><PropertyRef Name="Id" /></Key>
        <Property Name="Id" Type="Edm.Int32" Nullable="false" />
      </EntityType>
      <EntityContainer Name="Entities">
        <EntitySet Name="Items" EntityType="Test.Item" />
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

    const suite = specToTestSuite({
      specType: "odata-v2",
      content: v2Xml,
      basePath: "/v2",
    });
    expect(suite.specType).toBe("odata-v2");

    const code = generateTestsFromSpec({
      specType: "odata-v2",
      content: v2Xml,
      basePath: "/v2",
    });
    expect(code).toContain('describe("OData v2 Test Suite"');
  });

  it("converts OData v4 spec to test suite and generated code", () => {
    const v4Xml = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="Test">
      <EntityType Name="Item">
        <Key><PropertyRef Name="Id" /></Key>
        <Property Name="Id" Type="Edm.Int32" Nullable="false" />
      </EntityType>
      <EntityContainer Name="Entities">
        <EntitySet Name="Items" EntityType="Test.Item" />
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

    const suite = specToTestSuite({
      specType: "odata-v4",
      content: v4Xml,
      basePath: "/v4",
    });
    expect(suite.specType).toBe("odata-v4");

    const code = generateTestsFromSpec({
      specType: "odata-v4",
      content: v4Xml,
      basePath: "/v4",
    });
    expect(code).toContain('describe("OData v4 Test Suite"');
  });

  it("throws error for unsupported spec type", () => {
    expect(() =>
      specToTestSuite({
        specType: "unsupported" as any,
        content: "",
      }),
    ).toThrow("Unsupported spec type: unsupported");
  });

  it("end-to-end converts OpenAPI yaml to executable Cloudflare test code", () => {
    const openapiYaml = `
openapi: 3.2.1
info:
  title: Users API
  version: 1.0.0
paths:
  /users:
    get:
      responses:
        '200':
          description: OK
`;
    const code = generateTestsFromSpec({
      specType: "openapi",
      content: openapiYaml,
      basePath: "/api/v1",
      generatorOptions: { target: "cloudflare-worker" },
    });

    expect(code).toContain("import { SELF, env } from 'cloudflare:test'");
    expect(code).toContain('describe("Users API Test Suite"');
    expect(code).toContain("GET /users");
    expect(code).toContain("expect(response.status).toBe(200)");
  });
});
