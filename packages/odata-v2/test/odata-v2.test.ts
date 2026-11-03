import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseODataV2Metadata, generateODataV2Tests } from "../src/index.js";

describe("@automata/odata-v2", () => {
  const xml = readFileSync(join(__dirname, "fixtures/northwind-v2.xml"), "utf-8");

  it("throws error when DataServices element is missing", () => {
    expect(() => parseODataV2Metadata('<edmx:Edmx Version="1.0"></edmx:Edmx>')).toThrow(
      "Invalid OData v2 metadata",
    );
  });

  it("parses OData v2 CSDL metadata XML correctly", () => {
    const spec = parseODataV2Metadata(xml, { basePath: "/Northwind/Northwind.svc" });
    expect(spec.specType).toBe("odata-v2");
    expect(spec.basePath).toBe("/Northwind/Northwind.svc");
    expect(spec.entities?.length).toBe(2);

    const customer = spec.entities?.find((e) => e.name === "Customer");
    expect(customer).toBeDefined();
    expect(customer?.entitySetName).toBe("Customers");
    expect(customer?.keys).toEqual(["CustomerID"]);
    expect(customer?.properties.length).toBe(3);

    const getTopCustomers = spec.operations.find((o) => o.id === "fn_GetTopCustomers");
    expect(getTopCustomers).toBeDefined();
    expect(getTopCustomers?.method).toBe("GET");
  });

  it("parses schema with navigation properties, parameters, and various property types", () => {
    const sampleXml = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="1.0" xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx">
  <edmx:DataServices>
    <Schema Namespace="Demo">
      <EntityType Name="Order">
        <Key>
          <PropertyRef Name="OrderID" />
        </Key>
        <Property Name="OrderID" Type="Edm.Guid" Nullable="false" />
        <Property Name="IsShipped" Type="Edm.Boolean" />
        <Property Name="Amount" Type="Edm.Decimal" />
        <NavigationProperty Name="Customer" ToRole="Customer" Relationship="Order_Customer_Many" />
      </EntityType>
      <EntityType Name="IntEntity">
        <Key>
          <PropertyRef Name="Count" />
        </Key>
        <Property Name="Count" Type="Edm.Int32" Nullable="false" />
      </EntityType>
      <EntityType Name="EmptyPropEntity">
      </EntityType>
      <EntityContainer Name="Container">
        <EntitySet Name="Orders" EntityType="Demo.Order" />
        <EntitySet Name="IntEntities" EntityType="Demo.IntEntity" />
        <EntitySet Name="EmptyProps" EntityType="Demo.EmptyPropEntity" />
        <FunctionImport Name="CalculateTax" ReturnType="Edm.Decimal" m:HttpMethod="POST">
          <Parameter Name="rate" Type="Edm.Decimal" Nullable="false" />
          <Parameter Name="exempt" Type="Edm.Boolean" Nullable="true" />
        </FunctionImport>
        <FunctionImport Name="SimpleAction" />
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

    const spec = parseODataV2Metadata(sampleXml);
    expect(spec.entities?.length).toBe(3);

    const tests = generateODataV2Tests(spec, { includeCrud: true });
    expect(tests.tests.length).toBeGreaterThan(0);
    const orderKeyTest = tests.tests.find((t) => t.id === "v2_get_key_Orders");
    expect(orderKeyTest?.request.path).toContain("00000000-0000-0000-0000-000000000001");

    const intKeyTest = tests.tests.find((t) => t.id === "v2_get_key_IntEntities");
    expect(intKeyTest?.request.path).toBe("/IntEntities(1)");

    const emptyPropTest = tests.tests.find((t) => t.id === "v2_get_key_EmptyProps");
    expect(emptyPropTest).toBeDefined();

    // Also test with includeCrud false
    const noCrud = generateODataV2Tests(spec, { includeCrud: false });
    expect(noCrud.tests.some((t) => t.id.includes("create"))).toBe(false);
  });

  it("generates OData v2 test suite with CRUD and OData v2 specific headers/conventions", () => {
    const spec = parseODataV2Metadata(xml);
    const suite = generateODataV2Tests(spec, {
      includeCrud: true,
      sampleKeys: { Customers: "ALF'KI", Products: 1 },
    });

    expect(suite.specType).toBe("odata-v2");
    expect(suite.tests.length).toBeGreaterThan(10);

    const getCustomerByKey = suite.tests.find((t) => t.id === "v2_get_key_Customers");
    expect(getCustomerByKey).toBeDefined();
    expect(getCustomerByKey?.request.path).toBe("/Customers('ALF''KI')");
    expect(getCustomerByKey?.request.headers?.["DataServiceVersion"]).toBe("2.0");

    const getProductByKey = suite.tests.find((t) => t.id === "v2_get_key_Products");
    expect(getProductByKey).toBeDefined();
    expect(getProductByKey?.request.path).toBe("/Products(1)");

    const mergeCustomer = suite.tests.find((t) => t.id === "v2_merge_Customers");
    expect(mergeCustomer).toBeDefined();
    expect(mergeCustomer?.request.headers?.["X-HTTP-Method"]).toBe("MERGE");
  });

  it("handles empty schema and fallback key generation", () => {
    const emptyXml = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="1.0" xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx">
  <edmx:DataServices>
    <Schema>
      <EntityType Name="Item">
        <Key>
          <PropertyRef Name="Code" />
        </Key>
        <Property Name="Code" Type="Edm.String" />
      </EntityType>
      <EntityContainer>
        <EntitySet Name="Items" EntityType="Item" />
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;
    const spec = parseODataV2Metadata(emptyXml);
    const tests = generateODataV2Tests(spec, { includeCrud: true });
    expect(tests.tests.length).toBeGreaterThan(0);
    const itemKeyTest = tests.tests.find((t) => t.id === "v2_get_key_Items");
    expect(itemKeyTest?.request.path).toBe("/Items('KEY1')");
  });
});
