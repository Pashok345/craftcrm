
-- Stage 1: Process categories + templates

CREATE TABLE public.process_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  icon TEXT DEFAULT 'Folder',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.process_categories TO authenticated;
GRANT ALL ON public.process_categories TO service_role;
ALTER TABLE public.process_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select_all_auth" ON public.process_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories_insert_admin" ON public.process_categories
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "categories_update_admin" ON public.process_categories
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "categories_delete_admin" ON public.process_categories
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_process_categories_updated_at
  BEFORE UPDATE ON public.process_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add category_id to processes
ALTER TABLE public.processes ADD COLUMN category_id UUID REFERENCES public.process_categories(id) ON DELETE SET NULL;

-- Templates
CREATE TABLE public.process_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.process_categories(id) ON DELETE SET NULL,
  icon TEXT DEFAULT 'FileText',
  is_system BOOLEAN NOT NULL DEFAULT false,
  template_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.process_templates TO authenticated;
GRANT ALL ON public.process_templates TO service_role;
ALTER TABLE public.process_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_select_all_auth" ON public.process_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "templates_insert_auth" ON public.process_templates
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND is_system = false);
CREATE POLICY "templates_update_owner_or_admin" ON public.process_templates
  FOR UPDATE TO authenticated
  USING ((auth.uid() = created_by AND is_system = false) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((auth.uid() = created_by AND is_system = false) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "templates_delete_owner_or_admin" ON public.process_templates
  FOR DELETE TO authenticated
  USING ((auth.uid() = created_by AND is_system = false) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_process_templates_updated_at
  BEFORE UPDATE ON public.process_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed system templates
INSERT INTO public.process_templates (name, description, icon, is_system, template_data) VALUES
('Відпустка', 'Заявка на щорічну відпустку з погодженням керівника', 'Palmtree', true,
 '{"fields":[{"name":"Дата початку","field_type":"text"},{"name":"Дата завершення","field_type":"text"},{"name":"Причина","field_type":"textarea"}]}'::jsonb),
('Оплата рахунку', 'Запит на оплату рахунку постачальнику', 'CreditCard', true,
 '{"fields":[{"name":"Постачальник","field_type":"text"},{"name":"Сума","field_type":"text"},{"name":"Призначення платежу","field_type":"textarea"},{"name":"Номер рахунку","field_type":"text"}]}'::jsonb),
('Погодження договору', 'Погодження договору з контрагентом', 'FileSignature', true,
 '{"fields":[{"name":"Контрагент","field_type":"text"},{"name":"Тип договору","field_type":"select","options":["Постачання","Послуги","Оренда","Інше"]},{"name":"Сума","field_type":"text"},{"name":"Коментар","field_type":"textarea"}]}'::jsonb),
('Відрядження', 'Заявка на відрядження', 'Plane', true,
 '{"fields":[{"name":"Місто","field_type":"text"},{"name":"Дата виїзду","field_type":"text"},{"name":"Дата повернення","field_type":"text"},{"name":"Мета","field_type":"textarea"}]}'::jsonb),
('Прийом на роботу', 'Онбординг нового співробітника', 'UserPlus', true,
 '{"fields":[{"name":"ПІБ","field_type":"text"},{"name":"Посада","field_type":"text"},{"name":"Відділ","field_type":"text"},{"name":"Дата виходу","field_type":"text"}]}'::jsonb);
