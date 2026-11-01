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

  const schemasRaw = dataServices.Schema;
  const schemas = Array.isArray(schemasRaw) ? schemasRaw : [schemasRaw];

  const entities: ApiEntityDefinition[] = [];
  const entityTypeMap = new Map<string, ApiEntityDefinition>();
  const entitySetMap = new Map<string, string>();
  const operations: OperationDefinition[] = [];

  for (const schema of schemas) {
    if (!schema) continue;
    const namespace = schema["@_Namespace"] || "";

    const entityTypesRaw = schema.EntityType
      ? Array.isArray(schema.EntityType)
        ? schema.EntityType
        : [schema.EntityType]
      : [];
    for (const et of entityTypesRaw) {
      const typeName = et["@_Name"];
      const fullTypeName = namespace ? `${namespace}.${typeName}` : typeName;

      const keys: string[] = [];
      if (et.Key?.PropertyRef) {
        const propRefs = Array.isArray(et.Key.PropertyRef)
          ? et.Key.PropertyRef
          : [et.Key.PropertyRef];
        for (const pr of propRefs) {
          keys.push(pr["@_Name"]);
        }
      }

      const properties: ApiPropertyDefinition[] = [];
      const propsRaw = et.Property
        ? Array.isArray(et.Property)
          ? et.Property
          : [et.Property]
        : [];
      for (const p of propsRaw) {
        const pName = p["@_Name"];
        properties.push({
          name: pName,
          type: p["@_Type"] || "Edm.String",
          nullable: p["@_Nullable"] !== "false",
          isKey: keys.includes(pName),
        });
      }

      const navProps: { name: string; targetEntity: string; isCollection: boolean }[] = [];
      const navPropsRaw = et.NavigationProperty
        ? Array.isArray(et.NavigationProperty)
          ? et.NavigationProperty
          : [et.NavigationProperty]
        : [];
      for (const np of navPropsRaw) {
        navProps.push({
          name: np["@_Name"],
          targetEntity: np["@_ToRole"] || "",
          isCollection: np["@_Relationship"]?.includes("Many") || false,
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

    const entityContainersRaw = schema.EntityContainer
      ? Array.isArray(schema.EntityContainer)
        ? schema.EntityContainer
        : [schema.EntityContainer]
      : [];

    for (const ec of entityContainersRaw) {
      const entitySetsRaw = ec.EntitySet
        ? Array.isArray(ec.EntitySet)
          ? ec.EntitySet
          : [ec.EntitySet]
        : [];
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

      const fnImportsRaw = ec.FunctionImport
        ? Array.isArray(ec.FunctionImport)
          ? ec.FunctionImport
          : [ec.FunctionImport]
        : [];
      for (const fn of fnImportsRaw) {
        const fnName = fn["@_Name"];
        const httpMethod = (fn["@_HttpMethod"] || "GET").toUpperCase() as any;
        const fnParamsRaw = fn.Parameter
          ? Array.isArray(fn.Parameter)
            ? fn.Parameter
            : [fn.Parameter]
          : [];
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
