import { describe, it, expect } from "vitest";
import { SELF } from "cloudflare:test";
import { specToTestSuite } from "@automata/generator";
import { executeSuiteOnWorker } from "../src/index.js";

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
});
