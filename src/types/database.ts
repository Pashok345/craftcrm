export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';

export type UserPosition = 'director' | 'manager' | 'developer' | 'designer' | 'analyst' | 'accountant' | 'hr' | 'other';

export const POSITION_LABELS: Record<UserPosition, string> = {
  director: 'Директор',
  manager: 'Менеджер',
  developer: 'Разработчик',
  designer: 'Дизайнер',
  analyst: 'Аналитик',
  accountant: 'Бухгалтер',
  hr: 'HR',
  other: 'Другое',
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'К выполнению',
  in_progress: 'В работе',
  review: 'На проверке',
  done: 'Выполнено',
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: 'bg-muted text-muted-foreground',
  in_progress: 'bg-crm-warning/10 text-crm-warning',
  review: 'bg-primary/10 text-primary',
  done: 'bg-crm-success/10 text-crm-success',
};

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  position?: UserPosition;
  additional_info?: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  deadline?: string;
  status: TaskStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TaskAssignee {
  id: string;
  task_id: string;
  user_id: string;
  role: 'executor' | 'observer';
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  comment_id?: string;
  file_name: string;
  file_url: string;
  file_type?: string;
  uploaded_by: string;
  created_at: string;
}

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  meeting_date: string;
  start_time: string;
  end_time?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MeetingParticipant {
  id: string;
  meeting_id: string;
  user_id: string;
  created_at: string;
}
