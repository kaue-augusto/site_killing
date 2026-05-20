-- Criar tabela crm_leads com campos básicos + campos B2B
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,

  -- Campos básicos (usados pelo CRM atual)
  contact_name TEXT,
  contact_phone TEXT,
  status TEXT DEFAULT 'triagem' CHECK (status IN ('triagem', 'qualificado', 'negociacao', 'ganho', 'perdido')),
  score INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  summary TEXT,
  last_interaction TIMESTAMP WITH TIME ZONE,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- Campos B2B (importação CSV/XLSX)
  rank_score INTEGER,
  tier TEXT CHECK (tier IN ('A', 'B', 'C')),
  cnpj TEXT,
  razao_social TEXT,
  nome_fantasia TEXT,
  decisor TEXT,
  faturamento TEXT,
  num_funcionarios TEXT,
  capital_social DECIMAL,
  porte TEXT,
  regime TEXT,
  uf TEXT,
  municipio TEXT,
  bairro TEXT,
  endereco TEXT,
  cep TEXT,
  whatsapp TEXT,
  telefone TEXT,
  site TEXT,
  instagram TEXT,
  linkedin TEXT,
  cnae TEXT,
  tipo_empresa TEXT,
  idade_empresa TEXT,
  chance_contato TEXT,
  tem_wpp BOOLEAN DEFAULT false,
  tem_email BOOLEAN DEFAULT false,
  tem_site BOOLEAN DEFAULT false,

  -- Campos de controle comercial
  temperatura TEXT DEFAULT 'frio' CHECK (temperatura IN ('quente', 'morno', 'frio')),
  origem TEXT,
  tentativas_contato INTEGER DEFAULT 0,
  proxima_acao_em TIMESTAMP WITH TIME ZONE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_crm_leads_bot_id ON public.crm_leads(bot_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON public.crm_leads(status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_cnpj ON public.crm_leads(cnpj);

-- RLS
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage crm_leads for their bots"
  ON public.crm_leads FOR ALL
  TO authenticated
  USING (public.can_access_bot(auth.uid(), bot_id))
  WITH CHECK (public.can_access_bot(auth.uid(), bot_id));
