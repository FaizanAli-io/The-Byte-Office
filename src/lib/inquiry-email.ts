import { ApiError } from '@/lib/api';
import { sendMail } from '@/lib/mail';
import { company } from '@/content/site';

type Inquiry = {
  name: string;
  email: string;
  company?: string;
  service?: string;
  message: string;
};

const LIMITS = { name: 120, email: 254, company: 160, service: 80, message: 5_000 } as const;

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
