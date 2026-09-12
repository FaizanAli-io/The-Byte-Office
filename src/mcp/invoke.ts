import { applyFinanceAction, type FinanceWriteAction } from '@/lib/finance-agent/actions';
import { executeFinanceTool } from '@/lib/finance-agent/tools';
import { financeToolByName, inputSchemaForTool } from './catalog';

export async function invokeFinanceTool(name: string, args: unknown = {}) {
  const tool = financeToolByName.get(name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  const parsed = inputSchemaForTool(tool).parse(args);

  if (tool.write) {
    return applyFinanceAction(name as FinanceWriteAction, parsed);
  }

  const { output } = await executeFinanceTool(name, parsed);
  return output;
}
