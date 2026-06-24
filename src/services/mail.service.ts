import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { environment, mail as mailConfig } from "../config";
import EmailTemplate from "../models/emailTemplate";
import Logger from "../utils/logger";

let transport: Transporter | null = null;

function getTransport(): Transporter | null {
  if (!mailConfig.host || !mailConfig.senderEmail) {
    return null;
  }

  if (!transport) {
    transport = nodemailer.createTransport({
      host: mailConfig.host,
      port: mailConfig.port,
      secure: mailConfig.secure,
      auth: {
        user: mailConfig.user,
        pass: mailConfig.password,
      },
      requireTLS: mailConfig.requireTls,
    });
  }

  return transport;
}

export function replaceEmailTags(
  content: string,
  replacements: Record<string, string>
): string {
  return content.replace(/\{\{(.*?)\}\}/g, (_, key: string) => {
    const trimmed = key.trim();
    return replacements[trimmed] !== undefined ? replacements[trimmed] : `{{${key}}}`;
  });
}

export async function getEmailTemplate(
  slug: string,
  replacements: Record<string, string>
): Promise<{ subject: string; html: string } | null> {
  const record = await EmailTemplate.findOne({
    where: { slug },
    attributes: ["content", "subject"],
  });

  if (!record) {
    return null;
  }

  const json = record.toJSON() as { content: string | null; subject: string | null };
  const content = json.content ?? "";
  const subject = json.subject ?? "";

  return {
    subject: replaceEmailTags(subject, replacements),
    html: replaceEmailTags(content, replacements),
  };
}

export async function sendSmtpEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const mailTransport = getTransport();
  if (!mailTransport) {
    Logger.warn("SMTP not configured; skipping email send");
    return;
  }

  const ccEmail = environment === "production" ? "operations@renohome.ae" : "";

  try {
    await mailTransport.sendMail({
      from: mailConfig.senderEmail,
      to,
      cc: ccEmail || undefined,
      subject,
      html,
    });
  } catch (error) {
    Logger.error(error);
    throw error;
  }
}
