export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
  notes?: string;
  avatar_color?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DealStage {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  created_by: string;
  created_at: string;
}

export interface Deal {
  id: string;
  title: string;
  amount?: number;
  client_id?: string;
  stage_id: string;
  probability?: number;
  expected_close_date?: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  client?: Client;
  stage?: DealStage;
}

export interface Proposal {
  id: string;
  title: string;
  client_id?: string;
  deal_id?: string;
  content: ProposalItem[];
  total_amount?: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  valid_until?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  client?: Client;
  deal?: Deal;
}

export interface ProposalItem {
  name: string;
  description?: string;
  quantity: number;
  price: number;
}

export interface ClientInteraction {
  id: string;
  client_id: string;
  type: 'call' | 'email' | 'meeting' | 'note';
  description: string;
  created_by: string;
  created_at: string;
}

export const INTERACTION_TYPES = {
  call: { label: 'Звонок', icon: 'Phone' },
  email: { label: 'Email', icon: 'Mail' },
  meeting: { label: 'Встреча', icon: 'Users' },
  note: { label: 'Заметка', icon: 'FileText' },
} as const;

export const PROPOSAL_STATUS_LABELS = {
  draft: 'Черновик',
  sent: 'Отправлено',
  accepted: 'Принято',
  rejected: 'Отклонено',
} as const;

export const PROPOSAL_STATUS_COLORS = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-primary/10 text-primary',
  accepted: 'bg-crm-success/10 text-crm-success',
  rejected: 'bg-destructive/10 text-destructive',
} as const;
