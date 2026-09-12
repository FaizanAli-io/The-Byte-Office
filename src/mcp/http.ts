import { createMcpHandler } from '@modelcontextprotocol/server';
import { unauthorizedResponse, verifyMcpRequest } from './auth';
import { createMcpServer } from './server';

const handler = createMcpHandler(() => createMcpServer(), {
  legacy: 'stateless',
  responseMode: 'json',
});

export async function handleMcpRequest(request: Request) {
  const authInfo = verifyMcpRequest(request);
  if (!authInfo) {
    return unauthorizedResponse();
  }

  return handler.fetch(request, { authInfo });
}
