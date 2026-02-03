-- Fix 1: Departments - require authentication for SELECT
DROP POLICY IF EXISTS "Anyone can view departments" ON public.departments;
CREATE POLICY "Authenticated users can view departments"
  ON public.departments FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Fix 2: Profiles - restrict full profile access to owner, admins, or task/project collaborators
-- The public_profiles view already exists to expose non-sensitive data
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- Users can see their own full profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view profiles of people they share tasks with (as assignees)
CREATE POLICY "Users can view profiles of task collaborators"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.task_assignees ta1
      JOIN public.task_assignees ta2 ON ta1.task_id = ta2.task_id
      WHERE ta1.user_id = auth.uid()
        AND ta2.user_id = profiles.user_id
    )
  );

-- Users can view profiles of project members they share projects with
CREATE POLICY "Users can view profiles of project collaborators"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm1
      JOIN public.project_members pm2 ON pm1.project_id = pm2.project_id
      WHERE pm1.user_id = auth.uid()
        AND pm2.user_id = profiles.user_id
    )
  );

-- Fix 3: Tasks - restrict visibility to creators, assignees, project members, and admins
DROP POLICY IF EXISTS "Authenticated users can view all tasks" ON public.tasks;

-- Task creators can view their tasks
CREATE POLICY "Task creators can view their tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() = created_by);

-- Admins can view all tasks
CREATE POLICY "Admins can view all tasks"
  ON public.tasks FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Task assignees can view assigned tasks
CREATE POLICY "Assignees can view their tasks"
  ON public.tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.task_assignees
      WHERE task_id = tasks.id
        AND user_id = auth.uid()
    )
  );

-- Project members can view project tasks
CREATE POLICY "Project members can view project tasks"
  ON public.tasks FOR SELECT
  USING (
    project_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = tasks.project_id
        AND user_id = auth.uid()
    )
  );