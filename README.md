# automata

**automata** is an extensible TypeScript monorepo designed to automatically convert API specifications—including **OpenAPI 3.2.1 / 3.x**, **OData v2**, and **OData v4**—into automated test suites executable on **Cloudflare Workers** using **Vitest** and `@cloudflare/vitest-plugin`.

---

## Project Overview

In distributed architectures and edge computing environments like Cloudflare Workers, maintaining and validating compliance against API contracts across heterogeneous API standards is crucial.

Automata solves this by:

1. Parsing multiple API specification formats into a shared, canonical test and schema model.
2. Generating executable, type-safe Vitest test suites configured specifically for the Cloudflare Workers runtime (`cloudflare:test` with `SELF.fetch`).
3. Providing foundational utilities and abstractions to avoid code duplication across spec implementations.
4. Enabling automated contract testing, regression detection, and CRUD flow verification directly within the worker isolated execution context.

---

## Architecture

The project is structured as a pnpm monorepo consisting of modular packages that enforce separation of concerns and maximize code reuse:

```
automata/
├── packages/
│   ├── core/         # Foundational types, shared models, assertions & utility functions
│   ├── openapi/      # OpenAPI 3.0 / 3.1 / 3.2.1 parser & test definition generator
│   ├── odata-v2/     # OData v2 CSDL XML / metadata parser & test definition generator
│   ├── odata-v4/     # OData v4 CSDL XML / metadata parser & test definition generator
│   ├── generator/    # Vitest code generation engine for Cloudflare Workers & standard environments
│   └── runner/       # Cloudflare Workers test harness with @cloudflare/vitest-plugin & miniflare
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.json
```

### Architecture Flow

```
   ┌─────────────────────────────────────────────────────────────┐
   │                   API Specifications                        │
   │  ┌──────────────────┐  ┌──────────────┐  ┌───────────────┐  │
   │  │  OpenAPI 3.2.1   │  │   OData v2   │  │   OData v4    │  │
   │  │   (YAML/JSON)    │  │  (CSDL XML)  │  │  (CSDL XML)   │  │
   │  └────────┬─────────┘  └──────┬───────┘  └───────┬───────┘  │
   └───────────┼───────────────────┼──────────────────┼──────────┘
               │                   │                  │
               ▼                   ▼                  ▼
   ┌─────────────────────┐┌─────────────────┐┌───────────────────┐
   │  @automata/openapi  ││@automata/odata-v2││ @automata/odata-v4 │
   └───────────┬─────────┘└────────┬────────┘└────────┬──────────┘
               │                   │                  │
               └───────────────────┼──────────────────┘
                                   ▼
                   ┌───────────────────────────────┐
                   │        @automata/core         │
                   │  - Canonical Spec Models      │
                   │  - Canonical Test Suites      │
                   │  - Common Utilities & Schemas │
                   └───────────────┬───────────────┘
                                   │
                                   ▼
                   ┌───────────────────────────────┐
                   │      @automata/generator      │
                   │  - Transforms Spec to Vitest  │
                   │  - Targets Cloudflare Workers │
                   └───────────────┬───────────────┘
                                   │
                                   ▼
                   ┌───────────────────────────────┐
                   │       @automata/runner        │
                   │  - Vitest + Miniflare Runtime │
                   │  - @cloudflare/vitest-plugin  │
                   │  - Executes tests on Workers  │
                   └───────────────────────────────┘
```

---

## Package Responsibilities

### 1. `@automata/core`

The foundational package shared by all other packages:

- **Canonical Models**: `ApiSpecDefinition`, `OperationDefinition`, `ApiEntityDefinition`, `ParameterDefinition`, and `RequestBodyDefinition`.
- **Test Representations**: `TestSuiteDefinition`, `TestCaseDefinition`, `AssertionRule` (`status`, `header`, `json-schema`, `body-contains`).
- **Utility Functions**:
  - `buildQueryString`: Query parameter formatting and encoding.
  - `resolvePath`: Path templating and variable substitution (`/users/{id}` -> `/users/123`).
  - `joinPaths`: URL path joining and normalization.
  - `parseXml`: High-performance XML parser wrapper powered by `fast-xml-parser`.
  - `validateSchema`: Structural JSON schema validator for validating response payloads.

