import { prisma } from "../db/prisma.js";
import { logger } from "../utils/logger.js";
import { toUtc } from "../utils/tz.js";
import type { Reminder, Recurrence } from "@prisma/client";

export interface CreateReminderInput {
  userId: bigint;
  text: string;
  localDate: Date; // fecha wall-clock en tz del usuario
  tz: string;
  attachmentType?: string | null;
  attachmentFileId?: string | null;
  attachmentCaption?: string | null;
  recurrencePattern?: string | null;
  recurrenceEndDate?: Date | null;
  recurrenceCount?: number | null;
}

export async function createReminder(input: CreateReminderInput): Promise<Reminder> {
  const triggerAt = toUtc(input.localDate, input.tz);

  let recurrenceId: string | undefined;
  if (input.recurrencePattern) {
    const rec = await prisma.recurrence.create({
      data: {
        pattern: input.recurrencePattern,
        endDate: input.recurrenceEndDate ?? null,
        count: input.recurrenceCount ?? null,
      },
    });
    recurrenceId = rec.id;
  }

  const reminder = await prisma.reminder.create({
    data: {
      userId: input.userId,
      text: input.text,
      triggerAt,
      recurrenceId: recurrenceId ?? null,
      attachmentType: (input.attachmentType as any) ?? null,
      attachmentFileId: input.attachmentFileId ?? null,
      attachmentCaption: input.attachmentCaption ?? null,
      status: "PENDING",
    },
  });

  logger.info({ reminderId: reminder.id, userId: String(input.userId), triggerAt }, "recordatorio creado");
  return reminder;
}

export async function listReminders(userId: bigint, includeAll = false) {
  return prisma.reminder.findMany({
    where: {
      userId,
      ...(includeAll ? {} : { status: { in: ["PENDING", "SNOOZED"] } }),
    },
    orderBy: { triggerAt: "asc" },
    include: { recurrence: true },
  });
}

export async function getReminder(id: string) {
  return prisma.reminder.findUnique({ where: { id }, include: { recurrence: true, user: true } });
}

export async function deleteReminder(id: string, userId: bigint) {
  const r = await prisma.reminder.findFirst({ where: { id, userId } });
  if (!r) return null;
  await prisma.reminder.delete({ where: { id } });
  return r;
}

export async function markStatus(id: string, status: "SENT" | "DONE" | "CANCELLED" | "SNOOZED", snoozedUntil?: Date) {
  return prisma.reminder.update({
    where: { id },
    data: { status, snoozedUntil: snoozedUntil ?? null },
  });
}

export async function updateJobId(id: string, jobId: string) {
  return prisma.reminder.update({ where: { id }, data: { jobId } });
}

export async function findDueReminders() {
  return prisma.reminder.findMany({
    where: { status: "PENDING", triggerAt: { lte: new Date() } },
    include: { user: true },
  });
}
