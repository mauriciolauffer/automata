import type {
  ApiSpecDefinition,
  TestSuiteDefinition,
  TestCaseDefinition,
  ApiPropertyDefinition,
} from "@automata/core";

export interface GenerateODataV4TestOptions {
  sampleKeys?: Record<string, string | number>;
  defaultHeaders?: Record<string, string>;
  includeCrud?: boolean;
}

export function generateODataV4Tests(
  spec: ApiSpecDefinition,
  options?: GenerateODataV4TestOptions,
): TestSuiteDefinition {
  const tests: TestCaseDefinition[] = [];

  const v4BaseHeaders: Record<string, string> = {
    Accept: "application/json;odata.metadata=minimal",
    "OData-Version": "4.0",
    "OData-MaxVersion": "4.0",
    ...options?.defaultHeaders,
  };

  tests.push({
    id: "v4_service_document",
    name: "GET Service Root Document",
    group: "Metadata",
    request: {
      method: "GET",
      path: "/",
      headers: v4BaseHeaders,
    },
    expected: {
      statusCode: 200,
      assertions: [
        { type: "status", expected: 200 },
        { type: "header", headerName: "content-type", expected: "application/json" },
      ],
    },
    tags: ["service-document"],
  });

  tests.push({
    id: "v4_metadata_document",
    name: "GET Service $metadata (CSDL XML)",
    group: "Metadata",
    request: {
      method: "GET",
      path: "/$metadata",
      headers: {
        Accept: "application/xml, text/xml",
        ...options?.defaultHeaders,
      },
    },
    expected: {
      statusCode: 200,
      assertions: [
        { type: "status", expected: 200 },
        { type: "header", headerName: "content-type", expected: "xml" },
        { type: "body-contains", expected: "edmx:Edmx" },
      ],
    },
    tags: ["metadata"],
  });

  const entities = spec.entities || [];
  for (const entity of entities) {
    const setName = entity.entitySetName || entity.name;
    const groupName = setName;

    tests.push({
      id: `v4_query_${setName}`,
      name: `GET /${setName} (Query EntitySet with $count)`,
      group: groupName,
      request: {
        method: "GET",
        path: `/${setName}`,
        headers: v4BaseHeaders,
        queryParams: {
          $count: true,
          $top: 5,
        },
      },
      expected: {
        statusCode: 200,
        assertions: [
          { type: "status", expected: 200 },
          { type: "header", headerName: "content-type", expected: "application/json" },
        ],
      },
      tags: [setName, "query"],
    });

    const firstProp = entity.properties.find((p) => !p.isKey)?.name || entity.properties[0]?.name;
    if (firstProp) {
      tests.push({
        id: `v4_query_select_${setName}`,
        name: `GET /${setName} with $select and $skip`,
        group: groupName,
        request: {
          method: "GET",
          path: `/${setName}`,
          headers: v4BaseHeaders,
          queryParams: {
            $select: firstProp,
            $skip: 1,
            $top: 2,
          },
        },
        expected: {
          statusCode: 200,
          assertions: [{ type: "status", expected: 200 }],
        },
        tags: [setName, "query"],
      });
    }

    const keyVal =
      options?.sampleKeys?.[setName] ??
      (entity.keys[0]
        ? getSampleKeyValue(entity.properties.find((p) => p.name === entity.keys[0]))
        : 1);
    const keyPredicate = formatODataV4KeyPredicate(keyVal);

    tests.push({
      id: `v4_get_key_${setName}`,
      name: `GET /${setName}(${keyPredicate}) (By Key)`,
      group: groupName,
      request: {
        method: "GET",
        path: `/${setName}(${keyPredicate})`,
        headers: v4BaseHeaders,
      },
      expected: {
        statusCode: 200,
        assertions: [
          { type: "status", expected: 200 },
          { type: "header", headerName: "content-type", expected: "application/json" },
        ],
      },
      tags: [setName, "get-by-key"],
    });

    if (options?.includeCrud) {
      const samplePayload = createSampleEntityPayload(entity.properties);

      tests.push({
        id: `v4_create_${setName}`,
        name: `POST /${setName} (Create Entity)`,
        group: groupName,
        request: {
          method: "POST",
          path: `/${setName}`,
          headers: {
            ...v4BaseHeaders,
            "Content-Type": "application/json",
          },
          body: samplePayload,
        },
        expected: {
          statusCode: 201,
          assertions: [{ type: "status", expected: 201 }],
        },
        tags: [setName, "crud", "create"],
      });

      tests.push({
        id: `v4_patch_${setName}`,
        name: `PATCH /${setName}(${keyPredicate}) (Update Entity)`,
        group: groupName,
        request: {
          method: "PATCH",
          path: `/${setName}(${keyPredicate})`,
          headers: {
            ...v4BaseHeaders,
            "Content-Type": "application/json",
          },
          body: samplePayload,
        },
        expected: {
          statusCode: 204,
          assertions: [{ type: "status", expected: 204 }],
        },
        tags: [setName, "crud", "update"],
      });

      tests.push({
        id: `v4_delete_${setName}`,
        name: `DELETE /${setName}(${keyPredicate}) (Delete Entity)`,
        group: groupName,
        request: {
          method: "DELETE",
          path: `/${setName}(${keyPredicate})`,
          headers: v4BaseHeaders,
        },
        expected: {
          statusCode: 204,
          assertions: [{ type: "status", expected: 204 }],
        },
        tags: [setName, "crud", "delete"],
      });
    }
  }

  for (const op of spec.operations) {
    tests.push({
      id: op.id,
      name: `${op.method} ${op.path} (${op.summary || "Operation"})`,
      group: op.tags?.[0] || "Operations",
      request: {
        method: op.method,
        path: op.path,
        headers: v4BaseHeaders,
      },
      expected: {
        statusCode: 200,
        assertions: [{ type: "status", expected: 200 }],
      },
      tags: op.tags || ["operation"],
    });
  }

  return {
    title: "OData v4 Test Suite",
    specType: "odata-v4",
    basePath: spec.basePath,
    tests,
  };
}

function formatODataV4KeyPredicate(keyVal: unknown): string {
  if (typeof keyVal === "string") {
    return `'${keyVal.replace(/'/g, "''")}'`;
  }
  return String(keyVal);
}

function getSampleKeyValue(prop?: ApiPropertyDefinition): unknown {
  if (!prop) return 1;
  if (prop.type.includes("Int") || prop.type.includes("Decimal")) return 1;
  if (prop.type.includes("Guid")) return "00000000-0000-0000-0000-000000000001";
  return "KEY1";
}

function createSampleEntityPayload(props: ApiPropertyDefinition[]): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const p of props) {
    if (p.isKey) continue;
    if (p.type.includes("Int") || p.type.includes("Decimal")) {
      payload[p.name] = 100;
    } else if (p.type.includes("Boolean")) {
      payload[p.name] = true;
    } else {
      payload[p.name] = `Sample ${p.name}`;
    }
  }
  return payload;
}
