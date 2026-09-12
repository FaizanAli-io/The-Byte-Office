import nodemailer from 'nodemailer';
import { company } from '@/app/data/site';

export async function sendInquiryEmail(input: {
  name: string;
  email: string;
  company?: string;
  service?: string;
  message: string;
}) {
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
