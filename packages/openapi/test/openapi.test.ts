import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseOpenApi, generateOpenApiTests } from "../src/index.js";

describe("@automata/openapi", () => {
  const yamlContent = readFileSync(join(__dirname, "fixtures/petstore-3.2.1.yaml"), "utf-8");

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
