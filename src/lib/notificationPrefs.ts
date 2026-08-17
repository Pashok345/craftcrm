export const NOTIFICATION_TYPES = [
  'task_assigned',
  'comment',
  'mention',
  'deadline',
  'meeting',
  'message',
  'process',
  'status_change',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABEL_KEYS: Record<string, string> = {
  task_assigned: 'notifTypeTaskAssigned',
  comment: 'notifTypeComment',
  mention: 'notifTypeMention',
  deadline: 'notifTypeDeadline',
  meeting: 'notifTypeMeeting',
  message: 'notifTypeMessage',
  process: 'notifTypeProcess',
  status_change: 'notifTypeStatusChange',
};

const key = (type: string) => `notify-type:${type}`;

export const isTypeEnabled = (type: string) => localStorage.getItem(key(type)) !== 'false';

export const setTypeEnabled = (type: string, enabled: boolean) =>
  localStorage.setItem(key(type), String(enabled));

export const getMutedTypes = (): string[] =>
  NOTIFICATION_TYPES.filter((tpe) => !isTypeEnabled(tpe));
