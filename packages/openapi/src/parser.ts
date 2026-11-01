import YAML from 'yaml';
import type {
  ApiSpecDefinition,
  OperationDefinition,
  HttpMethod,
  ParameterDefinition,
  RequestBodyDefinition,
  ResponseExpectationDefinition
} from '@automata/core';

export interface ParseOpenApiOptions {
  basePath?: string;
}

export function parseOpenApi(content: string | Record<string, any>, options?: ParseOpenApiOptions): ApiSpecDefinition {
  const doc = typeof content === 'string'
    ? (content.trim().startsWith('{') ? JSON.parse(content) : YAML.parse(content))
    : content;

  if (!doc.openapi && !doc.swagger) {
    throw new Error('Invalid API specification: openapi or swagger field missing');
  }

  const title = doc.info?.title || 'OpenAPI Specification';
  const version = doc.info?.version || '1.0.0';

  const servers: string[] = [];
  let detectedBasePath = options?.basePath || '';

  if (Array.isArray(doc.servers) && doc.servers.length > 0) {
    for (const server of doc.servers) {
      if (server.url) {
        servers.push(server.url);
      }
    }
    if (!detectedBasePath && servers.length > 0) {
      try {
        const urlObj = new URL(servers[0], 'http://localhost');
        detectedBasePath = urlObj.pathname !== '/' ? urlObj.pathname : '';
      } catch {
        detectedBasePath = servers[0];
      }
    }
  }

  const operations: OperationDefinition[] = [];
  const paths = doc.paths || {};

  const httpMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

  for (const [pathKey, pathItem] of Object.entries<any>(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;

    const commonParams: ParameterDefinition[] = (pathItem.parameters || []).map((p: any) => ({
      name: p.name,
      in: p.in,
      required: Boolean(p.required),
      type: p.schema?.type || p.type || 'string',
      description: p.description,
      default: p.schema?.default ?? p.default,
      example: p.schema?.example ?? p.example
    }));

    for (const methodKey of Object.keys(pathItem)) {
      const upperMethod = methodKey.toUpperCase() as HttpMethod;
      if (!httpMethods.includes(upperMethod)) continue;

      const op = pathItem[methodKey];
      const opParams: ParameterDefinition[] = (op.parameters || []).map((p: any) => ({
        name: p.name,
        in: p.in,
        required: Boolean(p.required),
        type: p.schema?.type || p.type || 'string',
        description: p.description,
        default: p.schema?.default ?? p.default,
        example: p.schema?.example ?? p.example
      }));

      // Merge parameters (operation-level takes precedence)
      const mergedParamsMap = new Map<string, ParameterDefinition>();
      for (const p of commonParams) {
        mergedParamsMap.set(`${p.in}:${p.name}`, p);
      }
      for (const p of opParams) {
        mergedParamsMap.set(`${p.in}:${p.name}`, p);
      }

      let requestBodyDef: RequestBodyDefinition | undefined;
      if (op.requestBody) {
        const reqContent = op.requestBody.content || {};
        const contentType = Object.keys(reqContent)[0] || 'application/json';
        const mediaTypeObj = reqContent[contentType] || {};
        requestBodyDef = {
          description: op.requestBody.description,
          required: Boolean(op.requestBody.required),
          contentType,
          schema: mediaTypeObj.schema,
          example: mediaTypeObj.example || mediaTypeObj.schema?.example
        };
      }

      const responses: ResponseExpectationDefinition[] = [];
      if (op.responses) {
        for (const [statusCodeStr, respObj] of Object.entries<any>(op.responses)) {
          const statusCode = parseInt(statusCodeStr, 10);
          if (isNaN(statusCode)) continue;

          const respContent = respObj.content || {};
          const contentType = Object.keys(respContent)[0];
          const mediaObj = contentType ? respContent[contentType] : undefined;

          responses.push({
            statusCode,
            description: respObj.description,
            contentType,
            schema: mediaObj?.schema
          });
        }
      }

      // Default to 200 response if none defined
      if (responses.length === 0) {
        responses.push({ statusCode: 200, description: 'Success' });
      }

      operations.push({
        id: op.operationId || `${methodKey}_${pathKey.replace(/[^a-zA-Z0-9]/g, '_')}`,
        summary: op.summary,
        description: op.description,
        method: upperMethod,
        path: pathKey,
        parameters: Array.from(mergedParamsMap.values()),
        requestBody: requestBodyDef,
        responses,
        tags: op.tags || []
      });
    }
  }

  return {
    specType: 'openapi',
    title,
    version,
    basePath: detectedBasePath,
    servers,
    operations,
    metadata: {
      rawOpenapi: doc.openapi || doc.swagger
    }
  };
}
