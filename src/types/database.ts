export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';

export type UserPosition = 'director' | 'manager' | 'developer' | 'designer' | 'analyst' | 'accountant' | 'hr' | 'other';

export type AppRole = 'admin' | 'user';

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';

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

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Планирование',
  active: 'Активный',
  on_hold: 'Приостановлен',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  planning: 'bg-muted text-muted-foreground',
  active: 'bg-crm-success/10 text-crm-success',
  on_hold: 'bg-crm-warning/10 text-crm-warning',
  completed: 'bg-primary/10 text-primary',
  cancelled: 'bg-destructive/10 text-destructive',
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

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface TaskLink {
  title: string;
  url: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  deadline?: string;
  status: TaskStatus;
  project_id?: string;
  color?: string;
  links?: TaskLink[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  task_id?: string;
  is_read: boolean;
  created_at: string;
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

export interface Project {
  id: string;
  title: string;
  description?: string;
  status: ProjectStatus;
  manager_id?: string;
  budget?: number;
  start_date?: string;
  end_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChatGroup {
  id: string;
  name: string;
  description?: string;
  type: 'group' | 'direct' | 'task';
  task_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMember {
  id: string;
  chat_id: string;
  user_id: string;
  role: 'admin' | 'member';
  last_read_at?: string;
  created_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  user_id: string;
  content: string;
  reply_to_id?: string;
  created_at: string;
  updated_at: string;
}
