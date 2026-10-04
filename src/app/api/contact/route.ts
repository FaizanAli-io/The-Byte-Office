import { ApiError, apiRoute, ipThrottle, jsonBody } from '@/lib/api';
import { parseInquiry, sendInquiryEmail } from '@/lib/inquiry-email';

export const runtime = 'nodejs';

const throttle = ipThrottle(30_000, 'Please wait a moment before sending another message');

export const POST = apiRoute('POST /api/contact', 'Unable to send your message', async (request: Request) => {
  const markSent = throttle(request);
  const body = await jsonBody<Record<string, unknown>>(request);

  if (typeof body.website === 'string' && body.website.trim()) {
    return { success: true };
  }

  const inquiry = parseInquiry(body);
  markSent();

  if (!(await sendInquiryEmail(inquiry))) {
    throw new ApiError('Email is not configured right now. Please email us directly.', 503);
  }
  return { success: true };
});
