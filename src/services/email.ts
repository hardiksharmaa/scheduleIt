// Email service — implemented in Task 10
// This file will contain Gmail API integration and email template sending logic.

export async function sendEmail(_options: {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: string }[];
}) {
  // TODO: Task 10 — Gmail API integration
  console.log("Email service not yet configured. Implement in Task 10.");
}