### 2. `@automata/openapi`

Parses OpenAPI 3.0, 3.1, and **3.2.1** documents (YAML and JSON):

- Extracts server definitions, basePath, path items, operations, query/path/header parameters, and request bodies.
- Generates positive test cases with expected status codes, content-type headers, and JSON schema assertions.
- Generates negative test cases (e.g. verifying 400 Bad Request when required request bodies are missing).

### 3. `@automata/odata-v2`

Parses OData v2 CSDL metadata XML and generates automated tests based on OData v2 conventions:

- Parses `Edmx` DataServices schemas, EntityTypes, EntitySets, Keys, Properties, and FunctionImports.
- Generates service root document and `$metadata` XML verification tests.
- Generates EntitySet queries testing query options (`$top`, `$skip`, `$select`, `$inlinecount`).
- Generates single entity lookups by key predicate (e.g. `Customers('ALFKI')` or `Products(1)`).
- Generates full CRUD suites using OData v2 verbs and headers (`POST` for create, `MERGE` for update with `X-HTTP-Method`, `DELETE` for remove).
- Enforces OData v2 protocol headers (`DataServiceVersion: 2.0`, `MaxDataServiceVersion: 2.0`).

### 4. `@automata/odata-v4`

Parses OData v4 CSDL metadata XML and generates automated tests based on OData v4 conventions:

- Parses EntityTypes, EntitySets, Singletons, ActionImports, FunctionImports, and NavigationProperties.
- Generates service root document and `$metadata` XML verification tests.
- Generates EntitySet queries with `$count` query option and pagination.
- Generates key predicate lookup tests (e.g. `People('russellwhyte')`).
- Generates CRUD test operations (`POST`, `PATCH`, `DELETE`).
- Enforces OData v4 protocol headers (`OData-Version: 4.0`, `OData-MaxVersion: 4.0`).

### 5. `@automata/generator`

Code generation engine converting canonical test definitions into executable TypeScript test files:

- Translates test suites into Vitest code using `describe` and `it` blocks.
- Supports **Cloudflare Worker target**: Imports `SELF` and `env` from `cloudflare:test`, issuing requests via `SELF.fetch` against worker endpoints.
- Supports **Standard target**: Emits standard `fetch` calls for external HTTP services.

### 6. `@automata/runner`

Integration runner for Cloudflare Workers:

- Pre-configured with `@cloudflare/vitest-plugin` and `wrangler.jsonc` running on Miniflare/workerd.
- Provides a mock dispatcher worker and execution harness (`executeSuiteOnWorker`) to run tests directly inside the Cloudflare Workers runtime.

---

## Tooling & Development

- **Package Manager**: `pnpm` (Workspace monorepo)
- **Compiler**: `tsc` (TypeScript in strict mode, ES2022, NodeNext modules)
- **Test Runner**: `vitest` with `@cloudflare/vitest-plugin`
- **Linter**: `oxlint` (Extremely fast Rust-based linter)
- **Formatter**: `oxfmt` (Fast formatter)

### Available Scripts

Run from the root of the monorepo:

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Run type checking across all packages
pnpm run typecheck

# Run test suites across all packages (including Cloudflare Worker tests)
pnpm run test

# Lint codebase with oxlint
pnpm run lint

# Check formatting with oxfmt
pnpm run format:check

# Format files with oxfmt
pnpm run format
```

---

## References

- [OpenAPI Specification v3.2.1](https://spec.openapis.org/oas/v3.2.1.html)
- [OData Version 2.0 Documentation](https://www.odata.org/documentation/odata-version-2-0/)
- [OData Version 4.0 Documentation](https://www.odata.org/documentation/)
- [Cloudflare Vitest Plugin](https://developers.cloudflare.com/workers/testing/vitest-integration/)
