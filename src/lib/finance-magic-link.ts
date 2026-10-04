import 'server-only';
import { randomUUID } from 'crypto';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { magicLinks } from '@/lib/db/schema';
import { FINANCE_MAGIC_LINK_MAX_AGE, signMagicLink, verifyMagicLinkSignature } from '@/lib/finance-auth';

export async function issueMagicLink() {
  const nonce = randomUUID();
  const expiresAt = new Date(Date.now() + FINANCE_MAGIC_LINK_MAX_AGE * 1000);
  const db = getDb();

  await db.insert(magicLinks).values({ nonce, expiresAt });
  await db.delete(magicLinks).where(lt(magicLinks.expiresAt, new Date(Date.now() - 86_400_000)));

  return signMagicLink(nonce, expiresAt.getTime());
}

export async function consumeMagicLink(token?: string) {
  const nonce = await verifyMagicLinkSignature(token);
  if (!nonce) return false;

  const claimed = await getDb()
    // Claim and check in one statement so a link can be redeemed once.
    .update(magicLinks)
    .set({ consumedAt: new Date() })
    .where(and(eq(magicLinks.nonce, nonce), isNull(magicLinks.consumedAt)))
    .returning({ nonce: magicLinks.nonce });

  return claimed.length > 0;
}
