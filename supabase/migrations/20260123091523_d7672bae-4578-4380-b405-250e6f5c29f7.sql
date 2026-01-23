-- Fix security issues for profiles and project_members tables

-- 1. Drop the overly permissive policy on profiles that allows all authenticated users to see all profiles
DROP POLICY IF EXISTS "Require authentication to view profiles" ON public.profiles;

-- 2. Update project_members to only allow members of the project to see project membership
DROP POLICY IF EXISTS "Authenticated users can view project members" ON public.project_members;

-- Create new restricted policy: users can only see project members for projects they belong to
CREATE POLICY "Project members can view their project members"
ON public.project_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = project_members.project_id
    AND pm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_members.project_id
    AND (p.created_by = auth.uid() OR p.manager_id = auth.uid() OR p.reviewer_id = auth.uid())
  )
);