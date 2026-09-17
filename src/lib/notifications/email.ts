import nodemailer from "nodemailer";

/**
 * SMTP (Mailpit locally) is core demo infra provisioned by docker-compose,
 * the same way Postgres and MinIO are — not an optional integration with a
 * mock fallback. If it's down, we log and move on rather than failing the
 * caller (a notification email is never the reason a review action fails).
 */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: false,
});

export async function sendEmail(to: string, subject: string, text: string) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "DSAC Reporting Platform <no-reply@dsac.gov.za>",
      to,
      subject,
      text,
    });
  } catch (error) {
    console.error(`[email] Failed to send "${subject}" to ${to}:`, error instanceof Error ? error.message : error);
  }
}
