import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseODataV4Metadata, generateODataV4Tests } from '../src/index.js';

describe('@automata/odata-v4', () => {
  const xml = readFileSync(join(__dirname, 'fixtures/trippin-v4.xml'), 'utf-8');

  it('parses OData v4 CSDL metadata XML correctly', () => {
    const spec = parseODataV4Metadata(xml, { basePath: '/v4/TripPinServiceRW' });
    expect(spec.specType).toBe('odata-v4');
    expect(spec.version).toBe('4.0');
    expect(spec.entities?.length).toBe(2);

    const person = spec.entities?.find(e => e.name === 'Person');
    expect(person).toBeDefined();
    expect(person?.entitySetName).toBe('People');
    expect(person?.keys).toEqual(['UserName']);
    expect(person?.navigationProperties?.[0].name).toBe('Friends');
    expect(person?.navigationProperties?.[0].isCollection).toBe(true);

    const singleton = spec.operations.find(o => o.id === 'singleton_Me');
    expect(singleton).toBeDefined();

    const action = spec.operations.find(o => o.id === 'action_ResetDataSource');
    expect(action).toBeDefined();
    expect(action?.method).toBe('POST');
  });

  it('generates OData v4 test suite with $count, singletons, actions, and v4 headers', () => {
    const spec = parseODataV4Metadata(xml);
    const suite = generateODataV4Tests(spec, {
      includeCrud: true,
      sampleKeys: { People: 'russellwhyte', Airports: 'KSFO' }
    });

    expect(suite.specType).toBe('odata-v4');
    const personByKey = suite.tests.find(t => t.id === 'v4_get_key_People');
    expect(personByKey).toBeDefined();
    expect(personByKey?.request.path).toBe("/People('russellwhyte')");
    expect(personByKey?.request.headers?.['OData-Version']).toBe('4.0');

    const queryPeople = suite.tests.find(t => t.id === 'v4_query_People');
    expect(queryPeople).toBeDefined();
    expect(queryPeople?.request.queryParams?.['$count']).toBe(true);

    const patchAirport = suite.tests.find(t => t.id === 'v4_patch_Airports');
    expect(patchAirport).toBeDefined();
    expect(patchAirport?.request.method).toBe('PATCH');

    const resetAction = suite.tests.find(t => t.id === 'action_ResetDataSource');
    expect(resetAction).toBeDefined();
    expect(resetAction?.request.method).toBe('POST');
  });
});
