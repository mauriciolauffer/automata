import { parseXml } from '@automata/core';
import type {
  ApiSpecDefinition,
  ApiEntityDefinition,
  ApiPropertyDefinition,
  OperationDefinition
} from '@automata/core';

export interface ParseODataV4Options {
  basePath?: string;
}

export function parseODataV4Metadata(
  xmlContent: string,
  options?: ParseODataV4Options
): ApiSpecDefinition {
  const parsed = parseXml<any>(xmlContent);
  const edmx = parsed.Edmx || parsed;
  const dataServices = edmx.DataServices;
  if (!dataServices) {
    throw new Error('Invalid OData v4 metadata: DataServices element missing');
  }

  const schemasRaw = dataServices.Schema;
  const schemas = Array.isArray(schemasRaw) ? schemasRaw : [schemasRaw];

  const entities: ApiEntityDefinition[] = [];
  const entityTypeMap = new Map<string, ApiEntityDefinition>();
  const entitySetMap = new Map<string, string>();
  const operations: OperationDefinition[] = [];

  for (const schema of schemas) {
    if (!schema) continue;
    const namespace = schema['@_Namespace'] || '';

    const entityTypesRaw = schema.EntityType
      ? (Array.isArray(schema.EntityType) ? schema.EntityType : [schema.EntityType])
      : [];
    for (const et of entityTypesRaw) {
      const typeName = et['@_Name'];
      const fullTypeName = namespace ? `${namespace}.${typeName}` : typeName;

      const keys: string[] = [];
      if (et.Key?.PropertyRef) {
        const propRefs = Array.isArray(et.Key.PropertyRef) ? et.Key.PropertyRef : [et.Key.PropertyRef];
        for (const pr of propRefs) {
          keys.push(pr['@_Name']);
        }
      }

      const properties: ApiPropertyDefinition[] = [];
      const propsRaw = et.Property ? (Array.isArray(et.Property) ? et.Property : [et.Property]) : [];
      for (const p of propsRaw) {
        const pName = p['@_Name'];
        properties.push({
          name: pName,
          type: p['@_Type'] || 'Edm.String',
          nullable: p['@_Nullable'] !== 'false',
          isKey: keys.includes(pName)
        });
      }

      const navProps: { name: string; targetEntity: string; isCollection: boolean }[] = [];
      const navPropsRaw = et.NavigationProperty
        ? (Array.isArray(et.NavigationProperty) ? et.NavigationProperty : [et.NavigationProperty])
        : [];
      for (const np of navPropsRaw) {
        const targetType = np['@_Type'] || '';
        navProps.push({
          name: np['@_Name'],
          targetEntity: targetType.replace(/^Collection\((.*)\)$/, '$1'),
          isCollection: targetType.startsWith('Collection(')
        });
      }

      const entityDef: ApiEntityDefinition = {
        name: typeName,
        keys,
        properties,
        navigationProperties: navProps
      };

      entityTypeMap.set(typeName, entityDef);
      if (namespace) {
        entityTypeMap.set(fullTypeName, entityDef);
      }
    }

    const entityContainersRaw = schema.EntityContainer
      ? (Array.isArray(schema.EntityContainer) ? schema.EntityContainer : [schema.EntityContainer])
      : [];

    for (const ec of entityContainersRaw) {
      const entitySetsRaw = ec.EntitySet ? (Array.isArray(ec.EntitySet) ? ec.EntitySet : [ec.EntitySet]) : [];
      for (const es of entitySetsRaw) {
        const setName = es['@_Name'];
        const fullEntityType = es['@_EntityType'];
        const typeSimpleName = fullEntityType.includes('.') ? fullEntityType.split('.').pop()! : fullEntityType;

        entitySetMap.set(setName, typeSimpleName);

        const entityDef = entityTypeMap.get(typeSimpleName) || entityTypeMap.get(fullEntityType);
        if (entityDef) {
          entities.push({
            ...entityDef,
            entitySetName: setName
          });
        }
      }

      const singletonsRaw = ec.Singleton ? (Array.isArray(ec.Singleton) ? ec.Singleton : [ec.Singleton]) : [];
      for (const s of singletonsRaw) {
        const singletonName = s['@_Name'];
        operations.push({
          id: `singleton_${singletonName}`,
          summary: `Singleton: ${singletonName}`,
          method: 'GET',
          path: `/${singletonName}`,
          parameters: [],
          responses: [{ statusCode: 200, description: 'Singleton Entity' }],
          tags: ['Singletons']
        });
      }

      const actionImportsRaw = ec.ActionImport ? (Array.isArray(ec.ActionImport) ? ec.ActionImport : [ec.ActionImport]) : [];
      for (const act of actionImportsRaw) {
        const actName = act['@_Name'];
        operations.push({
          id: `action_${actName}`,
          summary: `ActionImport: ${actName}`,
          method: 'POST',
          path: `/${actName}`,
          parameters: [],
          responses: [{ statusCode: 200, description: 'Action executed' }],
          tags: ['Actions']
        });
      }

      const functionImportsRaw = ec.FunctionImport ? (Array.isArray(ec.FunctionImport) ? ec.FunctionImport : [ec.FunctionImport]) : [];
      for (const fn of functionImportsRaw) {
        const fnName = fn['@_Name'];
        operations.push({
          id: `fn_${fnName}`,
          summary: `FunctionImport: ${fnName}`,
          method: 'GET',
          path: `/${fnName}`,
          parameters: [],
          responses: [{ statusCode: 200, description: 'Function result' }],
          tags: ['Functions']
        });
      }
    }
  }

  return {
    specType: 'odata-v4',
    title: 'OData v4 Service',
    version: '4.0',
    basePath: options?.basePath || '',
    servers: options?.basePath ? [options.basePath] : [],
    operations,
    entities,
    metadata: {
      odataVersion: '4.0',
      entitySetMap: Object.fromEntries(entitySetMap)
    }
  };
}
