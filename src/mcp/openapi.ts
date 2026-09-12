import { z } from 'zod/v4';
import { financeToolCatalog, inputSchemaForTool } from './catalog';
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from './server';

type OpenApiDocument = Record<string, unknown>;

export function buildOpenApiDocument(origin: string): OpenApiDocument {
  const paths: Record<string, unknown> = {
    '/api/mcp': {
      post: {
        tags: ['MCP'],
        summary: 'MCP Streamable HTTP endpoint',
        description:
          'Primary Model Context Protocol endpoint for ChatGPT, Claude, Cursor, and other MCP clients. Send JSON-RPC over Streamable HTTP.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'MCP JSON-RPC response or SSE stream' },
          '401': { description: 'Missing or invalid bearer token' },
        },
      },
      get: {
        tags: ['MCP'],
        summary: 'MCP Streamable HTTP endpoint (GET)',
        description: 'Used by MCP clients for session/stream operations in legacy mode.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'MCP response' },
          '401': { description: 'Missing or invalid bearer token' },
        },
      },
      delete: {
        tags: ['MCP'],
        summary: 'MCP Streamable HTTP endpoint (DELETE)',
        description: 'Used by MCP clients for session teardown in legacy mode.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'MCP response' },
          '401': { description: 'Missing or invalid bearer token' },
        },
      },
    },
  };

  for (const tool of financeToolCatalog) {
    const operation = {
      tags: [tool.write ? 'Finance Write' : 'Finance Read'],
      summary: tool.title,
      description: tool.description,
      security: [{ bearerAuth: [] }],
      responses: {
        '200': {
          description: 'Tool result',
          content: {
            'application/json': {
              schema: { type: 'object', additionalProperties: true },
            },
          },
        },
        '400': { description: 'Invalid arguments' },
        '401': { description: 'Missing or invalid bearer token' },
        '404': { description: 'Unknown tool' },
        '500': { description: 'Tool execution failed' },
      },
    };

    const path = `/api/mcp/tools/${tool.name}`;
    if (tool.method === 'get') {
      paths[path] = { get: operation };
      continue;
    }

    paths[path] = {
      post: {
        ...operation,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: z.toJSONSchema(inputSchemaForTool(tool)),
            },
          },
        },
      },
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: `${MCP_SERVER_NAME} MCP API`,
      version: MCP_SERVER_VERSION,
      description:
        'HTTP MCP server and REST tool wrappers for The Byte Office finance tools. Use /api/mcp for MCP clients, or /api/mcp/tools/{name} for direct REST calls and Swagger testing.',
    },
    servers: [{ url: origin }],
    tags: [
      { name: 'MCP', description: 'Model Context Protocol transport' },
      { name: 'Finance Read', description: 'Read-only finance tools' },
      { name: 'Finance Write', description: 'Mutating finance tools' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API key',
          description: 'Set MCP_API_KEY in your environment and send Authorization: Bearer <MCP_API_KEY>.',
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths,
  };
}
