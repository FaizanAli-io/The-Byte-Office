"use client";
import { useState, useEffect } from "react";

interface PasswordGateProps {
  onAuth: () => void;
}

export default function PasswordGate({ onAuth }: PasswordGateProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const authed = localStorage.getItem("financeAuthed");
      if (authed === "true") {
        onAuth();
      }
    }
  }, [onAuth]);

  const handleSubmit = () => {
    if (input === process.env.NEXT_PUBLIC_FINANCE_PASSWORD) {
      localStorage.setItem("financeAuthed", "true");
      onAuth();
    } else {
      setError("Invalid password");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen space-y-4">
      <h1 className="text-2xl font-bold">Finance Login</h1>
      <input
        value={input}
        type="password"
        onKeyDown={handleKeyDown}
        placeholder="Enter password"
        className="border rounded px-3 py-2"
        onChange={(e) => setInput(e.target.value)}
      />
      <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={handleSubmit}>
        Login
      </button>
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
}
