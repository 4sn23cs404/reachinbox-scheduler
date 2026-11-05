import nodemailer from 'nodemailer';
import prisma from '../config/database';
import { decrypt } from '../utils/encryption';

export interface SendEmailPayload {
  emailId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
}

export interface SendEmailResult {
  messageId: string;
  etherealPreviewUrl?: string;
  accepted: string[];
  rejected: string[];
}

export class EmailService {
  private static etherealAccount: nodemailer.TestAccount | null = null;

  /**
   * Gets or initializes an Ethereal SMTP test account
   */
  static async getEtherealTransporter() {
    let host = process.env.ETHEREAL_HOST || 'smtp.ethereal.email';
    let port = Number(process.env.ETHEREAL_PORT) || 587;
    let user = process.env.ETHEREAL_USER;
    let pass = process.env.ETHEREAL_PASS;

    // If user and pass are not configured in environment, generate test account automatically
    if (!user || !pass) {
      if (!this.etherealAccount) {
        console.log('🔄 Creating new Ethereal Email test account...');
        this.etherealAccount = await nodemailer.createTestAccount();
        console.log(`✅ Ethereal test account created: ${this.etherealAccount.user}`);
      }
      user = this.etherealAccount.user;
      pass = this.etherealAccount.pass;
      host = this.etherealAccount.smtp.host;
      port = this.etherealAccount.smtp.port;
    }

    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  }

  /**
   * Retrieves transporter for a specific sender (custom SMTP or Ethereal fallback)
   */
  static async getTransporterForSender(senderId: string) {
    const sender = await prisma.emailSender.findUnique({
      where: { id: senderId },
    });

    if (!sender) {
      throw new Error(`Sender with ID ${senderId} not found.`);
    }

    if (sender.smtpHost && sender.smtpUser && sender.smtpPass) {
      const decryptedPass = decrypt(sender.smtpPass);
      return {
        transporter: nodemailer.createTransport({
          host: sender.smtpHost,
          port: sender.smtpPort || 587,
          secure: sender.smtpPort === 465,
          auth: {
            user: sender.smtpUser,
            pass: decryptedPass,
          },
        }),
        senderEmail: sender.email,
        displayName: sender.displayName,
      };
    }

    // Default to Ethereal
    const transporter = await this.getEtherealTransporter();
    return {
      transporter,
      senderEmail: sender.email,
      displayName: sender.displayName,
    };
  }

  /**
   * Delivers an email and returns the result including Ethereal preview URL
   */
  static async sendMail(payload: SendEmailPayload): Promise<SendEmailResult> {
    const { transporter, senderEmail, displayName } =
      await this.getTransporterForSender(payload.senderId);

    const fromAddress = displayName
      ? `"${displayName}" <${senderEmail}>`
      : senderEmail;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: payload.recipientEmail,
      subject: payload.subject,
      text: payload.body,
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">${payload.body.replace(
        /\n/g,
        '<br>'
      )}</div>`,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;

    return {
      messageId: info.messageId,
      etherealPreviewUrl: previewUrl,
      accepted: info.accepted.map(String),
      rejected: info.rejected.map(String),
    };
  }
}
