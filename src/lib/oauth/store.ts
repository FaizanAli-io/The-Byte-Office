import 'server-only';
import { isUuid } from '@/lib/db/ids';
import { randomUUID } from 'crypto';
import { and, count, eq, gt, isNull, lt, or } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { oauthAuthorizationCodes, oauthClients, oauthRefreshTokens } from '@/lib/db/schema';
import { randomToken, sha256Hex } from '@/lib/hmac';
import { OAUTH_CODE_MAX_AGE, OAUTH_REFRESH_TOKEN_MAX_AGE } from './tokens';

export async function registerClient(clientName: string, redirectUris: string[]) {
  const [client] = await getDb().insert(oauthClients).values({ clientName, redirectUris }).returning();
  return client;
}

export async function recentClientCount() {
  const [row] = await getDb()
    .select({ value: count() })
    .from(oauthClients)
    .where(gt(oauthClients.createdAt, hoursAgo(1)));
  return row?.value ?? 0;
}

export async function getClient(clientId: string) {
  if (!isUuid(clientId)) return null;
  const [client] = await getDb().select().from(oauthClients).where(eq(oauthClients.clientId, clientId)).limit(1);
  return client ?? null;
}

export async function touchClient(clientId: string) {
  await getDb().update(oauthClients).set({ lastUsedAt: new Date() }).where(eq(oauthClients.clientId, clientId));
}

export async function createAuthorizationCode(input: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  resource: string;
}) {
  const db = getDb();
  const [row] = await db
    .insert(oauthAuthorizationCodes)
    .values({ ...input, expiresAt: new Date(Date.now() + OAUTH_CODE_MAX_AGE * 1000) })
    .returning({ code: oauthAuthorizationCodes.code });

  await db.delete(oauthAuthorizationCodes).where(lt(oauthAuthorizationCodes.expiresAt, hoursAgo(24)));
  return row.code;
}

export async function consumeAuthorizationCode(code: string) {
  if (!isUuid(code)) return null;
  const [row] = await getDb()
    .update(oauthAuthorizationCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(oauthAuthorizationCodes.code, code), isNull(oauthAuthorizationCodes.consumedAt)))
    .returning();

  if (!row || row.expiresAt <= new Date()) return null;
  return row;
}

export async function issueRefreshToken(clientId: string, scopes: string[], familyId: string = randomUUID()) {
  const token = randomToken();
  await getDb()
    .insert(oauthRefreshTokens)
    .values({
      tokenHash: await sha256Hex(token),
      clientId,
      familyId,
      scopes,
      expiresAt: new Date(Date.now() + OAUTH_REFRESH_TOKEN_MAX_AGE * 1000),
    });
  return token;
}

export type RotatedRefreshToken = { clientId: string; scopes: string[]; refreshToken: string };

export async function rotateRefreshToken(presented: string): Promise<RotatedRefreshToken | null> {
  const db = getDb();
  const tokenHash = await sha256Hex(presented);

  const [claimed] = await db
    .update(oauthRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(oauthRefreshTokens.tokenHash, tokenHash), isNull(oauthRefreshTokens.revokedAt)))
    .returning();

  // A spent refresh token presented again has leaked: revoke its whole chain.
  if (!claimed) {
    const [replayed] = await db
      .select({ familyId: oauthRefreshTokens.familyId })
      .from(oauthRefreshTokens)
      .where(eq(oauthRefreshTokens.tokenHash, tokenHash))
      .limit(1);
    if (replayed) await revokeFamily(replayed.familyId);
    return null;
  }

  if (claimed.expiresAt <= new Date()) return null;
  await pruneRefreshTokens();

  return {
    clientId: claimed.clientId,
    scopes: claimed.scopes,
    refreshToken: await issueRefreshToken(claimed.clientId, claimed.scopes, claimed.familyId),
  };
}

async function pruneRefreshTokens() {
  await getDb()
    .delete(oauthRefreshTokens)
    .where(or(lt(oauthRefreshTokens.expiresAt, new Date()), lt(oauthRefreshTokens.revokedAt, hoursAgo(24 * 30))));
}

async function revokeFamily(familyId: string) {
  await getDb()
    .update(oauthRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(oauthRefreshTokens.familyId, familyId), isNull(oauthRefreshTokens.revokedAt)));
}

export async function revokeRefreshToken(presented: string) {
  const [row] = await getDb()
    .select({ familyId: oauthRefreshTokens.familyId })
    .from(oauthRefreshTokens)
    .where(eq(oauthRefreshTokens.tokenHash, await sha256Hex(presented)))
    .limit(1);
  if (row) await revokeFamily(row.familyId);
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 3_600_000);
}
