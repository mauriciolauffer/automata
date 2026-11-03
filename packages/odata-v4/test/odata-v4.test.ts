import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseODataV4Metadata, generateODataV4Tests } from "../src/index.js";

describe("@automata/odata-v4", () => {
  const xml = readFileSync(join(__dirname, "fixtures/trippin-v4.xml"), "utf-8");

  it("throws error when DataServices element is missing", () => {
    expect(() => parseODataV4Metadata('<edmx:Edmx Version="4.0"></edmx:Edmx>')).toThrow(
      "Invalid OData v4 metadata",
    );
  });

  it("parses OData v4 CSDL metadata XML correctly", () => {
    const spec = parseODataV4Metadata(xml, { basePath: "/v4/TripPinServiceRW" });
    expect(spec.specType).toBe("odata-v4");
    expect(spec.version).toBe("4.0");
    expect(spec.entities?.length).toBe(2);

    const person = spec.entities?.find((e) => e.name === "Person");
    expect(person).toBeDefined();
    expect(person?.entitySetName).toBe("People");
    expect(person?.keys).toEqual(["UserName"]);
    expect(person?.navigationProperties?.[0].name).toBe("Friends");
    expect(person?.navigationProperties?.[0].isCollection).toBe(true);

    const singleton = spec.operations.find((o) => o.id === "singleton_Me");
    expect(singleton).toBeDefined();

    const action = spec.operations.find((o) => o.id === "action_ResetDataSource");
    expect(action).toBeDefined();
    expect(action?.method).toBe("POST");
  });

  it("parses various property and key types: Guid, Decimal, Boolean, and generates tests", () => {
    const testXml = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="TestV4">
      <EntityType Name="Device">
        <Key>
          <PropertyRef Name="DeviceId" />
        </Key>
        <Property Name="DeviceId" Type="Edm.Guid" Nullable="false" />
        <Property Name="IsActive" Type="Edm.Boolean" />
        <Property Name="Battery" Type="Edm.Decimal" />
      </EntityType>
      <EntityType Name="IntEntity">
        <Key>
          <PropertyRef Name="Count" />
        </Key>
        <Property Name="Count" Type="Edm.Int32" Nullable="false" />
      </EntityType>
      <EntityType Name="Log">
        <Property Name="Message" Type="Edm.String" />
      </EntityType>
      <EntityType Name="EmptyEntity">
      </EntityType>
      <EntityContainer Name="TestContainer">
        <EntitySet Name="Devices" EntityType="TestV4.Device" />
        <EntitySet Name="IntEntities" EntityType="TestV4.IntEntity" />
        <EntitySet Name="Logs" EntityType="Log" />
        <EntitySet Name="EmptyEntities" EntityType="TestV4.EmptyEntity" />
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

    const spec = parseODataV4Metadata(testXml);
    expect(spec.entities?.length).toBe(4);

    const tests = generateODataV4Tests(spec, { includeCrud: true });
    expect(tests.tests.length).toBeGreaterThan(0);

    const deviceKeyTest = tests.tests.find((t) => t.id === "v4_get_key_Devices");
    expect(deviceKeyTest?.request.path).toContain("00000000-0000-0000-0000-000000000001");

    const intKeyTest = tests.tests.find((t) => t.id === "v4_get_key_IntEntities");
    expect(intKeyTest?.request.path).toBe("/IntEntities(1)");

    const logKeyTest = tests.tests.find((t) => t.id === "v4_get_key_Logs");
    expect(logKeyTest?.request.path).toBe("/Logs(1)");

    const emptyTest = tests.tests.find((t) => t.id === "v4_get_key_EmptyEntities");
    expect(emptyTest).toBeDefined();

    const noCrud = generateODataV4Tests(spec, { includeCrud: false });
    expect(noCrud.tests.some((t) => t.id.includes("create"))).toBe(false);
  });

  it("generates OData v4 test suite with $count, singletons, actions, and v4 headers", () => {
    const spec = parseODataV4Metadata(xml);
    const suite = generateODataV4Tests(spec, {
      includeCrud: true,
      sampleKeys: { People: "russell'whyte", Airports: "KSFO" },
    });

    expect(suite.specType).toBe("odata-v4");
    const personByKey = suite.tests.find((t) => t.id === "v4_get_key_People");
    expect(personByKey).toBeDefined();
    expect(personByKey?.request.path).toBe("/People('russell''whyte')");
    expect(personByKey?.request.headers?.["OData-Version"]).toBe("4.0");

    const queryPeople = suite.tests.find((t) => t.id === "v4_query_People");
    expect(queryPeople).toBeDefined();
    expect(queryPeople?.request.queryParams?.["$count"]).toBe(true);

    const patchAirport = suite.tests.find((t) => t.id === "v4_patch_Airports");
    expect(patchAirport).toBeDefined();
    expect(patchAirport?.request.method).toBe("PATCH");

    const resetAction = suite.tests.find((t) => t.id === "action_ResetDataSource");
    expect(resetAction).toBeDefined();
    expect(resetAction?.request.method).toBe("POST");
  });

  it("handles empty container and operation without tags", () => {
    const emptyXml = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema>
      <EntityType Name="Widget">
        <Key>
          <PropertyRef Name="Id" />
        </Key>
        <Property Name="Id" Type="Edm.String" />
      </EntityType>
      <EntityContainer>
        <EntitySet Name="Widgets" EntityType="Widget" />
        <FunctionImport Name="DoSomething" />
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;
    const spec = parseODataV4Metadata(emptyXml);
    // Remove tags from operation to hit fallback branch
    spec.operations[0].tags = undefined;
    const tests = generateODataV4Tests(spec, { includeCrud: true });
    expect(tests.tests.length).toBeGreaterThan(0);
    const doSomethingTest = tests.tests.find((t) => t.id === "fn_DoSomething");
    expect(doSomethingTest?.group).toBe("Operations");
    expect(doSomethingTest?.tags).toEqual(["operation"]);
  });
});
