/**
 * Core type definitions for Automata API specifications and test representations.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface KeyValuePair<T = string> {
  [key: string]: T;
}

export type SpecType = 'openapi' | 'odata-v2' | 'odata-v4';

export interface ApiPropertyDefinition {
  name: string;
  type: string;
  nullable?: boolean;
  isKey?: boolean;
  format?: string;
  description?: string;
  enum?: (string | number)[];
}

export interface ApiEntityDefinition {
  name: string;
  entitySetName?: string;
  keys: string[];
  properties: ApiPropertyDefinition[];
  navigationProperties?: {
    name: string;
    targetEntity: string;
    isCollection: boolean;
  }[];
}

export interface ParameterDefinition {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  type?: string;
  description?: string;
  default?: unknown;
  example?: unknown;
}

export interface RequestBodyDefinition {
  description?: string;
  required?: boolean;
  contentType: string;
  schema?: Record<string, unknown>;
  example?: unknown;
}

export interface ResponseExpectationDefinition {
  statusCode: number;
  description?: string;
  contentType?: string;
  schema?: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface OperationDefinition {
  id: string;
  summary?: string;
  description?: string;
  method: HttpMethod;
  path: string;
  parameters: ParameterDefinition[];
  requestBody?: RequestBodyDefinition;
  responses: ResponseExpectationDefinition[];
  tags?: string[];
}

export interface ApiSpecDefinition {
  specType: SpecType;
  title: string;
  version: string;
  basePath: string;
  servers: string[];
  operations: OperationDefinition[];
  entities?: ApiEntityDefinition[];
  metadata?: Record<string, unknown>;
}

export type AssertionType =
  | 'status'
  | 'header'
  | 'json-schema'
  | 'body-contains'
  | 'xml-root-tag'
  | 'custom';

export interface AssertionRule {
  type: AssertionType;
  expected?: unknown;
  message?: string;
  headerName?: string;
  schema?: Record<string, unknown>;
}

export interface TestCaseDefinition {
  id: string;
  name: string;
  description?: string;
  group?: string;
  request: {
    method: HttpMethod;
    path: string;
    headers?: Record<string, string>;
    queryParams?: Record<string, string | number | boolean>;
    body?: unknown;
  };
  expected: {
    statusCode: number;
    assertions: AssertionRule[];
  };
  tags?: string[];
}

export interface TestSuiteDefinition {
  title: string;
  specType: SpecType;
  basePath: string;
  tests: TestCaseDefinition[];
}
