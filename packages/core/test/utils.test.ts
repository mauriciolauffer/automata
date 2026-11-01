import { describe, it, expect } from 'vitest';
import { buildQueryString, resolvePath, joinPaths, parseXml, validateSchema } from '../src/index.js';

describe('@automata/core utilities', () => {
  describe('buildQueryString', () => {
    it('returns empty string when undefined or empty', () => {
      expect(buildQueryString()).toBe('');
      expect(buildQueryString({})).toBe('');
    });

    it('builds valid query string with encoded parameters', () => {
      const res = buildQueryString({ '$top': 10, '$filter': "Name eq 'Alice'" });
      expect(res).toBe('?%24top=10&%24filter=Name+eq+%27Alice%27');
    });
  });

  describe('resolvePath', () => {
    it('resolves parameterized path', () => {
      const path = resolvePath('/api/users/{userId}/orders/{orderId}', {
        userId: 'u123',
        orderId: 456
      });
      expect(path).toBe('/api/users/u123/orders/456');
    });
  });

  describe('joinPaths', () => {
    it('joins base path and subpath correctly', () => {
      expect(joinPaths('/api/v1', '/users')).toBe('/api/v1/users');
      expect(joinPaths('/api/v1/', 'users')).toBe('/api/v1/users');
      expect(joinPaths('', '/users')).toBe('/users');
    });
  });

  describe('parseXml', () => {
    it('parses XML content', () => {
      const xml = `<edmx:Edmx xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx" Version="1.0">
        <edmx:DataServices>
          <Schema Namespace="ODataDemo">
            <EntityType Name="Product">
              <Key><PropertyRef Name="ID" /></Key>
              <Property Name="ID" Type="Edm.Int32" Nullable="false" />
              <Property Name="Name" Type="Edm.String" />
            </EntityType>
          </Schema>
        </edmx:DataServices>
      </edmx:Edmx>`;

      const parsed: any = parseXml(xml);
      expect(parsed.Edmx).toBeDefined();
      expect(parsed.Edmx.DataServices.Schema.EntityType['@_Name']).toBe('Product');
    });
  });

  describe('validateSchema', () => {
    it('validates schema requirements', () => {
      const schema = {
        type: 'object',
        required: ['id', 'title'],
        properties: {
          id: { type: 'integer' },
          title: { type: 'string' }
        }
      };

      expect(validateSchema({ id: 1, title: 'Item' }, schema).valid).toBe(true);
      expect(validateSchema({ id: '1', title: 'Item' }, schema).valid).toBe(false);
      expect(validateSchema({ id: 1 }, schema).valid).toBe(false);
    });
  });
});
