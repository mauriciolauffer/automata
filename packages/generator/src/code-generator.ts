import type {
  TestSuiteDefinition,
  TestCaseDefinition,
  AssertionRule
} from '@automata/core';
import { buildQueryString } from '@automata/core';

export interface CodeGeneratorOptions {
  target: 'cloudflare-worker' | 'standard';
  baseUrl?: string;
}

export function generateVitestCode(
  suite: TestSuiteDefinition,
  options: CodeGeneratorOptions = { target: 'cloudflare-worker' }
): string {
  const isCloudflare = options.target === 'cloudflare-worker';

  const imports = [
    `import { describe, it, expect } from 'vitest';`,
    `import { validateSchema } from '@automata/core';`
  ];

  if (isCloudflare) {
    imports.push(`import { SELF, env } from 'cloudflare:test';`);
  }

  const lines: string[] = [
    ...imports,
    '',
    `describe(${JSON.stringify(suite.title)}, () => {`,
    `  const basePath = ${JSON.stringify(suite.basePath || '')};`
  ];

  if (!isCloudflare) {
    lines.push(`  const baseUrl = ${JSON.stringify(options.baseUrl || 'http://localhost')};`);
  }

  const groupedTests = new Map<string, TestCaseDefinition[]>();
  for (const t of suite.tests) {
    const grp = t.group || 'Default';
    if (!groupedTests.has(grp)) {
      groupedTests.set(grp, []);
    }
    groupedTests.get(grp)!.push(t);
  }

  for (const [groupName, tests] of groupedTests.entries()) {
    lines.push(`  describe(${JSON.stringify(groupName)}, () => {`);
    for (const test of tests) {
      lines.push(generateSingleTestCaseCode(test, isCloudflare));
    }
    lines.push('  });');
  }

  lines.push('});');
  return lines.join('\n');
}

function generateSingleTestCaseCode(test: TestCaseDefinition, isCloudflare: boolean): string {
  const queryStr = buildQueryString(test.request.queryParams);
  const pathWithQuery = `${test.request.path}${queryStr}`;

  const fetchTarget = isCloudflare
    ? `new URL(basePath + ${JSON.stringify(pathWithQuery)}, 'http://local.worker').toString()`
    : `new URL(basePath + ${JSON.stringify(pathWithQuery)}, baseUrl).toString()`;

  const fetchCaller = isCloudflare ? 'SELF.fetch' : 'fetch';

  const fetchOptions: Record<string, unknown> = {
    method: test.request.method
  };

  if (test.request.headers && Object.keys(test.request.headers).length > 0) {
    fetchOptions.headers = test.request.headers;
  }

  if (test.request.body !== undefined) {
    fetchOptions.body = typeof test.request.body === 'string'
      ? test.request.body
      : JSON.stringify(test.request.body);
  }

  const code: string[] = [];
  code.push(`    it(${JSON.stringify(test.name)}, async () => {`);
  code.push(`      const targetUrl = ${fetchTarget};`);
  code.push(`      const reqOptions: RequestInit = ${JSON.stringify(fetchOptions, null, 8).trim()};`);
  code.push(`      const response = await ${fetchCaller}(targetUrl, reqOptions);`);

  for (const assertion of test.expected.assertions) {
    code.push(generateAssertionCode(assertion));
  }

  code.push('    });');
  return code.join('\n');
}

function generateAssertionCode(assertion: AssertionRule): string {
  switch (assertion.type) {
    case 'status':
      return `      expect(response.status).toBe(${assertion.expected});`;

    case 'header':
      return `      expect(response.headers.get(${JSON.stringify(assertion.headerName?.toLowerCase())}) || '').toContain(${JSON.stringify(assertion.expected)});`;

    case 'body-contains':
      return `      {
        const text = await response.text();
        expect(text).toContain(${JSON.stringify(assertion.expected)});
      }`;

    case 'json-schema':
      return `      {
        const json = await response.json();
        const schema = ${JSON.stringify(assertion.schema)};
        const validation = validateSchema(json, schema);
        expect(validation.valid, validation.errors.join(', ')).toBe(true);
      }`;

    default:
      return '';
  }
}
