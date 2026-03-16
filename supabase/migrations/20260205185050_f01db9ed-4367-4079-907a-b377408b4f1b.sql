-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view invite by token" ON public.invites;

-- Create a SECURITY DEFINER function to safely get invite by token
CREATE OR REPLACE FUNCTION public.get_invite_by_token(_token text)
RETURNS TABLE (
  id uuid,
  email text,
  role app_role,
  bot_ids uuid[],
  token text,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz,
  invited_by uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, email, role, bot_ids, token, expires_at, accepted_at, created_at, invited_by
  FROM public.invites
  WHERE invites.token = _token
    AND accepted_at IS NULL
    AND expires_at > now()
$$;

-- Add UPDATE policy - only allow updating accepted_at for the invite matching user's email
CREATE POLICY "Users can accept their own invites"
ON public.invites
FOR UPDATE
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
)
WITH CHECK (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Add DELETE policy - only admins can delete invites
CREATE POLICY "Admins can delete invites"
ON public.invites
FOR DELETE
USING (is_admin(auth.uid()));