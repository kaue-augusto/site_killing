-- Enum para tipos de role (não inclui bot no enum, pois será dinâmico)
CREATE TYPE public.app_role AS ENUM ('admin', 'supervisor', 'atendente', 'visualizador');

-- Tabela de bots dinâmicos
CREATE TABLE public.bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'MessageSquare',
  color TEXT DEFAULT 'blue',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabela de perfis de usuário
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de roles (separada para segurança)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  bot_id UUID REFERENCES public.bots(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role, bot_id)
);

-- Tabela de convites pendentes
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role app_role NOT NULL,
  bot_ids UUID[] DEFAULT '{}',
  invited_by UUID REFERENCES auth.users(id) NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de status WhatsApp por bot
CREATE TABLE public.whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES public.bots(id) ON DELETE CASCADE NOT NULL UNIQUE,
  connected BOOLEAN DEFAULT false,
  phone_number TEXT,
  connected_by UUID REFERENCES auth.users(id),
  connected_at TIMESTAMP WITH TIME ZONE,
  last_activity TIMESTAMP WITH TIME ZONE
);

-- Tabela de log de conexões WhatsApp
CREATE TABLE public.whatsapp_connection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES public.bots(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_connection_logs ENABLE ROW LEVEL SECURITY;

-- Função para verificar se usuário é admin (Security Definer)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
    AND role = 'admin'
    AND bot_id IS NULL
  )
$$;

-- Função para verificar se usuário tem role específico
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Função para verificar acesso a bot específico
CREATE OR REPLACE FUNCTION public.can_access_bot(_user_id UUID, _bot_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND (
      (role = 'admin' AND bot_id IS NULL)
      OR bot_id = _bot_id
    )
  )
$$;

-- Políticas RLS para bots (todos autenticados podem ler bots ativos)
CREATE POLICY "Authenticated users can view active bots"
  ON public.bots FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage bots"
  ON public.bots FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Políticas RLS para profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Políticas RLS para user_roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Políticas RLS para invites
CREATE POLICY "Admins can manage invites"
  ON public.invites FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Anyone can view invite by token"
  ON public.invites FOR SELECT
  TO anon, authenticated
  USING (true);

-- Políticas RLS para whatsapp_connections
CREATE POLICY "Admins can view all whatsapp connections"
  ON public.whatsapp_connections FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view whatsapp connections for their bots"
  ON public.whatsapp_connections FOR SELECT
  TO authenticated
  USING (public.can_access_bot(auth.uid(), bot_id));

CREATE POLICY "Admins can manage whatsapp connections"
  ON public.whatsapp_connections FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Políticas RLS para whatsapp_connection_logs
CREATE POLICY "Admins can view connection logs"
  ON public.whatsapp_connection_logs FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert connection logs"
  ON public.whatsapp_connection_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- Trigger para criar profile automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir bots iniciais
INSERT INTO public.bots (slug, name, description, icon, color) VALUES
  ('rh', 'RH', 'Atendimento de recursos humanos', 'Users', 'blue'),
  ('sac', 'SAC', 'Serviço de atendimento ao cliente', 'Headphones', 'green'),
  ('comercial', 'Comercial', 'Vendas e propostas comerciais', 'ShoppingCart', 'purple');