export function jsonResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unexpected MCP tool error';
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true as const,
  };
}

export async function runTool(handler: () => Promise<unknown>) {
  try {
    return jsonResult(await handler());
  } catch (error) {
    return errorResult(error);
  }
}

export function jsonResource(uri: string, data: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}
