import {
  parseOpenApi,
  generateOpenApiTests,
  type GenerateOpenApiTestOptions,
} from "@automata/openapi";
import {
  parseODataV2Metadata,
  generateODataV2Tests,
  type GenerateODataV2TestOptions,
} from "@automata/odata-v2";
import {
  parseODataV4Metadata,
  generateODataV4Tests,
  type GenerateODataV4TestOptions,
} from "@automata/odata-v4";
import { generateVitestCode, type CodeGeneratorOptions } from "./code-generator.js";
import type { TestSuiteDefinition } from "@automata/core";

export * from "./code-generator.js";

export interface ConvertOptions {
  specType: "openapi" | "odata-v2" | "odata-v4";
  content: string;
  basePath?: string;
  generatorOptions?: CodeGeneratorOptions;
  openApiOptions?: GenerateOpenApiTestOptions;
  odataV2Options?: GenerateODataV2TestOptions;
  odataV4Options?: GenerateODataV4TestOptions;
}

export function specToTestSuite(options: ConvertOptions): TestSuiteDefinition {
  switch (options.specType) {
    case "openapi": {
      const parsed = parseOpenApi(options.content, { basePath: options.basePath });
      return generateOpenApiTests(parsed, options.openApiOptions);
    }
    case "odata-v2": {
      const parsed = parseODataV2Metadata(options.content, { basePath: options.basePath });
      return generateODataV2Tests(parsed, options.odataV2Options);
    }
    case "odata-v4": {
      const parsed = parseODataV4Metadata(options.content, { basePath: options.basePath });
      return generateODataV4Tests(parsed, options.odataV4Options);
    }
    default:
      throw new Error(`Unsupported spec type: ${options.specType}`);
  }
}

export function generateTestsFromSpec(options: ConvertOptions): string {
  const suite = specToTestSuite(options);
  return generateVitestCode(suite, options.generatorOptions);
}
