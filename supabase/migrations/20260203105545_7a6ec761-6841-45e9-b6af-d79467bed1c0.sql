-- Таблица клиентов
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  position TEXT,
  notes TEXT,
  avatar_color TEXT DEFAULT '#3B82F6',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Этапы воронки продаж
CREATE TABLE public.deal_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Сделки
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  amount NUMERIC(15, 2),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  stage_id UUID NOT NULL REFERENCES public.deal_stages(id) ON DELETE CASCADE,
  probability INTEGER DEFAULT 50,
  expected_close_date DATE,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Коммерческие предложения
CREATE TABLE public.proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  content JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC(15, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  valid_until DATE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- История взаимодействий с клиентами
CREATE TABLE public.client_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_interactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies для clients
CREATE POLICY "Authenticated users can view all clients" 
ON public.clients FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create clients" 
ON public.clients FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update clients" 
ON public.clients FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete clients" 
ON public.clients FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS Policies для deal_stages
CREATE POLICY "Authenticated users can view all stages" 
ON public.deal_stages FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create stages" 
ON public.deal_stages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update stages" 
ON public.deal_stages FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete stages" 
ON public.deal_stages FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS Policies для deals
CREATE POLICY "Authenticated users can view all deals" 
ON public.deals FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create deals" 
ON public.deals FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update deals" 
ON public.deals FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete deals" 
ON public.deals FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS Policies для proposals
CREATE POLICY "Authenticated users can view all proposals" 
ON public.proposals FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create proposals" 
ON public.proposals FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update proposals" 
ON public.proposals FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete proposals" 
ON public.proposals FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS Policies для client_interactions
CREATE POLICY "Authenticated users can view all interactions" 
ON public.client_interactions FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create interactions" 
ON public.client_interactions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Триггеры для обновления updated_at
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deals_updated_at
BEFORE UPDATE ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_proposals_updated_at
BEFORE UPDATE ON public.proposals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Вставка стандартных этапов воронки
INSERT INTO public.deal_stages (name, color, sort_order, created_by) VALUES
('Новый лид', '#94A3B8', 0, '00000000-0000-0000-0000-000000000000'),
('Квалификация', '#3B82F6', 1, '00000000-0000-0000-0000-000000000000'),
('Предложение', '#F59E0B', 2, '00000000-0000-0000-0000-000000000000'),
('Переговоры', '#8B5CF6', 3, '00000000-0000-0000-0000-000000000000'),
('Закрыто (выиграно)', '#22C55E', 4, '00000000-0000-0000-0000-000000000000'),
('Закрыто (проиграно)', '#EF4444', 5, '00000000-0000-0000-0000-000000000000');