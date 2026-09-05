import { FinancePageShell } from "../components/FinanceUI";
import { FinanceAgentChat } from "./components/FinanceAgentChat";

export default function FinanceAgentPage() {
  return (
    <FinancePageShell
      title="Finance assistant"
      description="Ask questions across your live portfolio, snapshots, and ledgers. Every proposed change waits for your confirmation."
    >
      <FinanceAgentChat />
    </FinancePageShell>
  );
}
