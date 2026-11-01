export interface Env {
  [key: string]: unknown;
}

export default {
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method.toUpperCase();

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    };

    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (pathname.endsWith("/$metadata")) {
      const metadataXml = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="1.0" xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx">
  <edmx:DataServices m:DataServiceVersion="2.0" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata">
    <Schema Namespace="TestModel">
      <EntityType Name="Customer">
        <Key><PropertyRef Name="ID" /></Key>
        <Property Name="ID" Type="Edm.Int32" Nullable="false" />
        <Property Name="Name" Type="Edm.String" />
      </EntityType>
      <EntityContainer Name="Entities">
        <EntitySet Name="Customers" EntityType="TestModel.Customer" />
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

      return new Response(metadataXml, {
        headers: {
          "Content-Type": "application/xml",
          ...corsHeaders,
        },
      });
    }

    if (pathname === "/" || pathname === "/odata" || pathname === "/odata/") {
      return new Response(JSON.stringify({ value: [{ name: "Customers", url: "Customers" }] }), {
        headers: {
          "Content-Type": "application/json",
          DataServiceVersion: "2.0",
          "OData-Version": "4.0",
          ...corsHeaders,
        },
      });
    }

    if (pathname.includes("/Customers")) {
      const isSingle = pathname.includes("(") && pathname.includes(")");

      if (method === "GET") {
        if (isSingle) {
          return new Response(JSON.stringify({ ID: 1, Name: "Customer 1" }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
        return new Response(JSON.stringify({ value: [{ ID: 1, Name: "Customer 1" }] }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (method === "POST") {
        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
        }
        return new Response(JSON.stringify({ ID: 2, ...body }), {
          status: 201,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (method === "PATCH" || method === "PUT") {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      if (method === "DELETE") {
        return new Response(null, { status: 204, headers: corsHeaders });
      }
    }

    if (pathname.startsWith("/api/users")) {
      if (method === "GET") {
        return new Response(JSON.stringify([{ id: 1, name: "Alice" }]), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      if (method === "POST") {
        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
        }
        if (!body || !body.name) {
          return new Response("Missing required name", { status: 400, headers: corsHeaders });
        }
        return new Response(JSON.stringify({ id: 1, name: body.name }), {
          status: 201,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};
