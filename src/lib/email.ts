import nodemailer from "nodemailer";
import { welcomeEmail } from "./email-templates/welcome";

import { paymentEmail, type PaidOrder } from "./email-templates/payment";

export class MailDeliveryError extends Error {
  constructor(public readonly code: string) {
    super(`SMTP email failed (${code})`);
    this.name = "MailDeliveryError";
  }
}

export function isEmailConfigured() {
  return Boolean(
    process.env.SMTP_USER?.trim() && process.env.SMTP_PASSWORD
  );
}

export async function sendPaymentConfirmation(order: PaidOrder) {
  if (!isEmailConfigured()) {
    console.warn("Payment email skipped: SMTP is not configured");
    return;
  }

  const message = {
    displayName: process.env.EMAIL_FROM_NAME || "Khan Sofa",
    to: [order.customerEmail],
    ...paymentEmail(order, process.env.FRONTEND_URL || "https://khansofa.com"),
  };

  await sendHostingerEmail(message);
}

export async function sendSubscriptionThankYou(email: string) {
  await sendHostingerEmail({
    displayName: process.env.EMAIL_FROM_NAME || "Khan Sofa",
    to: [email],
    ...welcomeEmail(process.env.FRONTEND_URL || "https://khansofa.com"),
  });
}

async function sendHostingerEmail(message: {
  displayName: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
}) {
  if (!isEmailConfigured()) {
    throw new Error("SMTP is not configured");
  }

  const port = Number(process.env.SMTP_PORT || 465);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.hostinger.com",
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: {
      user: process.env.SMTP_USER!.trim(),
      pass: process.env.SMTP_PASSWORD!,
    },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });

  try {
    await transporter.sendMail({
      from: { name: message.displayName, address: process.env.SMTP_USER!.trim() },
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  } catch (error) {
    // Only expose a known error code, never server responses or credentials.
    const code = (error as { code?: string })?.code;
    const safeCodes = ["EAUTH", "ECONNECTION", "ETIMEDOUT", "ESOCKET", "EENVELOPE", "EMESSAGE"];
    throw new MailDeliveryError(code && safeCodes.includes(code) ? code : "SMTP_ERROR");
  } finally {
    transporter.close();
  }
}
