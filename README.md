# Automata

Automata is a TypeScript monorepo that converts API specifications (OpenAPI 3.x / 3.2.1, OData v2, and OData v4) into automated test suites runnable on Cloudflare Workers using Vitest and `@cloudflare/vitest-plugin`.

## Monorepo Architecture

```
packages/
├── core/         # Shared foundational types, schemas, assertions & utility functions
├── openapi/      # OpenAPI 3.0 / 3.1 / 3.2.1 parser & test generator
├── odata-v2/     # OData v2 CSDL XML & metadata parser & test generator
├── odata-v4/     # OData v4 CSDL XML & metadata parser & test generator
├── generator/    # Vitest code generator targeting Cloudflare Workers & standard environments
└── runner/       # Cloudflare Workers test harness with @cloudflare/vitest-plugin & miniflare
```

## Shared Foundation & Utilities (`@automata/core`)

All packages reuse common models and utilities from `@automata/core`:
- Canonical API models (`ApiSpecDefinition`, `OperationDefinition`, `ApiEntityDefinition`, `ParameterDefinition`).
- Canonical test representations (`TestSuiteDefinition`, `TestCaseDefinition`, `AssertionRule`).
- Shared utilities: `buildQueryString`, `resolvePath`, `joinPaths`, `parseXml`, and `validateSchema`.

## Supported API Specifications

- **OpenAPI 3.2.1 / 3.1 / 3.0**: Paths, parameters (path, query, header), request bodies, status codes, schemas, and automatic negative tests for missing required bodies.
- **OData v2**: CSDL XML parser, EntitySets, `$metadata`, service root, query options (`$top`, `$skip`, `$select`, `$inlinecount`), key predicates (`Customers('ALFKI')`, `Products(1)`), CRUD operations (`MERGE`), FunctionImports, and `DataServiceVersion: 2.0` headers.
- **OData v4**: CSDL XML parser, EntitySets, Singletons, ActionImports, FunctionImports, `$count`, key predicates, CRUD operations (`PATCH`), and `OData-Version: 4.0` headers.

## Cloudflare Workers & Vitest Integration

Automated tests are generated for Vitest and executed inside Cloudflare Workers runtime via `@cloudflare/vitest-plugin` and `cloudflare:test` (`SELF.fetch`).

### Running Tests and Typechecks

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Run typechecks
pnpm run typecheck

# Run test suites across all packages
pnpm run test
```
