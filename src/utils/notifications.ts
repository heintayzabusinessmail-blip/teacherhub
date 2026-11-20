import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { NavTab, NotificationAudience, NotificationCategory } from '../types';

interface CreateTeacherAlertArgs {
  actorUid: string;
  actorName: string;
  category: Exclude<NotificationCategory, 'admin_notice'>;
  title: string;
  message: string;
  targetTab?: NavTab;
  priority?: 'normal' | 'important';
}

/**
 * Fires a live notification to Owner/Admin whenever a teacher submits a survey,
 * books/cancels a 1-to-1 meeting, asks an FAQ question, or suggests a resource.
 * Best-effort (never blocks or breaks the primary form submission).
 */
export async function notifyAdminOfTeacherAction(args: CreateTeacherAlertArgs): Promise<void> {
  try {
    await addDoc(collection(db, 'notifications'), {
      audience: 'admin' as NotificationAudience,
      category: args.category,
      priority: args.priority || 'important',
      title: args.title.trim().slice(0, 160),
      message: args.message.trim().slice(0, 600),
      actorUid: args.actorUid,
      actorName: (args.actorName || 'Teacher').trim().slice(0, 120),
      targetTab: (args.targetTab || 'admin').slice(0, 40),
      readByAdmin: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Could not send admin notification:', err);
  }
}

interface PublishNoticeArgs {
  actorUid: string;
  actorName: string;
  audience: 'all' | 'teachers';
  priority: 'normal' | 'important';
  title: string;
  message: string;
  targetTab?: NavTab | '';
}

/**
 * Publishes an Admin / Tr Hein Important Notice visible in the Notification Bar
 * for Teachers (and Viewers when audience === 'all').
 */
export async function publishAdminNotice(args: PublishNoticeArgs): Promise<void> {
  await addDoc(collection(db, 'notifications'), {
    audience: args.audience,
    category: 'admin_notice' as NotificationCategory,
    priority: args.priority,
    title: args.title.trim().slice(0, 160),
    message: args.message.trim().slice(0, 600),
    actorUid: args.actorUid,
    actorName: (args.actorName || 'Tr Hein Tay Za').trim().slice(0, 120),
    targetTab: (args.targetTab || '').slice(0, 40),
    readByAdmin: true,
    createdAt: serverTimestamp(),
  });
}
