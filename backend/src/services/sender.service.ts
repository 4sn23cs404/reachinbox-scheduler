import prisma from '../config/database';
import { encrypt } from '../utils/encryption';

export interface CreateSenderInput {
  email: string;
  displayName: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  isDefault?: boolean;
}

export class SenderService {
  static async getSendersByUser(userId: string) {
    const senders = await prisma.emailSender.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        userId: true,
        email: true,
        displayName: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        isDefault: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // Notice: smtpPass is NEVER returned in the API response!
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    return senders;
  }

  static async createSender(userId: string, input: CreateSenderInput) {
    // If setting as default, unset other default senders
    if (input.isDefault) {
      await prisma.emailSender.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const encryptedPass = input.smtpPass ? encrypt(input.smtpPass) : null;

    const sender = await prisma.emailSender.create({
      data: {
        userId,
        email: input.email.toLowerCase().trim(),
        displayName: input.displayName.trim(),
        smtpHost: input.smtpHost || null,
        smtpPort: input.smtpPort ? Number(input.smtpPort) : null,
        smtpUser: input.smtpUser || null,
        smtpPass: encryptedPass,
        isDefault: input.isDefault ?? false,
        isActive: true,
      },
      select: {
        id: true,
        userId: true,
        email: true,
        displayName: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        isDefault: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return sender;
  }

  static async updateSender(
    userId: string,
    senderId: string,
    data: Partial<CreateSenderInput> & { isActive?: boolean }
  ) {
    const sender = await prisma.emailSender.findFirst({
      where: { id: senderId, userId },
    });

    if (!sender) {
      throw new Error('Sender not found or unauthorized.');
    }

    if (data.isDefault) {
      await prisma.emailSender.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updatePayload: any = {};
    if (data.displayName !== undefined) updatePayload.displayName = data.displayName;
    if (data.email !== undefined) updatePayload.email = data.email.toLowerCase().trim();
    if (data.smtpHost !== undefined) updatePayload.smtpHost = data.smtpHost;
    if (data.smtpPort !== undefined) updatePayload.smtpPort = Number(data.smtpPort);
    if (data.smtpUser !== undefined) updatePayload.smtpUser = data.smtpUser;
    if (data.smtpPass) updatePayload.smtpPass = encrypt(data.smtpPass);
    if (data.isDefault !== undefined) updatePayload.isDefault = data.isDefault;
    if (data.isActive !== undefined) updatePayload.isActive = data.isActive;

    return await prisma.emailSender.update({
      where: { id: senderId },
      data: updatePayload,
      select: {
        id: true,
        userId: true,
        email: true,
        displayName: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        isDefault: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  static async deleteSender(userId: string, senderId: string) {
    const sender = await prisma.emailSender.findFirst({
      where: { id: senderId, userId },
    });

    if (!sender) {
      throw new Error('Sender not found or unauthorized.');
    }

    // Soft delete to maintain email relational integrity
    return await prisma.emailSender.update({
      where: { id: senderId },
      data: { isActive: false },
    });
  }
}
