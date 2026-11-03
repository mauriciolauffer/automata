import { describe, it, expect } from "vitest";
import {
  buildQueryString,
  resolvePath,
  joinPaths,
  parseXml,
  validateSchema,
} from "../src/index.js";

describe("@automata/core utilities", () => {
  describe("buildQueryString", () => {
    it("returns empty string when undefined or empty", () => {
      expect(buildQueryString()).toBe("");
      expect(buildQueryString({})).toBe("");
    });

    it("builds valid query string with encoded parameters and ignores undefined/null", () => {
      const res = buildQueryString({
        $top: 10,
        $filter: "Name eq 'Alice'",
        skip: undefined,
        nullVal: null,
      });
      expect(res).toBe("?%24top=10&%24filter=Name+eq+%27Alice%27");
    });
  });

  describe("resolvePath", () => {
    it("returns path template unmodified when no pathParams provided", () => {
      expect(resolvePath("/api/items")).toBe("/api/items");
    });

    it("resolves parameterized path", () => {
      const path = resolvePath("/api/users/{userId}/orders/{orderId}", {
        userId: "u123",
        orderId: 456,
      });
      expect(path).toBe("/api/users/u123/orders/456");
    });
  });

  describe("joinPaths", () => {
    it("joins base path and subpath correctly with various leading/trailing slashes", () => {
      expect(joinPaths("/api/v1", "/users")).toBe("/api/v1/users");
      expect(joinPaths("/api/v1/", "users")).toBe("/api/v1/users");
      expect(joinPaths("", "/users")).toBe("/users");
      expect(joinPaths("", "users")).toBe("/users");
      expect(joinPaths("/", "users")).toBe("/users");
    });
  });

  describe("parseXml", () => {
    it("parses XML content", () => {
      const xml = `<edmx:Edmx xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx" Version="1.0">
        <edmx:DataServices>
          <Schema Namespace="ODataDemo">
            <EntityType Name="Product">
              <Key><PropertyRef Name="ID" /></Key>
              <Property Name="ID" Type="Edm.Int32" Nullable="false" />
              <Property Name="Name" Type="Edm.String" />
            </EntityType>
          </Schema>
        </edmx:DataServices>
      </edmx:Edmx>`;

      const parsed: any = parseXml(xml);
      expect(parsed.Edmx).toBeDefined();
      expect(parsed.Edmx.DataServices.Schema.EntityType["@_Name"]).toBe("Product");
    });
  });

  describe("validateSchema", () => {
    it("returns valid when no schema provided", () => {
      expect(validateSchema({ foo: "bar" }, undefined).valid).toBe(true);
    });

    it("validates primitive and array types correctly", () => {
      expect(validateSchema("hello", { type: "string" }).valid).toBe(true);
      expect(validateSchema(123, { type: "string" }).valid).toBe(false);
      expect(validateSchema([1, 2], { type: "array" }).valid).toBe(true);
      expect(validateSchema(null, { type: "null" }).valid).toBe(true);
      expect(validateSchema(true, { type: "boolean" }).valid).toBe(true);
      expect(validateSchema(3.14, { type: "integer" }).valid).toBe(false);
      expect(validateSchema("not-a-number", { type: "integer" }).valid).toBe(false);
      expect(validateSchema(10, { type: "integer" }).valid).toBe(true);
    });

    it("validates schema requirements and nested properties", () => {
      const schema = {
        type: "object",
        required: ["id", "title"],
        properties: {
          id: { type: "integer" },
          title: { type: "string" },
          meta: {
            type: "object",
            properties: {
              version: { type: "integer" },
            },
          },
        },
      };

      expect(validateSchema({ id: 1, title: "Item" }, schema).valid).toBe(true);
      expect(validateSchema({ id: "1", title: "Item" }, schema).valid).toBe(false);
      expect(validateSchema({ id: 1 }, schema).valid).toBe(false);
      expect(
        validateSchema({ id: 1, title: "Item", meta: { version: "invalid" } }, schema).valid,
      ).toBe(false);
      expect(validateSchema({ id: 1, title: "Item", meta: { version: 2 } }, schema).valid).toBe(
        true,
      );
    });
  });
});
