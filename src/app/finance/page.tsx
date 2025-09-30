"use client";
import { useState } from "react";
import PasswordGate from "./components/PasswordGate";
import FinanceEditor from "./components/FinanceEditor";

export default function FinancePage() {
  const [authed, setAuthed] = useState(false);

  if (!authed) {
    return <PasswordGate onAuth={() => setAuthed(true)} />;
  }

  return <FinanceEditor />;
}
