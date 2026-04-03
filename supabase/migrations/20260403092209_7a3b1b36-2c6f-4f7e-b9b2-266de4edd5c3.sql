
-- Fix client_interactions: restrict SELECT to owner or admin
DROP POLICY IF EXISTS "Users can view own or admin interactions" ON public.client_interactions;
CREATE POLICY "Users can view own or admin interactions" ON public.client_interactions
  FOR SELECT TO authenticated
  USING (
    auth.uid() = created_by
    OR EXISTS (SELECT 1 FROM public.clients WHERE clients.id = client_interactions.client_id AND clients.created_by = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Fix proposals: restrict SELECT to owner or admin
DROP POLICY IF EXISTS "Owners or admins can view proposals" ON public.proposals;
CREATE POLICY "Owners or admins can view proposals" ON public.proposals
  FOR SELECT TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));

-- Fix proposal_attachments: restrict SELECT to proposal owner or admin
DROP POLICY IF EXISTS "Proposal owners or admins can view attachments" ON public.proposal_attachments;
CREATE POLICY "Proposal owners or admins can view attachments" ON public.proposal_attachments
  FOR SELECT TO authenticated
  USING (
    auth.uid() = uploaded_by
    OR EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = proposal_attachments.proposal_id AND proposals.created_by = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Fix time_entries: restrict SELECT to owner, task assignees, or admin
DROP POLICY IF EXISTS "Users can view own or related time entries" ON public.time_entries;
CREATE POLICY "Users can view own or related time entries" ON public.time_entries
  FOR SELECT TO authenticated
  USING (
    auth.uid()::text = user_id
    OR EXISTS (SELECT 1 FROM public.task_assignees WHERE task_assignees.task_id = time_entries.task_id AND task_assignees.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.tasks t JOIN public.project_members pm ON pm.project_id = t.project_id WHERE t.id = time_entries.task_id AND pm.user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );
