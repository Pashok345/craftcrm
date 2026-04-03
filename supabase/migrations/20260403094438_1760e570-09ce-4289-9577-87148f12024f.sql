-- Remove old permissive SELECT policies that override the restricted ones

-- client_interactions: remove old broad policy, keep restricted one
DROP POLICY IF EXISTS "Authenticated users can view all interactions" ON public.client_interactions;

-- proposals: remove old broad policy, keep restricted one
DROP POLICY IF EXISTS "Authenticated users can view all proposals" ON public.proposals;

-- proposal_attachments: remove old broad policy, keep restricted one
DROP POLICY IF EXISTS "Authenticated users can view proposal attachments" ON public.proposal_attachments;