import type { TestSuiteDefinition } from '@automata/core';
import { validateSchema } from '@automata/core';
import { buildQueryString } from '@automata/core';

export interface TestExecutionResult {
  suiteTitle: string;
  total: number;
  passed: number;
  failed: number;
  results: {
    testId: string;
    name: string;
    passed: boolean;
    error?: string;
  }[];
}

export async function executeSuiteOnWorker(
  suite: TestSuiteDefinition,
  fetcher: { fetch: typeof fetch }
): Promise<TestExecutionResult> {
  const result: TestExecutionResult = {
    suiteTitle: suite.title,
    total: suite.tests.length,
    passed: 0,
    failed: 0,
    results: []
  };

  const basePath = suite.basePath || '';

  for (const test of suite.tests) {
    const qStr = buildQueryString(test.request.queryParams);
    const targetUrl = new URL(basePath + test.request.path + qStr, 'http://local.worker').toString();

    const headers = { ...test.request.headers };
    let body: string | undefined;

    if (test.request.body !== undefined) {
      body = typeof test.request.body === 'string' ? test.request.body : JSON.stringify(test.request.body);
    }

    try {
      const response = await fetcher.fetch(targetUrl, {
        method: test.request.method,
        headers,
        body
      });

      if (response.status !== test.expected.statusCode) {
        throw new Error(`Expected status ${test.expected.statusCode}, got ${response.status}`);
      }

      for (const assertion of test.expected.assertions) {
        if (assertion.type === 'header' && assertion.headerName) {
          const actualHeader = response.headers.get(assertion.headerName.toLowerCase()) || '';
          if (!actualHeader.includes(String(assertion.expected))) {
            throw new Error(`Header ${assertion.headerName} missing expected '${assertion.expected}'`);
          }
        } else if (assertion.type === 'body-contains') {
          const text = await response.text();
          if (!text.includes(String(assertion.expected))) {
            throw new Error(`Body does not contain '${assertion.expected}'`);
          }
        } else if (assertion.type === 'json-schema') {
          const json = await response.json();
          const validation = validateSchema(json, assertion.schema);
          if (!validation.valid) {
            throw new Error(`JSON schema validation error: ${validation.errors.join(', ')}`);
          }
        }
      }

      result.passed++;
      result.results.push({ testId: test.id, name: test.name, passed: true });
    } catch (err: any) {
      result.failed++;
      result.results.push({ testId: test.id, name: test.name, passed: false, error: err.message });
    }
  }

  return result;
}

export * from './worker.js';
