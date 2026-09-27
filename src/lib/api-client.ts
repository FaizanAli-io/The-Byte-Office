'use client';

import { apiFetch, apiFetchOrNull } from './client-api';
import type { FinanceDoc, FinanceSnapshot } from '@/types/finance';
import type { HealthTracking, Prayer } from '@/types/personal';
import type { CategoryKind, LedgerCategory, MonthlyLedger, MonthlyLedgerPayload } from '@/types/ledger';
import type { AgentConversation, FinanceChatMessage, PendingAgentAction } from '@/lib/finance-agent/types';
import type { heldFunds } from './ledger';

/**
 * Every server endpoint the browser calls, as a typed function.
 *
 * Components used to hold the URLs themselves — a path string, a method and a
 * response generic at each call site, with the same generic written out twice
 * in two files and three places dropping to raw `fetch` and re-implementing
 * the error handling. Renaming a route meant grepping for a string.
 *
 * This module owns the URL, the method and the response type; `client-api.ts`
 * underneath still owns the transport, the JSON and the error. Nothing here
 * holds state or touches React, so a caller can use it from anywhere on the
 * client.
 */

export type ToolLog = {
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
  load: () => apiFetch<FinanceDoc>('/api/finance'),
  save: (data: FinanceDoc) => apiFetch<{ data?: FinanceDoc }>('/api/finance', { body: data }),
};

export const ledgerApi = {
  /** Resolves to `null` for a month with no ledger, which is not an error. */
  load: (month: string) => apiFetchOrNull<MonthlyLedger>(`/api/ledger?month=${encodeURIComponent(month)}`),
  create: (month: string, importFinance: boolean) =>
    apiFetch<MonthlyLedger>('/api/ledger', { body: { month, importFinance } }),
  save: (payload: MonthlyLedgerPayload) => apiFetch<MonthlyLedger>('/api/ledger', { method: 'PUT', body: payload }),
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
  create: (data: FinanceDoc, grandTotal: number) => apiFetch('/api/snapshots', { body: { data, grandTotal } }),
  remove: (id: string) => apiFetch('/api/snapshots', { method: 'DELETE', body: { id } }),
};

export const prayersApi = {
  list: () => apiFetch<Prayer[]>('/api/prayers'),
  create: (namaaz: string, missed: number) => apiFetch('/api/prayers', { body: { namaaz, missed } }),
  update: (id: string, missed: number) => apiFetch(`/api/prayers/${id}`, { method: 'PUT', body: { missed } }),
};

export const healthApi = {
  list: () => apiFetch<HealthTracking[]>('/api/health-tracking'),
  create: (body: { metric: string; value: number; createdAt?: string }) => apiFetch('/api/health-tracking', { body }),
  update: (id: string, body: { metric?: string; value?: number; createdAt?: string }) =>
    apiFetch(`/api/health-tracking/${id}`, { method: 'PUT', body }),
  remove: (id: string) => apiFetch(`/api/health-tracking/${id}`, { method: 'DELETE' }),
};

export const agentApi = {
  listChats: () => apiFetch<{ chats?: AgentConversation[] }>('/api/agent/chats'),
  createChat: () => apiFetch<{ chat?: AgentConversation }>('/api/agent/chats', { body: {} }),
  deleteChat: (id: string) => apiFetch(`/api/agent/chats/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  messages: (chatId: string) =>
    apiFetch<{ messages?: FinanceChatMessage[] }>(`/api/finance-agent/messages?chatId=${encodeURIComponent(chatId)}`),
  clearMessages: (chatId: string) =>
    apiFetch(`/api/finance-agent/messages?chatId=${encodeURIComponent(chatId)}`, { method: 'DELETE' }),
  resolveAction: (actionId: string, intent: 'confirm' | 'cancel', entry?: Record<string, unknown>) =>
    apiFetch<{ action?: PendingAgentAction }>(`/api/finance-agent/actions/${encodeURIComponent(actionId)}/${intent}`, {
      body: entry ? { entry } : {},
    }),
  logs: (limit = 200) => apiFetch<{ logs?: ToolLog[] }>(`/api/finance-agent/logs?limit=${limit}`),

  /**
   * The one call that stays raw: the reply is a stream, and `apiFetch` exists
   * to read a JSON body to completion. The caller drives the reader, so it
   * gets the `Response` and the URL stays here with the rest.
   */
  streamChat: (chatId: string | null, messages: unknown[]) =>
    fetch('/api/finance-agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, messages }),
    }),
};

export const authApi = {
  /** `next` is where to land after verifying; the link always goes to the one configured address. */
  login: (next: string | null) =>
    apiFetch<{ emailed?: boolean; loginLink?: string }>('/api/finance-auth/login', { body: { next } }),
  verify: (token: string) => apiFetch('/api/finance-auth/verify', { body: { token } }),
  logout: () => apiFetch('/api/finance-auth/logout', { body: {} }),
};

/**
 * Not one of the application's own endpoints: `/oauth/register` is RFC 7591
 * dynamic client registration, which the docs page uses to enrol itself. It
 * lives here so no browser code has to hand-roll a `fetch`.
 */
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
