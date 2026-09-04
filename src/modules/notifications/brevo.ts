import axios from 'axios';

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || '';
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Vyntra';

const BREVO_API_URL = process.env.BREVO_API_URL || '';

export interface BrevoEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{ content: string; name: string }>;
}

export async function sendBrevoEmail(options: BrevoEmailOptions): Promise<boolean> {
  try {
    const payload = {
      sender: { email: BREVO_SENDER_EMAIL, name: BREVO_SENDER_NAME },
      to: [{ email: options.to }],
      subject: options.subject,
      htmlContent: options.html,
      textContent: options.text,
      attachment: options.attachments,
    };
    await axios.post(BREVO_API_URL || '', payload, {
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        'accept': 'application/json',
      },
    });
    return true;
  } catch (error) {
    console.error('Brevo email error:', error);
    return false;
  }
} 