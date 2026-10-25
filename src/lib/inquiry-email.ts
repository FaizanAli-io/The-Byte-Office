import type { z } from 'zod/v4';
import { parseWith } from '@/lib/api';
import { inquirySchema } from '@/lib/agent/fields';
import { sendMail } from '@/lib/mail';
import { company } from '@/content/site';

type Inquiry = z.infer<typeof inquirySchema>;

export function parseInquiry(value: unknown): Inquiry {
  const inquiry = parseWith(inquirySchema, value);
  return { ...inquiry, company: inquiry.company || undefined, service: inquiry.service || undefined };
}

export function sendInquiryEmail(input: Inquiry) {
  const subject = input.service
    ? `Website inquiry: ${input.service} — ${input.name}`
    : `Website inquiry from ${input.name}`;

  return sendMail({
    to: company.email,
    replyTo: input.email,
    subject,
    text: [
      `Name: ${input.name}`,
      `Email: ${input.email}`,
      input.company ? `Company: ${input.company}` : null,
      input.service ? `Service: ${input.service}` : null,
      '',
      input.message,
    ]
      .filter(Boolean)
      .join('\n'),
  });
}
