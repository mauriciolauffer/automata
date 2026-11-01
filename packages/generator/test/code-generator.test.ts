import { describe, it, expect } from 'vitest';
import { generateVitestCode, generateTestsFromSpec } from '../src/index.js';
import type { TestSuiteDefinition } from '@automata/core';

describe('@automata/generator', () => {
  const dummySuite: TestSuiteDefinition = {
    title: 'Test Service',
    specType: 'openapi',
    basePath: '/api',
    tests: [
      {
        id: 'test_get_users',
        name: 'GET /users',
        group: 'Users',
        request: {
          method: 'GET',
          path: '/users',
          queryParams: { page: 1 }
        },
        expected: {
          statusCode: 200,
          assertions: [
            { type: 'status', expected: 200 },
            { type: 'header', headerName: 'content-type', expected: 'application/json' }
          ]
        }
      }
    ]
  };

  it('generates Cloudflare Worker vitest test code with SELF.fetch and cloudflare:test imports', () => {
    const code = generateVitestCode(dummySuite, { target: 'cloudflare-worker' });
    expect(code).toContain("import { SELF, env } from 'cloudflare:test'");
    expect(code).toContain("describe(\"Test Service\"");
    expect(code).toContain("describe(\"Users\"");
    expect(code).toContain("const response = await SELF.fetch(targetUrl, reqOptions);");
    expect(code).toContain("expect(response.status).toBe(200);");
    expect(code).toContain("expect(response.headers.get(\"content-type\") || '').toContain(\"application/json\");");
  });

  it('generates standard vitest test code when target is standard', () => {
    const code = generateVitestCode(dummySuite, { target: 'standard', baseUrl: 'https://example.com' });
    expect(code).not.toContain("cloudflare:test");
    expect(code).toContain("const response = await fetch(targetUrl, reqOptions);");
  });

  it('end-to-end converts OpenAPI yaml to executable Cloudflare test code', () => {
    const openapiYaml = `
openapi: 3.2.1
info:
  title: Users API
  version: 1.0.0
paths:
  /users:
    get:
      responses:
        '200':
          description: OK
`;
    const code = generateTestsFromSpec({
      specType: 'openapi',
      content: openapiYaml,
      basePath: '/api/v1',
      generatorOptions: { target: 'cloudflare-worker' }
    });

    expect(code).toContain("import { SELF, env } from 'cloudflare:test'");
    expect(code).toContain("describe(\"Users API Test Suite\"");
    expect(code).toContain("GET /users");
    expect(code).toContain("expect(response.status).toBe(200)");
  });
});
