import { FinancePageShell } from '../components/FinanceUI';
import { FinanceAgentChat } from './components/FinanceAgentChat';

export default function FinanceAgentPage() {
  return (
    <FinancePageShell
      section="agent"
      title="Assistant"
      description="One assistant for The Byte Office, finance, and personal data. Each chat keeps its own memory. Writes wait for your confirmation."
    >
      <FinanceAgentChat />
    </FinancePageShell>
  );
}
