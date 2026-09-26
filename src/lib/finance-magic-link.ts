import 'server-only';
import { randomUUID } from 'crypto';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { magicLinks } from '@/lib/db/schema';
import { FINANCE_MAGIC_LINK_MAX_AGE, signMagicLink, verifyMagicLinkSignature } from '@/lib/finance-auth';

/**
 * The database half of magic-link auth, kept out of `finance-auth.ts` because
 * that module runs in the edge middleware and must stay free of the driver.
 *
 * The signature alone cannot make a link single-use: it is valid for as long
 * as it has not expired, so anyone who reads it from a forwarded email, a
 * proxy log or browser history can replay it. Issuing records the nonce and
 * verification claims it, so only the first redemption succeeds.
 */

export async function issueMagicLink() {
  const nonce = randomUUID();
  const expiresAt = new Date(Date.now() + FINANCE_MAGIC_LINK_MAX_AGE * 1000);
  const db = getDb();

  await db.insert(magicLinks).values({ nonce, expiresAt });
  // Opportunistic cleanup; the table would otherwise grow one row per login.
  await db.delete(magicLinks).where(lt(magicLinks.expiresAt, new Date(Date.now() - 86_400_000)));

  return signMagicLink(nonce, expiresAt.getTime());
}

/** Verifies and consumes a link. Returns false for a forged, expired or reused one. */
export async function consumeMagicLink(token?: string) {
  const nonce = await verifyMagicLinkSignature(token);
  if (!nonce) return false;

  // Claiming and checking in one statement so two concurrent redemptions of
  // the same link cannot both succeed.
  const claimed = await getDb()
    .update(magicLinks)
    .set({ consumedAt: new Date() })
    .where(and(eq(magicLinks.nonce, nonce), isNull(magicLinks.consumedAt)))
    .returning({ nonce: magicLinks.nonce });

  return claimed.length > 0;
}
