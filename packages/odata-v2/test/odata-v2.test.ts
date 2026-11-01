import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseODataV2Metadata, generateODataV2Tests } from '../src/index.js';

describe('@automata/odata-v2', () => {
  const xml = readFileSync(join(__dirname, 'fixtures/northwind-v2.xml'), 'utf-8');

  it('parses OData v2 CSDL metadata XML correctly', () => {
    const spec = parseODataV2Metadata(xml, { basePath: '/Northwind/Northwind.svc' });
    expect(spec.specType).toBe('odata-v2');
    expect(spec.basePath).toBe('/Northwind/Northwind.svc');
    expect(spec.entities?.length).toBe(2);

    const customer = spec.entities?.find(e => e.name === 'Customer');
    expect(customer).toBeDefined();
    expect(customer?.entitySetName).toBe('Customers');
    expect(customer?.keys).toEqual(['CustomerID']);
    expect(customer?.properties.length).toBe(3);

    const getTopCustomers = spec.operations.find(o => o.id === 'fn_GetTopCustomers');
    expect(getTopCustomers).toBeDefined();
    expect(getTopCustomers?.method).toBe('GET');
  });

  it('generates OData v2 test suite with CRUD and OData v2 specific headers/conventions', () => {
    const spec = parseODataV2Metadata(xml);
    const suite = generateODataV2Tests(spec, {
      includeCrud: true,
      sampleKeys: { Customers: 'ALFKI', Products: 1 }
    });

    expect(suite.specType).toBe('odata-v2');
    expect(suite.tests.length).toBeGreaterThan(10);

    const getCustomerByKey = suite.tests.find(t => t.id === 'v2_get_key_Customers');
    expect(getCustomerByKey).toBeDefined();
    expect(getCustomerByKey?.request.path).toBe("/Customers('ALFKI')");
    expect(getCustomerByKey?.request.headers?.['DataServiceVersion']).toBe('2.0');

    const getProductByKey = suite.tests.find(t => t.id === 'v2_get_key_Products');
    expect(getProductByKey).toBeDefined();
    expect(getProductByKey?.request.path).toBe('/Products(1)');

    const mergeCustomer = suite.tests.find(t => t.id === 'v2_merge_Customers');
    expect(mergeCustomer).toBeDefined();
    expect(mergeCustomer?.request.headers?.['X-HTTP-Method']).toBe('MERGE');
  });
});
