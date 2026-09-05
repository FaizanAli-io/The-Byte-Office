import nodemailer from "nodemailer";
import { FINANCE_LOGIN_EMAIL } from "@/lib/finance-constants";

export async function sendFinanceLoginEmail(loginUrl: string) {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, "");
  if (!user || !pass) return false;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `The Byte Office <${user}>`,
    to: FINANCE_LOGIN_EMAIL,
    subject: "Your finance login link",
    html: `
      <p>Use this link to open the private finance workspace:</p>
      <p><a href="${loginUrl}">Open finance workspace</a></p>
      <p>This link expires in 15 minutes. If you did not request it, you can ignore this email.</p>
    `,
    text: `Open the finance workspace: ${loginUrl}\n\nThis link expires in 15 minutes.`,
  });

  return true;
}
