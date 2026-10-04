'use client';

import { apiFetch, apiFetchOrNull } from './client-api';
import type { FinanceSnapshot, Holding } from '@/types/finance';
import type { HealthMetric, HealthTracking, Prayer } from '@/types/personal';
import type { CategoryKind, LedgerCategory, LedgerEntry, MonthlyLedger, MonthlyLedgerPayload } from '@/types/ledger';
import type { AgentConversation, AgentChatMessage, PendingAgentAction } from '@/lib/agent/types';
import type { heldFunds } from './ledger';

export type ToolLog = {
  type: 'internal' | 'external';
  id: string;
  requestId: string;
  model: string;
  toolCallId: string;
  toolName: string;
  arguments: unknown;
  result: unknown;
  error: string | null;
  durationMs: number | null;
  createdAt: string;
};

export type CategoryInput = { id?: string; name?: string; kind?: CategoryKind; archived?: boolean };

export const financeApi = {
  load: () => apiFetch<{ holdings: Holding[] }>('/api/finance'),
  save: (holdings: Holding[]) => apiFetch<{ data?: { holdings: Holding[] } }>('/api/finance', { body: { holdings } }),
};

export const ledgerApi = {
  load: (month: string) => apiFetchOrNull<MonthlyLedger>(`/api/ledger?month=${encodeURIComponent(month)}`),
  create: (month: string) => apiFetch<MonthlyLedger>('/api/ledger', { body: { month } }),
  save: (payload: MonthlyLedgerPayload) => apiFetch<MonthlyLedger>('/api/ledger', { method: 'PUT', body: payload }),
  addEntry: (month: string, entry: LedgerEntry) =>
    apiFetch<MonthlyLedger>('/api/ledger/entries', { body: { month, entry } }),
  updateEntry: (month: string, entry: LedgerEntry) =>
    apiFetch<MonthlyLedger>(`/api/ledger/entries/${entry.id}`, { method: 'PUT', body: { month, entry } }),
  removeEntry: (month: string, id: string) =>
    apiFetch<MonthlyLedger>(`/api/ledger/entries/${id}?month=${encodeURIComponent(month)}`, { method: 'DELETE' }),
};

export const categoriesApi = {
  list: () => apiFetch<LedgerCategory[]>('/api/categories'),
  create: (input: { name: string; kind: CategoryKind }) => apiFetch<LedgerCategory>('/api/categories', { body: input }),
  update: (input: CategoryInput & { id: string }) =>
    apiFetch<LedgerCategory>('/api/categories', { method: 'PUT', body: input }),
  remove: (id: string) => apiFetch('/api/categories', { method: 'DELETE', body: { id } }),
};

export const heldFundsApi = {
  load: () => apiFetch<ReturnType<typeof heldFunds>>('/api/held-funds'),
};

export const snapshotsApi = {
  list: () => apiFetch<FinanceSnapshot[]>('/api/snapshots'),
  create: (holdings: Holding[], grandTotal: number) =>
    apiFetch('/api/snapshots', { body: { data: { holdings }, grandTotal } }),
  remove: (id: string) => apiFetch('/api/snapshots', { method: 'DELETE', body: { id } }),
};

export const prayersApi = {
  list: () => apiFetch<{ prayers: Prayer[]; updatedAt: string | null }>('/api/prayers'),
  create: (namaaz: string, missed: number) => apiFetch('/api/prayers', { body: { namaaz, missed } }),
  update: (id: string, missed: number) => apiFetch(`/api/prayers/${id}`, { method: 'PUT', body: { missed } }),
};

export const healthApi = {
  list: () => apiFetch<HealthTracking[]>('/api/health-tracking'),
  create: (body: { metricId: string; value: number; createdAt?: string }) => apiFetch('/api/health-tracking', { body }),
  update: (id: string, body: { metricId?: string; value?: number; createdAt?: string }) =>
    apiFetch(`/api/health-tracking/${id}`, { method: 'PUT', body }),
  remove: (id: string) => apiFetch(`/api/health-tracking/${id}`, { method: 'DELETE' }),
};

export const healthMetricsApi = {
  list: () => apiFetch<HealthMetric[]>('/api/health-metrics'),
  create: (name: string) => apiFetch<HealthMetric>('/api/health-metrics', { body: { name } }),
  rename: (id: string, name: string) => apiFetch('/api/health-metrics', { method: 'PUT', body: { id, name } }),
  remove: (id: string) => apiFetch('/api/health-metrics', { method: 'DELETE', body: { id } }),
};

export const agentApi = {
  listChats: () => apiFetch<{ chats?: AgentConversation[] }>('/api/agent/chats'),
  createChat: () => apiFetch<{ chat?: AgentConversation }>('/api/agent/chats', { body: {} }),
  deleteChat: (id: string) => apiFetch(`/api/agent/chats/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  messages: (chatId: string) =>
    apiFetch<{ messages?: AgentChatMessage[] }>(`/api/finance-agent/messages?chatId=${encodeURIComponent(chatId)}`),
  clearMessages: (chatId: string) =>
    apiFetch(`/api/finance-agent/messages?chatId=${encodeURIComponent(chatId)}`, { method: 'DELETE' }),
  resolveAction: (actionId: string, intent: 'confirm' | 'cancel', entry?: Record<string, unknown>) =>
    apiFetch<{ action?: PendingAgentAction }>(`/api/finance-agent/actions/${encodeURIComponent(actionId)}/${intent}`, {
      body: entry ? { entry } : {},
    }),
  logs: (limit = 200) => apiFetch<{ logs?: ToolLog[] }>(`/api/finance-agent/logs?limit=${limit}`),

  streamChat: (chatId: string | null, messages: unknown[]) =>
    fetch('/api/finance-agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, messages }),
    }),
};

export const authApi = {
  login: (next: string | null) =>
    apiFetch<{ emailed?: boolean; loginLink?: string }>('/api/finance-auth/login', { body: { next } }),
  verify: (token: string) => apiFetch('/api/finance-auth/verify', { body: { token } }),
  logout: () => apiFetch('/api/finance-auth/logout', { body: {} }),
};

export const oauthApi = {
  register: (body: {
    client_name: string;
    redirect_uris: string[];
    grant_types: string[];
    response_types: string[];
    token_endpoint_auth_method: string;
  }) => apiFetch<{ client_id: string }>('/oauth/register', { body }),
};

export const contactApi = {
  send: (body: Record<string, unknown>) => apiFetch('/api/contact', { body }),
};
