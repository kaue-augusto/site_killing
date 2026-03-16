-- Atribuir role de admin ao primeiro usuário registrado (se ainda não tiver)
INSERT INTO public.user_roles (user_id, role, bot_id, assigned_by)
SELECT p.id, 'admin', NULL, p.id
FROM public.profiles p
ORDER BY p.created_at ASC
LIMIT 1
ON CONFLICT DO NOTHING;