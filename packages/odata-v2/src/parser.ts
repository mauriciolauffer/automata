import { parseXml } from "@automata/core";
import type {
  ApiSpecDefinition,
  ApiEntityDefinition,
  ApiPropertyDefinition,
  OperationDefinition,
} from "@automata/core";

export interface ParseODataV2Options {
  basePath?: string;
}

function ensureArray<T>(item: T | T[] | undefined): T[] {
  if (item === undefined || item === null) return [];
  return Array.isArray(item) ? item : [item];
}

export function parseODataV2Metadata(
  xmlContent: string,
  options?: ParseODataV2Options,
): ApiSpecDefinition {
  const parsed = parseXml<any>(xmlContent);
  const edmx = parsed.Edmx || parsed;
  const dataServices = edmx.DataServices;
  if (!dataServices) {
    throw new Error("Invalid OData v2 metadata: DataServices element missing");
  }

  const schemas = ensureArray(dataServices.Schema);

  const entities: ApiEntityDefinition[] = [];
  const entityTypeMap = new Map<string, ApiEntityDefinition>();
  const entitySetMap = new Map<string, string>();
  const operations: OperationDefinition[] = [];

  for (const schema of schemas) {
    const namespace = schema["@_Namespace"] || "";

    // EntityTypes
    const entityTypesRaw = ensureArray(schema.EntityType);
    for (const et of entityTypesRaw) {
      const typeName = et["@_Name"];
      const fullTypeName = namespace ? `${namespace}.${typeName}` : typeName;

      // Keys
      const keys: string[] = [];
      if (et.Key?.PropertyRef) {
        const propRefs = ensureArray(et.Key.PropertyRef);
        for (const pr of propRefs) {
          keys.push(pr["@_Name"]);
        }
      }

      // Properties
      const properties: ApiPropertyDefinition[] = [];
      const propsRaw = ensureArray(et.Property);
      for (const p of propsRaw) {
        const pName = p["@_Name"];
        properties.push({
          name: pName,
          type: p["@_Type"] || "Edm.String",
          nullable: p["@_Nullable"] !== "false",
          isKey: keys.includes(pName),
        });
      }

      // NavigationProperties
      const navProps: { name: string; targetEntity: string; isCollection: boolean }[] = [];
      const navPropsRaw = ensureArray(et.NavigationProperty);
      for (const np of navPropsRaw) {
        navProps.push({
          name: np["@_Name"],
          targetEntity: np["@_ToRole"] || "",
          isCollection: Boolean(np["@_Relationship"]?.includes("Many")),
        });
      }

      const entityDef: ApiEntityDefinition = {
        name: typeName,
        keys,
        properties,
        navigationProperties: navProps,
      };

      entityTypeMap.set(typeName, entityDef);
      if (namespace) {
        entityTypeMap.set(fullTypeName, entityDef);
      }
    }

    // EntityContainer
    const entityContainersRaw = ensureArray(schema.EntityContainer);
    for (const ec of entityContainersRaw) {
      const entitySetsRaw = ensureArray(ec.EntitySet);
      for (const es of entitySetsRaw) {
        const setName = es["@_Name"];
        const fullEntityType = es["@_EntityType"];
        const typeSimpleName = fullEntityType.includes(".")
          ? fullEntityType.split(".").pop()!
          : fullEntityType;

        entitySetMap.set(setName, typeSimpleName);

        const entityDef = entityTypeMap.get(typeSimpleName) || entityTypeMap.get(fullEntityType);
        if (entityDef) {
          entities.push({
            ...entityDef,
            entitySetName: setName,
          });
        }
      }

      const fnImportsRaw = ensureArray(ec.FunctionImport);
      for (const fn of fnImportsRaw) {
        const fnName = fn["@_Name"];
        const httpMethod = (fn["@_HttpMethod"] || "GET").toUpperCase() as any;
        const fnParamsRaw = ensureArray(fn.Parameter);
        const parameters = fnParamsRaw.map((p: any) => ({
          name: p["@_Name"],
          in: "query" as const,
          type: p["@_Type"] || "Edm.String",
          required: p["@_Nullable"] === "false",
        }));

        operations.push({
          id: `fn_${fnName}`,
          summary: `FunctionImport: ${fnName}`,
          method: httpMethod,
          path: `/${fnName}`,
          parameters,
          responses: [
            {
              statusCode: 200,
              description: "Successful FunctionImport invocation",
            },
          ],
          tags: ["Functions"],
        });
      }
    }
  }

  return {
    specType: "odata-v2",
    title: "OData v2 Service",
    version: "2.0",
    basePath: options?.basePath || "",
    servers: options?.basePath ? [options.basePath] : [],
    operations,
    entities,
    metadata: {
      odataVersion: "2.0",
      entitySetMap: Object.fromEntries(entitySetMap),
    },
  };
}
