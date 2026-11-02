import { describe, it, expect } from "vitest";
import { SELF } from "cloudflare:test";
import { specToTestSuite } from "@automata/generator";
import { executeSuiteOnWorker } from "../src/index.js";
import type { TestSuiteDefinition } from "@automata/core";

describe("Cloudflare Workers automated test execution", () => {
  it("executes OpenAPI generated tests on Cloudflare Worker runtime", async () => {
    const openapiSpec = `
openapi: 3.2.1
info:
  title: Users Service
  version: 1.0.0
paths:
  /api/users:
    get:
      summary: Get all users
      responses:
        '200':
          description: List of users
          content:
            application/json:
              schema:
                type: array
    post:
      summary: Create a user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - name
              properties:
                name:
                  type: string
      responses:
        '201':
          description: Created
`;

    const suite = specToTestSuite({
      specType: "openapi",
      content: openapiSpec,
      openApiOptions: { generateNegativeTests: true },
    });

    const executionResult = await executeSuiteOnWorker(suite, SELF);
    expect(executionResult.total).toBe(3);
    expect(executionResult.passed).toBe(3);
    expect(executionResult.failed).toBe(0);
  });

  it("executes OData v2 generated tests on Cloudflare Worker runtime", async () => {
    const odataV2Xml = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="1.0" xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx">
  <edmx:DataServices m:DataServiceVersion="2.0" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata">
    <Schema Namespace="TestModel">
      <EntityType Name="Customer">
        <Key><PropertyRef Name="ID" /></Key>
        <Property Name="ID" Type="Edm.Int32" Nullable="false" />
        <Property Name="Name" Type="Edm.String" />
      </EntityType>
      <EntityContainer Name="Entities">
        <EntitySet Name="Customers" EntityType="TestModel.Customer" />
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

    const suite = specToTestSuite({
      specType: "odata-v2",
      content: odataV2Xml,
      odataV2Options: {
        includeCrud: true,
        sampleKeys: { Customers: 1 },
      },
    });

    const executionResult = await executeSuiteOnWorker(suite, SELF);
    expect(executionResult.total).toBeGreaterThan(0);
    expect(executionResult.failed).toBe(0);
    expect(executionResult.passed).toBe(executionResult.total);
  });

  it("executes OData v4 generated tests on Cloudflare Worker runtime", async () => {
    const odataV4Xml = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="TestModel">
      <EntityType Name="Customer">
        <Key><PropertyRef Name="ID" /></Key>
        <Property Name="ID" Type="Edm.Int32" Nullable="false" />
        <Property Name="Name" Type="Edm.String" />
      </EntityType>
      <EntityContainer Name="Entities">
        <EntitySet Name="Customers" EntityType="TestModel.Customer" />
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

    const suite = specToTestSuite({
      specType: "odata-v4",
      content: odataV4Xml,
      odataV4Options: {
        includeCrud: true,
        sampleKeys: { Customers: 1 },
      },
    });

    const executionResult = await executeSuiteOnWorker(suite, SELF);
    expect(executionResult.total).toBeGreaterThan(0);
    expect(executionResult.failed).toBe(0);
    expect(executionResult.passed).toBe(executionResult.total);
  });

  it("tests worker HTTP methods (OPTIONS, PUT, DELETE, and invalid routes)", async () => {
    const resOpt = await SELF.fetch("http://local.worker/Customers", { method: "OPTIONS" });
    expect(resOpt.status).toBe(200);

    const resPut = await SELF.fetch("http://local.worker/Customers(1)", {
      method: "PUT",
      body: "{}",
    });
    expect(resPut.status).toBe(204);

    const resDel = await SELF.fetch("http://local.worker/Customers(1)", { method: "DELETE" });
    expect(resDel.status).toBe(204);

    const resBadPost = await SELF.fetch("http://local.worker/Customers", {
      method: "POST",
      body: "invalid-json",
    });
    expect(resBadPost.status).toBe(400);

    const resBadApiPost = await SELF.fetch("http://local.worker/api/users", {
      method: "POST",
      body: "invalid-json",
    });
    expect(resBadApiPost.status).toBe(400);

    const resNotFound = await SELF.fetch("http://local.worker/not-exists", { method: "GET" });
    expect(resNotFound.status).toBe(404);
  });

  it("handles assertion failures and catches errors in executeSuiteOnWorker", async () => {
    const failingSuite: TestSuiteDefinition = {
      title: "Failing Suite",
      specType: "openapi",
      basePath: "",
      tests: [
        {
          id: "status_mismatch",
          name: "Status Mismatch",
          request: { method: "GET", path: "/not-exists" },
          expected: {
            statusCode: 200,
            assertions: [{ type: "status", expected: 200 }],
          },
        },
        {
          id: "header_mismatch",
          name: "Header Mismatch",
          request: { method: "GET", path: "/" },
          expected: {
            statusCode: 200,
            assertions: [{ type: "header", headerName: "x-missing-hdr", expected: "expected-val" }],
          },
        },
        {
          id: "body_mismatch",
          name: "Body Mismatch",
          request: { method: "GET", path: "/" },
          expected: {
            statusCode: 200,
            assertions: [{ type: "body-contains", expected: "non-existent-substring" }],
          },
        },
        {
          id: "schema_mismatch",
          name: "Schema Mismatch",
          request: { method: "GET", path: "/" },
          expected: {
            statusCode: 200,
            assertions: [
              {
                type: "json-schema",
                schema: { type: "object", required: ["non_existent_key"] },
              },
            ],
          },
        },
      ],
    };

    const result = await executeSuiteOnWorker(failingSuite, SELF);
    expect(result.failed).toBe(4);
    expect(result.passed).toBe(0);
    expect(result.results[0].error).toContain("Expected status 200, got 404");
    expect(result.results[1].error).toContain("missing expected");
    expect(result.results[2].error).toContain("does not contain");
    expect(result.results[3].error).toContain("JSON schema validation error");
  });
});
