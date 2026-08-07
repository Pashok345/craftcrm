CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL,
  title text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'UAH',
  status text NOT NULL DEFAULT 'draft',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners or admins can view invoices" ON public.invoices FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Owners can create invoices" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owners or admins can update invoices" ON public.invoices FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Owners or admins can delete invoices" ON public.invoices FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_invoices_created_by ON public.invoices(created_by);
CREATE INDEX idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.can_access_invoice(_invoice_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = _invoice_id
      AND (i.created_by = _user_id OR public.has_role(_user_id, 'admin'::public.app_role))
  );
$$;

CREATE TABLE public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  paid_at date NOT NULL DEFAULT CURRENT_DATE,
  method text,
  note text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_payments TO authenticated;
GRANT ALL ON public.invoice_payments TO service_role;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invoice participants can view payments" ON public.invoice_payments FOR SELECT TO authenticated
  USING (public.can_access_invoice(invoice_id, auth.uid()));
CREATE POLICY "Invoice participants can add payments" ON public.invoice_payments FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.can_access_invoice(invoice_id, auth.uid()));
CREATE POLICY "Owners or admins can update payments" ON public.invoice_payments FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Owners or admins can delete payments" ON public.invoice_payments FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_invoice_payments_invoice_id ON public.invoice_payments(invoice_id);

CREATE TABLE public.document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  doc_type text NOT NULL DEFAULT 'invoice',
  company jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_templates TO authenticated;
GRANT ALL ON public.document_templates TO service_role;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners or admins can view templates" ON public.document_templates FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Owners can create templates" ON public.document_templates FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owners or admins can update templates" ON public.document_templates FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Owners or admins can delete templates" ON public.document_templates FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_document_templates_updated_at BEFORE UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();