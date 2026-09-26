import nodemailer from 'nodemailer';
import { ApiError } from '@/lib/api';
import { company } from '@/content/site';

export type Inquiry = {
  name: string;
  email: string;
  company?: string;
  service?: string;
  message: string;
};

// Generous caps: enough for a real project brief, small enough that a bot
// cannot post a megabyte of text through a public endpoint.
const LIMITS = { name: 120, email: 254, company: 160, service: 80, message: 5_000 } as const;

/**
 * Validates an inquiry from either the public contact form or the assistant's
 * `tbo_send_inquiry` tool. Both reach the same mailbox, so both get the same
 * rules.
 */
export function parseInquiry(value: unknown): Inquiry {
  if (typeof value !== 'object' || value === null) throw new ApiError('Invalid inquiry');
  const raw = value as Record<string, unknown>;

  const text = (key: keyof typeof LIMITS, label: string, required: boolean) => {
    const input = raw[key];
    if (typeof input !== 'string' || !input.trim()) {
      if (required) throw new ApiError(`${label} is required`);
      return undefined;
    }
    const trimmed = input.trim();
    if (trimmed.length > LIMITS[key]) throw new ApiError(`${label} is too long`);
    return trimmed;
  };

  const name = text('name', 'A name', true)!;
  const email = text('email', 'A valid email', true)!;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError('A valid email is required');

  return {
    name,
    email,
    company: text('company', 'Company', false),
    service: text('service', 'Service', false),
    message: text('message', 'A message', true)!,
  };
}

export async function sendInquiryEmail(input: Inquiry) {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, '');
  if (!user || !pass) return false;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: { user, pass },
  });

  const subject = input.service
    ? `Website inquiry: ${input.service} — ${input.name}`
    : `Website inquiry from ${input.name}`;

  await transporter.sendMail({
    from: `The Byte Office <${user}>`,
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

  return true;
}
