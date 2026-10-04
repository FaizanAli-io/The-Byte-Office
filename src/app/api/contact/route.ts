import { ApiError, apiRoute, jsonBody } from '@/lib/api';
import { parseInquiry, sendInquiryEmail } from '@/lib/inquiry-email';

export const runtime = 'nodejs';

const THROTTLE_MS = 30_000;
const lastSentAt = new Map<string, number>();

export const POST = apiRoute('POST /api/contact', 'Unable to send your message', async (request: Request) => {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (Date.now() - (lastSentAt.get(ip) ?? 0) < THROTTLE_MS) {
    throw new ApiError('Please wait a moment before sending another message', 429);
  }

  const body = await jsonBody<Record<string, unknown>>(request);

  if (typeof body.website === 'string' && body.website.trim()) {
    return { success: true };
  }

  const inquiry = parseInquiry(body);
  lastSentAt.set(ip, Date.now());

  if (!(await sendInquiryEmail(inquiry))) {
    throw new ApiError('Email is not configured right now. Please email us directly.', 503);
  }
  return { success: true };
});
