import { z } from 'zod/v4';
import { httpMethodFor, mcpToolRegistry } from '@/lib/agent/registry';
import { OAUTH_MODULES, scopeForTool } from '@/lib/oauth/tokens';
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from './server';

type OpenApiDocument = Record<string, unknown>;

const MODULE_TAGS = { finance: 'Finance', personal: 'Personal', tbo: 'The Byte Office' } as const;

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  'finance:read': 'Read the portfolio, snapshots and ledgers',
  'finance:write': 'Create, update and remove holdings and ledger entries',
  'personal:read': 'Read missed prayer counts and health readings',
  'personal:write': 'Create, update and remove prayer counts and health readings',
  'tbo:read': 'Read public company information',
  'tbo:write': 'Send inquiry emails to The Byte Office',
};

export function buildOpenApiDocument(origin: string): OpenApiDocument {
  const paths: Record<string, unknown> = {
    '/api/mcp': {
      post: {
        tags: ['MCP'],
        summary: 'MCP Streamable HTTP endpoint',
        description:
          'Primary Model Context Protocol endpoint for ChatGPT, Claude, Cursor, and other MCP clients. Send JSON-RPC over Streamable HTTP.',
        security: [{ oauth2: [] }],
        responses: {
          '200': { description: 'MCP JSON-RPC response or SSE stream' },
          '401': { description: 'Missing or invalid access token' },
        },
      },
      get: {
        tags: ['MCP'],
        summary: 'MCP Streamable HTTP endpoint (GET)',
        description: 'Used by MCP clients for session/stream operations in legacy mode.',
        security: [{ oauth2: [] }],
        responses: {
          '200': { description: 'MCP response' },
          '401': { description: 'Missing or invalid access token' },
        },
      },
      delete: {
        tags: ['MCP'],
        summary: 'MCP Streamable HTTP endpoint (DELETE)',
        description: 'Used by MCP clients for session teardown in legacy mode.',
        security: [{ oauth2: [] }],
        responses: {
          '200': { description: 'MCP response' },
          '401': { description: 'Missing or invalid access token' },
        },
      },
    },
  };

  for (const tool of mcpToolRegistry) {
    const operation = {
      tags: [`${MODULE_TAGS[tool.module]} ${tool.write ? 'write' : 'read'}`],
      summary: tool.title,
      description: tool.description,
      security: [{ oauth2: [scopeForTool(tool)] }],
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
        '401': { description: 'Missing or invalid access token' },
        '403': { description: 'Token lacks the required scope' },
        '404': { description: 'Unknown tool' },
        '500': { description: 'Tool execution failed' },
      },
    };

    const path = `/api/mcp/tools/${tool.name}`;
    if (httpMethodFor(tool) === 'get') {
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
              schema: z.toJSONSchema(tool.schema),
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
        'HTTP MCP server and REST tool wrappers for The Byte Office tools. Use /api/mcp for MCP clients, or /api/mcp/tools/{name} for direct REST calls and Swagger testing. All access is OAuth 2.1; there is no API key.',
    },
    servers: [{ url: origin }],
    tags: [
      { name: 'MCP', description: 'Model Context Protocol transport' },
      ...OAUTH_MODULES.flatMap((module) => [
        { name: `${MODULE_TAGS[module]} read`, description: `Read-only ${MODULE_TAGS[module]} tools` },
        { name: `${MODULE_TAGS[module]} write`, description: `Mutating ${MODULE_TAGS[module]} tools` },
      ]),
    ],
    components: {
      securitySchemes: {
        oauth2: {
          type: 'oauth2',
          description:
            'Authorize with the workspace OAuth server. Swagger performs the authorization code flow with PKCE; write tools additionally need the finance:write scope.',
          flows: {
            authorizationCode: {
              authorizationUrl: `${origin}/oauth/authorize`,
              tokenUrl: `${origin}/oauth/token`,
              refreshUrl: `${origin}/oauth/token`,
              scopes: SCOPE_DESCRIPTIONS,
            },
          },
        },
      },
    },
    security: [{ oauth2: [] }],
    paths,
  };
}
