import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import {
  Search, Bot, Phone, CheckCircle2, XCircle, Clock, Sparkles,
  LayoutGrid, List, Calendar, LineChart, Mail, Activity, Share2,
  MessageSquare, UserCircle, Send, Plus, ChevronLeft, ChevronRight,
  Filter, ArrowUpDown, Trash2, Loader2, Upload, Pencil, Save, Trophy
} from 'lucide-react';
import { useBot } from '@/contexts/BotContext';
import { useAuth } from '@/contexts/AuthContext';
import { ImportLeadsModal } from '@/components/crm/ImportLeadsModal';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '@/integrations/supabase/client';

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return 'Nunca';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Agora';
  if (mins < 60) return `${mins} min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Ontem';
  return `${days} dias atrás`;
}

type LeadStatus = 'triagem' | 'qualificado' | 'negociacao' | 'ganho' | 'perdido';

// ── Filtros ──────────────────────────────────────────────────
interface FilterField { key: string; label: string; type: 'text'|'select'|'number'|'boolean'|'date'; options?: string[]; }
const FILTER_FIELDS: FilterField[] = [
  { key: 'razaoSocial',     label: 'Razão Social',       type: 'text' },
  { key: 'cnpj',            label: 'CNPJ',               type: 'text' },
  { key: 'decisor',         label: 'Decisor',            type: 'text' },
  { key: 'tier',            label: 'Tier',               type: 'select', options: ['A','B','C'] },
  { key: 'temperatura',     label: 'Temperatura',        type: 'select', options: ['quente','morno','frio'] },
  { key: 'uf',              label: 'UF',                 type: 'text' },
  { key: 'municipio',       label: 'Município',          type: 'text' },
  { key: 'faturamento',     label: 'Faturamento',        type: 'text' },
  { key: 'numFuncionarios', label: 'Funcionários',       type: 'text' },
  { key: 'chanceContato',   label: 'Chance de Contato', type: 'select', options: ['Alta','Regular','Baixa'] },
  { key: 'temWpp',          label: 'Tem WhatsApp',       type: 'boolean' },
  { key: 'temEmail',        label: 'Tem Email',          type: 'boolean' },
  { key: 'temSite',         label: 'Tem Site',           type: 'boolean' },
  { key: 'score',           label: 'Score',              type: 'number' },
  { key: 'status',          label: 'Estágio',            type: 'select', options: ['triagem','qualificado','negociacao','ganho','perdido'] },
  { key: 'origem',          label: 'Origem',             type: 'text' },
  { key: 'createdAt',       label: 'Data de Criação',    type: 'date' },
];

const OPERATORS_BY_TYPE: Record<string, {val:string;label:string}[]> = {
  text:    [{val:'contains',label:'Contém'},{val:'not_contains',label:'Não contém'},{val:'equals',label:'Igual a'},{val:'not_equals',label:'Não é igual a'},{val:'blank',label:'Está em branco'},{val:'not_blank',label:'Não está em branco'}],
  select:  [{val:'equals',label:'Igual a'},{val:'not_equals',label:'Não é igual a'},{val:'blank',label:'Está em branco'},{val:'not_blank',label:'Não está em branco'}],
  number:  [{val:'equals',label:'Igual a'},{val:'greater',label:'Maior que'},{val:'less',label:'Menor que'},{val:'gte',label:'Maior ou igual'},{val:'lte',label:'Menor ou igual'},{val:'not_equals',label:'Não é igual a'}],
  boolean: [{val:'true',label:'É verdadeiro'},{val:'false',label:'É falso'}],
  date:    [{val:'equals',label:'Igual a'},{val:'before',label:'Antes de'},{val:'after',label:'Depois de'},{val:'on_or_after',label:'Igual a ou depois'},{val:'on_or_before',label:'Igual a ou antes'},{val:'not_equals',label:'Não é igual a'},{val:'blank',label:'Está em branco'},{val:'not_blank',label:'Não está em branco'}],
};

export interface FilterCondition { id: string; field: string; operator: string; value: string; }

const DATE_PRESETS = [
  { val: 'last_7',          label: 'Últimos 7 dias' },
  { val: 'next_7',          label: 'Próximos 7 dias' },
  { val: 'this_week',       label: 'Esta Semana' },
  { val: 'last_week',       label: 'Semana passada' },
  { val: 'next_week',       label: 'Próxima semana' },
  { val: 'this_month',      label: 'Este mês' },
  { val: 'last_month',      label: 'Mês passado' },
  { val: 'next_month',      label: 'Próximo mês' },
  { val: 'this_quarter',    label: 'Este trimestre' },
  { val: 'last_quarter',    label: 'Trimestre passado' },
  { val: 'next_quarter',    label: 'Próximo trimestre' },
  { val: 'this_year',       label: 'Este ano' },
  { val: 'last_year',       label: 'Ano passado' },
  { val: 'next_year',       label: 'Próximo ano' },
  { val: 'until_yesterday', label: 'Até ontem' },
  { val: 'until_today',     label: 'Até hoje' },
  { val: 'until_tomorrow',  label: 'Até amanhã' },
];
const DATE_PRESET_KEYS = new Set(DATE_PRESETS.map(p => p.val));

function resolveDatePreset(preset: string): { start: Date; end: Date } | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 864e5);
  const yesterday = new Date(today.getTime() - 864e5);
  const wkStart = (d: Date) => new Date(d.getTime() - d.getDay() * 864e5);
  const qStart  = (d: Date) => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
  switch (preset) {
    case 'last_7':          return { start: new Date(today.getTime() - 7*864e5), end: tomorrow };
    case 'next_7':          return { start: today, end: new Date(today.getTime() + 8*864e5) };
    case 'this_week':     { const s = wkStart(today); return { start: s, end: new Date(s.getTime() + 7*864e5) }; }
    case 'last_week':     { const s = new Date(wkStart(today).getTime() - 7*864e5); return { start: s, end: wkStart(today) }; }
    case 'next_week':     { const s = new Date(wkStart(today).getTime() + 7*864e5); return { start: s, end: new Date(s.getTime() + 7*864e5) }; }
    case 'this_month':      return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: new Date(today.getFullYear(), today.getMonth()+1, 1) };
    case 'last_month':      return { start: new Date(today.getFullYear(), today.getMonth()-1, 1), end: new Date(today.getFullYear(), today.getMonth(), 1) };
    case 'next_month':      return { start: new Date(today.getFullYear(), today.getMonth()+1, 1), end: new Date(today.getFullYear(), today.getMonth()+2, 1) };
    case 'this_quarter':  { const s = qStart(today); return { start: s, end: new Date(s.getFullYear(), s.getMonth()+3, 1) }; }
    case 'last_quarter':  { const s = qStart(today); const p = new Date(s.getFullYear(), s.getMonth()-3, 1); return { start: p, end: s }; }
    case 'next_quarter':  { const s = qStart(today); const n = new Date(s.getFullYear(), s.getMonth()+3, 1); return { start: n, end: new Date(s.getFullYear(), s.getMonth()+6, 1) }; }
    case 'this_year':       return { start: new Date(today.getFullYear(), 0, 1), end: new Date(today.getFullYear()+1, 0, 1) };
    case 'last_year':       return { start: new Date(today.getFullYear()-1, 0, 1), end: new Date(today.getFullYear(), 0, 1) };
    case 'next_year':       return { start: new Date(today.getFullYear()+1, 0, 1), end: new Date(today.getFullYear()+2, 0, 1) };
    case 'until_yesterday': return { start: new Date(0), end: yesterday };
    case 'until_today':     return { start: new Date(0), end: tomorrow };
    case 'until_tomorrow':  return { start: new Date(0), end: new Date(tomorrow.getTime() + 864e5) };
    default: return null;
  }
}

function evalFilter(lead: Record<string,any>, f: FilterCondition): boolean {
  const raw = lead[f.field];
  const v = String(raw ?? '');
  const fv = f.value;
  if (DATE_PRESET_KEYS.has(fv) && !['blank','not_blank'].includes(f.operator)) {
    const range = resolveDatePreset(fv);
    if (range) {
      const d = new Date(v);
      switch(f.operator) {
        case 'equals':       return d >= range.start && d < range.end;
        case 'not_equals':   return d < range.start || d >= range.end;
        case 'before':       return d < range.start;
        case 'after':        return d >= range.end;
        case 'on_or_after':  return d >= range.start;
        case 'on_or_before': return d < range.end;
        default:             return d >= range.start && d < range.end;
      }
    }
  }
  switch(f.operator) {
    case 'contains':     return v.toLowerCase().includes(fv.toLowerCase());
    case 'not_contains': return !v.toLowerCase().includes(fv.toLowerCase());
    case 'equals':       return v.toLowerCase() === fv.toLowerCase();
    case 'not_equals':   return v.toLowerCase() !== fv.toLowerCase();
    case 'blank':        return !raw || v === '';
    case 'not_blank':    return Boolean(raw) && v !== '';
    case 'greater':      return Number(raw) > Number(fv);
    case 'less':         return Number(raw) < Number(fv);
    case 'gte':          return Number(raw) >= Number(fv);
    case 'lte':          return Number(raw) <= Number(fv);
    case 'before':       return new Date(v) < new Date(fv);
    case 'after':        return new Date(v) > new Date(fv);
    case 'on_or_after':  return new Date(v) >= new Date(fv);
    case 'on_or_before': return new Date(v) <= new Date(fv);
    case 'true':         return Boolean(raw);
    case 'false':        return !Boolean(raw);
    default:             return true;
  }
}

// ── Visualizações salvas ─────────────────────────────────────
interface SavedView { id:string; name:string; filters:FilterCondition[]; sortField:string; sortDir:'asc'|'desc'; visibleFields:string[]; }
const VIEWS_KEY = 'crm_saved_views_v1';

interface ActivityLog {
  id: string;
  type: 'move' | 'comment' | 'system';
  content: string;
  author: string;
  timestamp: string;
}

interface Lead {
  id: string;
  name: string;
  phone: string;
  status: LeadStatus;
  score: number;
  tags: string[];
  summary: string;
  lastInteraction: string;
  lastInteractionRaw: string;
  createdAt: string;
  email?: string;
  activities: ActivityLog[];
  // Campos B2B
  razaoSocial?: string;
  nomeFantasia?: string;
  decisor?: string;
  cnpj?: string;
  tier?: string;
  temperatura?: string;
  faturamento?: string;
  numFuncionarios?: string;
  uf?: string;
  municipio?: string;
  bairro?: string;
  endereco?: string;
  cep?: string;
  whatsapp?: string;
  telefone?: string;
  site?: string;
  instagram?: string;
  linkedin?: string;
  cnae?: string;
  porte?: string;
  regime?: string;
  temWpp?: boolean;
  temEmail?: boolean;
  temSite?: boolean;
  chanceContato?: string;
  origem?: string;
  rankScore?: number;
}

const VALID_STATUSES: LeadStatus[] = ['triagem', 'qualificado', 'negociacao', 'ganho', 'perdido'];

function mapDbToLead(row: any): Lead {
  return {
    id: row.id,
    name: row.razao_social || row.contact_name || row.decisor || 'Sem nome',
    phone: row.whatsapp || row.contact_phone || row.telefone || '',
    status: VALID_STATUSES.includes(row.status) ? row.status : 'triagem',
    score: row.score ?? 0,
    tags: Array.isArray(row.tags) ? row.tags : [],
    summary: row.summary || '',
    lastInteraction: formatRelativeTime(row.last_interaction),
    lastInteractionRaw: row.last_interaction || new Date(row.created_at || Date.now()).toISOString(),
    createdAt: row.created_at || new Date().toISOString(),
    email: row.email || '',
    activities: [],
    razaoSocial: row.razao_social || '',
    nomeFantasia: row.nome_fantasia || '',
    decisor: row.decisor || '',
    cnpj: row.cnpj || '',
    tier: row.tier || '',
    temperatura: row.temperatura || 'frio',
    faturamento: row.faturamento || '',
    numFuncionarios: row.num_funcionarios || '',
    uf: row.uf || '',
    municipio: row.municipio || '',
    bairro: row.bairro || '',
    endereco: row.endereco || '',
    cep: row.cep || '',
    whatsapp: row.whatsapp || '',
    telefone: row.telefone || '',
    site: row.site || '',
    instagram: row.instagram || '',
    linkedin: row.linkedin || '',
    cnae: row.cnae || '',
    porte: row.porte || '',
    regime: row.regime || '',
    temWpp: Boolean(row.tem_wpp),
    temEmail: Boolean(row.tem_email),
    temSite: Boolean(row.tem_site),
    chanceContato: row.chance_contato || '',
    origem: row.origem || '',
    rankScore: row.rank_score ?? 0,
  };
}

const COLUMNS: { id: LeadStatus, title: string, color: string, bg: string, icon: any }[] = [
  { id: 'triagem', title: 'Triagem IA', color: 'border-blue-500/50', bg: 'bg-blue-500/10', icon: Bot },
  { id: 'qualificado', title: 'Qualificados', color: 'border-orange-500/50', bg: 'bg-orange-500/10', icon: Sparkles },
  { id: 'negociacao', title: 'Em Negociação', color: 'border-purple-500/50', bg: 'bg-purple-500/10', icon: Clock },
  { id: 'ganho', title: 'Ganho', color: 'border-green-500/50', bg: 'bg-green-500/10', icon: CheckCircle2 },
  { id: 'perdido', title: 'Perdido', color: 'border-red-500/50', bg: 'bg-red-500/10', icon: XCircle },
];

const AVAILABLE_TAGS = [
  'VIP',
  'Urgente',
  'Dúvida Novo Produto',
  'Reclamação',
  'Parceria',
  'Orçamento Alto',
  'Retorno Agendado',
  'Desconto Solicitado'
];

const COL_PAGE_SIZE = 50;

const ALL_LIST_COLS = [
  { key: 'name',             label: 'Empresa / Nome' },
  { key: 'cnpj',            label: 'CNPJ' },
  { key: 'decisor',         label: 'Decisor' },
  { key: 'tier',            label: 'Tier' },
  { key: 'temperatura',     label: 'Temperatura' },
  { key: 'telefone',        label: 'Telefone' },
  { key: 'email',           label: 'Email' },
  { key: 'status',          label: 'Etapa' },
  { key: 'score',           label: 'Score' },
  { key: 'faturamento',     label: 'Faturamento' },
  { key: 'numFuncionarios', label: 'Funcionários' },
  { key: 'uf',              label: 'UF' },
  { key: 'municipio',       label: 'Município' },
  { key: 'chanceContato',   label: 'Chance Contato' },
  { key: 'tags',            label: 'Tags' },
  { key: 'origem',          label: 'Origem' },
  { key: 'createdAt',       label: 'Data Criação' },
];
const DEFAULT_LIST_COLS = ['name', 'telefone', 'status', 'score', 'tags'];
const LIST_COLS_KEY = 'crm_list_cols_v1';

function InfoField({ label, value, span, mono, green }: { label: string; value: string; span?: number; mono?: boolean; green?: boolean }) {
  return (
    <div className={`bg-secondary/30 px-3 py-2 rounded-lg border border-border ${span === 2 ? 'col-span-2' : ''}`}>
      <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-sm font-medium truncate ${mono ? 'font-mono text-xs' : ''} ${green ? 'text-green-400' : 'text-foreground'}`}>{value || '—'}</p>
    </div>
  );
}

export default function CRM() {
  const { selectedBot } = useBot();
  const { isAdmin, roles } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [colLimits, setColLimits] = useState<Record<string, number>>({});
  const [listLimit, setListLimit] = useState(50);
  const [atividadesLimit, setAtividadesLimit] = useState(50);
  const [rankTier, setRankTier] = useState<string[]>([]);
  const [rankTemp, setRankTemp] = useState<string[]>([]);
  const [rankUF, setRankUF] = useState('');
  const [rankChance, setRankChance] = useState('');
  const [rankLimit, setRankLimit] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isImportOpen, setIsImportOpen] = useState(false);

  // ── Campos visíveis no card ──
  const CRM_FIELDS_KEY = 'crm_card_fields_v1';
  const DEFAULT_FIELDS = ['razaoSocial','tier','temperatura','score','localizacao','faturamento','funcionarios','whatsapp','contatos'];
  const ALL_CARD_FIELDS = [
    { key:'razaoSocial',     label:'Empresa / Nome' },
    { key:'nomeFantasia',    label:'Nome Fantasia' },
    { key:'decisor',         label:'Decisor' },
    { key:'cnpj',            label:'CNPJ' },
    { key:'tier',            label:'Tier (A/B/C)' },
    { key:'temperatura',     label:'Temperatura' },
    { key:'score',           label:'Score' },
    { key:'rankScore',       label:'Rank' },
    { key:'localizacao',     label:'Localização' },
    { key:'bairro',          label:'Bairro' },
    { key:'endereco',        label:'Endereço' },
    { key:'cep',             label:'CEP' },
    { key:'faturamento',     label:'Faturamento' },
    { key:'funcionarios',    label:'Funcionários' },
    { key:'porte',           label:'Porte' },
    { key:'regime',          label:'Regime' },
    { key:'cnae',            label:'CNAE' },
    { key:'chanceContato',   label:'Chance de Contato' },
    { key:'whatsapp',        label:'WhatsApp' },
    { key:'telefone',        label:'Telefone' },
    { key:'email',           label:'Email' },
    { key:'site',            label:'Site' },
    { key:'instagram',       label:'Instagram' },
    { key:'linkedin',        label:'LinkedIn' },
    { key:'origem',          label:'Origem' },
    { key:'contatos',        label:'Ícones (WPP/Email/Site)' },
    { key:'tags',            label:'Tags' },
    { key:'summary',         label:'Resumo' },
  ];
  const [visibleFields, setVisibleFields] = useState<string[]>(() => {
    try { const s = localStorage.getItem(CRM_FIELDS_KEY); return s ? JSON.parse(s) : DEFAULT_FIELDS; }
    catch { return DEFAULT_FIELDS; }
  });
  const toggleCardField = (key: string) => {
    setVisibleFields(prev => {
      const next = prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key];
      localStorage.setItem(CRM_FIELDS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const [listColumns, setListColumns] = useState<string[]>(() => {
    try { const s = localStorage.getItem(LIST_COLS_KEY); return s ? JSON.parse(s) : DEFAULT_LIST_COLS; }
    catch { return DEFAULT_LIST_COLS; }
  });
  const toggleListCol = (key: string) => {
    setListColumns(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      localStorage.setItem(LIST_COLS_KEY, JSON.stringify(next));
      return next;
    });
  };

  // ── Visualizações salvas ──
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    try { const s = localStorage.getItem(VIEWS_KEY); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [showSaveView, setShowSaveView] = useState(false);
  const [viewName, setViewName] = useState('');
  const saveView = () => {
    if (!viewName.trim()) return;
    const view: SavedView = { id: Date.now().toString(), name: viewName.trim(), filters, sortField: sortConfig?.field || '', sortDir: sortConfig?.direction || 'asc', visibleFields };
    const next = [...savedViews, view];
    setSavedViews(next);
    localStorage.setItem(VIEWS_KEY, JSON.stringify(next));
    setViewName(''); setShowSaveView(false);
  };
  const loadView = (v: SavedView) => {
    setFilters(v.filters);
    setSortConfig(v.sortField ? { field: v.sortField, direction: v.sortDir } : null);
    setVisibleFields(v.visibleFields);
    localStorage.setItem(CRM_FIELDS_KEY, JSON.stringify(v.visibleFields));
  };
  const deleteView = (id: string) => {
    const next = savedViews.filter(v => v.id !== id);
    setSavedViews(next);
    localStorage.setItem(VIEWS_KEY, JSON.stringify(next));
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const fetchLeads = useCallback(async () => {
    if (!selectedBot?.id) { setIsLoading(false); return; }
    setIsLoading(true);
    const PAGE = 1000;
    let all: any[] = [];
    let from = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await (supabase as any)
        .from('crm_leads')
        .select('*')
        .eq('bot_id', selectedBot.id)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) { console.error('fetchLeads error:', error); break; }
      if (data && data.length > 0) {
        all = [...all, ...data];
        from += PAGE;
        hasMore = data.length === PAGE;
      } else { hasMore = false; }
    }
    setLeads(all.map(mapDbToLead));
    setIsLoading(false);
  }, [selectedBot?.id]);

  useEffect(() => {
    fetchLeads();
    if (!selectedBot?.id) return;
    const channel = supabase
      .channel(`crm_leads_${selectedBot.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_leads', filter: `bot_id=eq.${selectedBot.id}` }, fetchLeads)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchLeads, selectedBot?.id]);

  // ── Filtros e ordenação ──
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc'|'desc' } | null>(null);

  const addFilter = () => { setFilters(f => [...f, { id: Date.now().toString(), field: 'razaoSocial', operator: 'contains', value: '' }]); setListLimit(50); };
  const removeFilter = (id: string) => { setFilters(f => f.filter(x => x.id !== id)); setListLimit(50); };
  const updateFilter = (id: string, updates: Partial<FilterCondition>) => { setFilters(f => f.map(x => x.id === id ? { ...x, ...updates } : x)); setListLimit(50); };

  useEffect(() => { setListLimit(50); }, [searchTerm, filters]);

  const processedLeads = leads
    .filter(l => {
      const term = searchTerm.toLowerCase();
      const matchSearch = !term ||
        (l.razaoSocial || '').toLowerCase().includes(term) ||
        l.name.toLowerCase().includes(term) ||
        (l.cnpj || '').includes(term) ||
        (l.decisor || '').toLowerCase().includes(term) ||
        (l.municipio || '').toLowerCase().includes(term) ||
        l.phone.includes(term);
      if (!matchSearch) return false;
      if (filters.length === 0) return true;
      return filters.every(f => evalFilter(l as any, f));
    })
    .sort((a, b) => {
      if (!sortConfig) return 0;
      let aVal = a[sortConfig.field as keyof Lead] as any;
      let bVal = b[sortConfig.field as keyof Lead] as any;
      if (sortConfig.field === 'createdAt') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  // Permissão de edição: admin global ou supervisor do bot
  const canEdit = isAdmin || roles.some(r =>
    (r.role === 'admin' || r.role === 'supervisor') &&
    (r.botId === selectedBot?.id || r.botId === null)
  );

  // States Modal (Sheet)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [newTag, setNewTag] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<Lead | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const startEdit = () => { if (selectedLead) { setEditDraft({ ...selectedLead }); setIsEditing(true); } };
  const cancelEdit = () => { setIsEditing(false); setEditDraft(null); };

  const setDraft = (field: keyof Lead, value: any) =>
    setEditDraft(d => d ? { ...d, [field]: value } : d);

  const handleSaveLead = async () => {
    if (!editDraft || !selectedLead) return;
    setIsSaving(true);
    const patch: Record<string, any> = {
      razao_social:    editDraft.razaoSocial   || null,
      nome_fantasia:   editDraft.nomeFantasia  || null,
      decisor:         editDraft.decisor       || null,
      cnpj:            editDraft.cnpj          || null,
      tier:            editDraft.tier          || null,
      temperatura:     editDraft.temperatura   || 'frio',
      faturamento:     editDraft.faturamento   || null,
      num_funcionarios: editDraft.numFuncionarios || null,
      uf:              editDraft.uf            || null,
      municipio:       editDraft.municipio     || null,
      bairro:          editDraft.bairro        || null,
      endereco:        editDraft.endereco      || null,
      cep:             editDraft.cep           || null,
      whatsapp:        editDraft.whatsapp      || null,
      telefone:        editDraft.telefone      || null,
      email:           editDraft.email         || null,
      site:            editDraft.site          || null,
      instagram:       editDraft.instagram     || null,
      linkedin:        editDraft.linkedin      || null,
      cnae:            editDraft.cnae          || null,
      porte:           editDraft.porte         || null,
      regime:          editDraft.regime        || null,
      chance_contato:  editDraft.chanceContato || null,
      origem:          editDraft.origem        || null,
      score:           editDraft.score         ?? 0,
      summary:         editDraft.summary       || null,
      contact_name:    editDraft.decisor || editDraft.razaoSocial || null,
      contact_phone:   editDraft.whatsapp || editDraft.telefone || null,
    };
    const { error } = await (supabase as any).from('crm_leads').update(patch).eq('id', selectedLead.id);
    if (!error) {
      const updated: Lead = {
        ...selectedLead,
        ...editDraft,
        name: editDraft.razaoSocial || editDraft.decisor || selectedLead.name,
        phone: editDraft.whatsapp || editDraft.telefone || selectedLead.phone,
      };
      setLeads(prev => prev.map(l => l.id === selectedLead.id ? updated : l));
      setSelectedLead(updated);
      setIsEditing(false);
      setEditDraft(null);
    }
    setIsSaving(false);
  };

  const handleUpdateStage = async (leadId: string, newStatus: LeadStatus) => {
    await (supabase as any).from('crm_leads').update({ status: newStatus }).eq('id', leadId);
    setLeads(currentLeads =>
      currentLeads.map(l => {
        if (l.id === leadId && l.status !== newStatus) {
          const activity: ActivityLog = {
            id: Date.now().toString(),
            type: 'move',
            content: `Moveu o card de '${COLUMNS.find(c => c.id === l.status)?.title}' para '${COLUMNS.find(c => c.id === newStatus)?.title}'`,
            author: 'Você',
            timestamp: 'Agora'
          };
          const updatedLead = { ...l, status: newStatus, activities: [activity, ...l.activities] };
          if (selectedLead?.id === leadId) setSelectedLead(updatedLead);
          return updatedLead;
        }
        return l;
      })
    );
  };

  const handleAddTag = async (leadId: string) => {
    if (!newTag.trim()) return;
    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.tags.includes(newTag.trim())) return;
    const newTags = [...lead.tags, newTag.trim()];
    await (supabase as any).from('crm_leads').update({ tags: newTags }).eq('id', leadId);
    setLeads(currentLeads =>
      currentLeads.map(l => {
        if (l.id === leadId) {
          const activity: ActivityLog = {
            id: Date.now().toString(),
            type: 'system',
            content: `Adicionou a tag '${newTag.trim()}'`,
            author: 'Você',
            timestamp: 'Agora'
          };
          const updatedLead = { ...l, tags: newTags, activities: [activity, ...l.activities] };
          if (selectedLead?.id === leadId) setSelectedLead(updatedLead);
          return updatedLead;
        }
        return l;
      })
    );
    setNewTag('');
  };

  const handleRemoveTag = async (leadId: string, tagToRemove: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    const newTags = lead.tags.filter(t => t !== tagToRemove);
    await (supabase as any).from('crm_leads').update({ tags: newTags }).eq('id', leadId);
    setLeads(currentLeads =>
      currentLeads.map(l => {
        if (l.id === leadId) {
          const activity: ActivityLog = {
            id: Date.now().toString(),
            type: 'system',
            content: `Removeu a tag '${tagToRemove}'`,
            author: 'Você',
            timestamp: 'Agora'
          };
          const updatedLead = { ...l, tags: newTags, activities: [activity, ...l.activities] };
          if (selectedLead?.id === leadId) setSelectedLead(updatedLead);
          return updatedLead;
        }
        return l;
      })
    );
  };


  const [panelPeriod, setPanelPeriod] = useState<'30d' | '90d' | 'year' | 'all'>('all');

  const panelLeads = leads.filter(l => {
    if (panelPeriod === 'all') return true;
    const d = new Date(l.createdAt);
    const now = new Date();
    if (panelPeriod === '30d')  return d >= new Date(now.getTime() - 30*864e5);
    if (panelPeriod === '90d')  return d >= new Date(now.getTime() - 90*864e5);
    if (panelPeriod === 'year') return d.getFullYear() === now.getFullYear();
    return true;
  });

  const rankingLeads = processedLeads
    .filter(l => {
      if (rankTier.length > 0 && !rankTier.includes(l.tier || '')) return false;
      if (rankTemp.length > 0 && !rankTemp.includes(l.temperatura || '')) return false;
      if (rankUF && (l.uf || '').toLowerCase() !== rankUF.toLowerCase()) return false;
      if (rankChance && (l.chanceContato || '').toLowerCase() !== rankChance.toLowerCase()) return false;
      return true;
    })
    .sort((a, b) => {
      const ra = (a.rankScore ?? 0) > 0 ? a.rankScore! : 999999;
      const rb = (b.rankScore ?? 0) > 0 ? b.rankScore! : 999999;
      if (ra !== rb) return ra - rb;
      return b.score - a.score;
    });

  const rankUFs = [...new Set(leads.map(l => l.uf).filter(Boolean) as string[])].sort();

  const [isComposingEmail, setIsComposingEmail] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newLeads = Array.from(leads);
    const leadIndex = newLeads.findIndex(l => l.id === draggableId);
    if (leadIndex === -1) return;

    const oldStatus = newLeads[leadIndex].status;
    const newStatus = destination.droppableId as LeadStatus;

    if (oldStatus !== newStatus) {
      await (supabase as any).from('crm_leads').update({ status: newStatus }).eq('id', draggableId);
      const activity: ActivityLog = {
        id: Date.now().toString(),
        type: 'move',
        content: `Moveu o card de '${COLUMNS.find(c => c.id === oldStatus)?.title}' para '${COLUMNS.find(c => c.id === newStatus)?.title}'`,
        author: 'Você',
        timestamp: 'Agora'
      };
      newLeads[leadIndex] = { ...newLeads[leadIndex], status: newStatus, activities: [activity, ...newLeads[leadIndex].activities] };
    }

    setLeads(newLeads);
  };

  const handleCardClick = (lead: Lead) => {
    setSelectedLead(lead);
    setIsSheetOpen(true);
  };

  const handleAddComment = () => {
    if (!newComment.trim() || !selectedLead) return;

    const activity: ActivityLog = {
      id: Date.now().toString(),
      type: 'comment',
      content: newComment,
      author: 'Você',
      timestamp: 'Agora'
    };

    const updatedLead = {
      ...selectedLead,
      activities: [activity, ...selectedLead.activities]
    };

    setLeads(leads.map(l => l.id === selectedLead.id ? updatedLead : l));
    setSelectedLead(updatedLead);
    setNewComment('');
  };

  const handleSendEmail = () => {
    if (!emailSubject.trim() || !emailBody.trim()) return;
    alert(`Email Enviado! \nAssunto: ${emailSubject}`);
    setIsComposingEmail(false);
    setEmailSubject('');
    setEmailBody('');
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 50) return 'text-orange-500';
    return 'text-muted-foreground';
  };

  const fakeEmails = [
    { id: 1, title: 'Cliente - Aprovação Presidente', date: '17 de abr.', unread: true },
    { id: 2, title: 'Atualização da sua solicitação de investimento', date: '17 de abr.', unread: false },
    { id: 3, title: 'Cliente - Aprovação Diretor', date: '15 de abr.', unread: false },
  ];

  return (
    <div className="w-full bg-background min-h-screen flex flex-col">

      <div className="px-6 py-4 border-b border-border bg-card/50">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold flex items-center gap-2">
            Controle de Clientes
            <span className="text-xs font-normal bg-primary/20 text-primary px-2 py-0.5 rounded-full">Bot: {selectedBot?.name || 'Geral'}</span>
          </h1>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={() => setIsImportOpen(true)}
            disabled={!selectedBot?.id}
          >
            <Upload className="w-4 h-4" />
            Importar CSV / XLSX
          </Button>
        </div>

        <Tabs defaultValue="kanban" className="w-full">
          <TabsList className="bg-transparent h-auto p-0 gap-6 border-b border-border w-full justify-start rounded-none flex-wrap">
            <TabsTrigger value="kanban" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-3 flex items-center gap-2 text-muted-foreground data-[state=active]:text-foreground">
              <LayoutGrid className="w-4 h-4" /> Kanban
            </TabsTrigger>
            <TabsTrigger value="lista" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-3 flex items-center gap-2 text-muted-foreground data-[state=active]:text-foreground">
              <List className="w-4 h-4" /> Lista
            </TabsTrigger>
            <TabsTrigger value="ranking" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-3 flex items-center gap-2 text-muted-foreground data-[state=active]:text-foreground">
              <Trophy className="w-4 h-4" /> Ranking
            </TabsTrigger>
            <TabsTrigger value="calendario" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-3 flex items-center gap-2 text-muted-foreground data-[state=active]:text-foreground">
              <Calendar className="w-4 h-4" /> Calendário
            </TabsTrigger>
            <TabsTrigger value="painel" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-3 flex items-center gap-2 text-muted-foreground data-[state=active]:text-foreground">
              <LineChart className="w-4 h-4" /> Painel
            </TabsTrigger>
            <TabsTrigger value="email" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-3 flex items-center gap-2 text-muted-foreground data-[state=active]:text-foreground">
              <Mail className="w-4 h-4" /> Email
            </TabsTrigger>
            <TabsTrigger value="atividades" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-3 flex items-center gap-2 text-muted-foreground data-[state=active]:text-foreground">
              <Activity className="w-4 h-4" /> Atividade
            </TabsTrigger>
          </TabsList>

          {/* === BARRA DE CONTROLES (estilo Notion) === */}
          <div className="px-3 py-1.5 flex items-center gap-1 bg-card border-b border-border">

            {/* Campos */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground">
                  <Share2 className="w-3.5 h-3.5" /> Campos
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-60 p-3 bg-background border-border shadow-lg" align="start">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Campos do card</p>
                <div className="space-y-2">
                  {ALL_CARD_FIELDS.map(f => (
                    <label key={f.key} className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                      <input type="checkbox" className="rounded" checked={visibleFields.includes(f.key)} onChange={() => toggleCardField(f.key)} />
                      {f.label}
                    </label>
                  ))}
                </div>
                <div className="border-t border-border mt-3 pt-2 flex gap-2">
                  <button onClick={() => { const a = ALL_CARD_FIELDS.map(f=>f.key); setVisibleFields(a); localStorage.setItem(CRM_FIELDS_KEY, JSON.stringify(a)); }} className="text-xs text-primary">Marcar todos</button>
                  <button onClick={() => { setVisibleFields(DEFAULT_FIELDS); localStorage.setItem(CRM_FIELDS_KEY, JSON.stringify(DEFAULT_FIELDS)); }} className="text-xs text-muted-foreground ml-auto">Padrão</button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Filtrar */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className={`h-8 text-xs gap-1.5 ${filters.length > 0 ? 'text-blue-500' : 'text-muted-foreground hover:text-foreground'}`}>
                  <Filter className="w-3.5 h-3.5" /> Filtrar {filters.length > 0 && `(${filters.length})`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[560px] p-4 bg-background border-border shadow-lg" align="start">
                <div className="space-y-2">
                  {filters.length === 0 && <p className="text-xs text-muted-foreground py-2">Nenhum filtro ativo. Adicione uma condição abaixo.</p>}
                  {filters.map((filter) => {
                    const fieldDef = FILTER_FIELDS.find(f => f.key === filter.field);
                    const ops = OPERATORS_BY_TYPE[fieldDef?.type || 'text'] || OPERATORS_BY_TYPE.text;
                    const needsValue = !['blank','not_blank','true','false'].includes(filter.operator);
                    return (
                      <div key={filter.id} className="flex items-center gap-2">
                        {/* Campo */}
                        <Select value={filter.field} onValueChange={val => {
                          const def = FILTER_FIELDS.find(f=>f.key===val);
                          const op = (OPERATORS_BY_TYPE[def?.type||'text']||[])[0]?.val || 'contains';
                          updateFilter(filter.id, { field: val, operator: op, value: '' });
                        }}>
                          <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{FILTER_FIELDS.map(f=><SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}</SelectContent>
                        </Select>
                        {/* Operador */}
                        <Select value={filter.operator} onValueChange={val => updateFilter(filter.id, { operator: val, value: '' })}>
                          <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{ops.map(o=><SelectItem key={o.val} value={o.val}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                        {/* Valor */}
                        {needsValue && (
                          fieldDef?.type === 'select' ? (
                            <Select value={filter.value} onValueChange={val => updateFilter(filter.id, { value: val })}>
                              <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                              <SelectContent>{(fieldDef.options||[]).map(o=><SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                            </Select>
                          ) : fieldDef?.type === 'date' ? (
                            <Select value={filter.value} onValueChange={val => updateFilter(filter.id, { value: val })}>
                              <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="Selecione período..." /></SelectTrigger>
                              <SelectContent>{DATE_PRESETS.map(p=><SelectItem key={p.val} value={p.val}>{p.label}</SelectItem>)}</SelectContent>
                            </Select>
                          ) : (
                            <Input className="flex-1 h-8 text-xs bg-background" placeholder="Clique aqui..." value={filter.value} onChange={e => updateFilter(filter.id, { value: e.target.value })} />
                          )
                        )}
                        {!needsValue && <div className="flex-1" />}
                        <Button variant="ghost" size="icon" onClick={() => removeFilter(filter.id)} className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between pt-3 border-t border-border mt-2">
                    <Button variant="ghost" size="sm" onClick={addFilter} className="text-xs gap-1"><Plus className="w-3.5 h-3.5" /> Adicionar condição</Button>
                    <div className="flex gap-2">
                      {filters.length > 0 && <Button variant="ghost" size="sm" onClick={() => setFilters([])} className="text-xs text-muted-foreground gap-1"><Trash2 className="w-3 h-3" /> Limpar Tudo</Button>}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Ordenar */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className={`h-8 text-xs gap-1.5 ${sortConfig ? 'text-blue-500' : 'text-muted-foreground hover:text-foreground'}`}>
                  <ArrowUpDown className="w-3.5 h-3.5" /> Ordenar
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3 bg-background border-border shadow-lg" align="start">
                <div className="space-y-1.5">
                  {[{f:'rankScore',d:'asc',l:'Por Rank (melhor primeiro)'},{f:'score',d:'desc',l:'Por Score (maior primeiro)'},{f:'razaoSocial',d:'asc',l:'Por Empresa (A → Z)'},{f:'createdAt',d:'desc',l:'Por Criação (mais recente)'},{f:'createdAt',d:'asc',l:'Por Criação (mais antigo)'}].map(o=>(
                    <Button key={o.f+o.d} variant={sortConfig?.field===o.f&&sortConfig?.direction===o.d?"default":"outline"} size="sm" onClick={()=>setSortConfig({field:o.f,direction:o.d as 'asc'|'desc'})} className="w-full text-xs justify-start h-8">{o.l}</Button>
                  ))}
                  {sortConfig && <Button variant="ghost" size="sm" onClick={()=>setSortConfig(null)} className="w-full text-xs text-red-500 mt-1">Remover ordenação</Button>}
                </div>
              </PopoverContent>
            </Popover>

            {/* Pesquisar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Pesquisar..." className="pl-8 bg-background border-border h-8 text-xs w-48" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>

            {/* Separador */}
            <div className="flex-1" />

            {/* Visualizações */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground">
                  <LayoutGrid className="w-3.5 h-3.5" /> Visualizações {savedViews.length > 0 && `(${savedViews.length})`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3 bg-background border-border shadow-lg" align="end">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Visualizações salvas</p>
                {savedViews.length === 0 && <p className="text-xs text-muted-foreground mb-3">Nenhuma visualização salva ainda.</p>}
                <div className="space-y-1.5 mb-3">
                  {savedViews.map(v => (
                    <div key={v.id} className="flex items-center gap-2">
                      <button onClick={() => loadView(v)} className="flex-1 text-left text-sm hover:text-primary truncate">{v.name}</button>
                      <Button variant="ghost" size="icon" onClick={() => deleteView(v.id)} className="h-6 w-6 shrink-0 text-muted-foreground hover:text-red-500"><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-3">
                  {showSaveView ? (
                    <div className="flex gap-2">
                      <Input className="flex-1 h-8 text-xs" placeholder="Nome da visualização" value={viewName} onChange={e => setViewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveView()} />
                      <Button size="sm" onClick={saveView} className="h-8 text-xs">Salvar</Button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setShowSaveView(true)} className="w-full text-xs h-8 gap-1"><Plus className="w-3.5 h-3.5" /> Salvar visualização atual</Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* === KANBAN VIEW (ARRASTAR E SOLTAR) === */}
          <TabsContent value="kanban" className="m-0 focus-visible:outline-none">
            {isLoading ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Carregando leads...
              </div>
            ) : (
              <div className="relative">
                <div
                  ref={scrollContainerRef}
                  className="w-full overflow-x-auto p-4 custom-scrollbar [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-thumb]:bg-primary/30 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-primary/50 [&::-webkit-scrollbar-track]:bg-transparent pb-6"
                >
                  <DragDropContext onDragEnd={onDragEnd}>
                    <div className="flex gap-4 items-start min-w-max pb-2 h-[calc(100vh-280px)]">
                      {COLUMNS.map((col) => {
                        const columnLeads = processedLeads.filter(l => l.status === col.id);
                        const limit = colLimits[col.id] ?? COL_PAGE_SIZE;
                        const visibleLeads = columnLeads.slice(0, limit);
                        const hasMore = columnLeads.length > limit;

                        return (
                          <div key={col.id} className="flex flex-col w-[320px] max-h-full flex-shrink-0 bg-secondary/20 rounded-xl border border-border">
                            <div className={`flex-shrink-0 p-3 rounded-t-xl border-t-4 ${col.color} bg-background flex items-center justify-between shadow-sm`}>
                              <div className="flex items-center gap-2 font-semibold text-foreground">
                                <col.icon className="w-4 h-4" />
                                {col.title}
                              </div>
                              <Badge variant="secondary" className="bg-muted text-foreground">
                                {columnLeads.length}
                              </Badge>
                            </div>

                            <Droppable droppableId={col.id}>
                              {(provided, snapshot) => (
                                <div
                                  {...provided.droppableProps}
                                  ref={provided.innerRef}
                                  className={`flex-1 p-2 overflow-y-auto min-h-[50px] custom-scrollbar space-y-3 pb-4 transition-colors ${snapshot.isDraggingOver ? 'bg-primary/5' : ''}`}
                                >
                                  {visibleLeads.map((lead, index) => (
                                    <Draggable key={lead.id} draggableId={lead.id} index={index}>
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          onClick={() => handleCardClick(lead)}
                                        >
                                          <Card className={`cursor-pointer transition-shadow shadow-sm bg-card border-border relative group ${snapshot.isDragging ? 'shadow-lg border-primary ring-1 ring-primary/50' : 'hover:border-primary/50'}`}>
                                            <CardContent className="p-3 flex flex-col gap-1.5">
                                              {/* Nome + Score */}
                                              <div className="flex justify-between items-start gap-2">
                                                <p className="font-semibold text-sm text-foreground leading-tight">
                                                  {visibleFields.includes('razaoSocial') ? (lead.razaoSocial || lead.name) : lead.name}
                                                </p>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                  {visibleFields.includes('rankScore') && (lead.rankScore ?? 0) > 0 && (
                                                    <span className="text-[10px] text-muted-foreground font-mono">#{lead.rankScore}</span>
                                                  )}
                                                  {visibleFields.includes('score') && (
                                                    <span className={`font-bold text-xs ${getScoreColor(lead.score)}`}>🔥 {lead.score}</span>
                                                  )}
                                                </div>
                                              </div>

                                              {/* Nome Fantasia */}
                                              {visibleFields.includes('nomeFantasia') && lead.nomeFantasia && lead.nomeFantasia !== lead.razaoSocial && (
                                                <p className="text-[10px] text-muted-foreground italic truncate">{lead.nomeFantasia}</p>
                                              )}

                                              {/* Decisor */}
                                              {visibleFields.includes('decisor') && lead.decisor && (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide w-14 shrink-0">Decisor</span>
                                                  <span className="text-foreground truncate">👤 {lead.decisor}</span>
                                                </div>
                                              )}

                                              {/* CNPJ */}
                                              {visibleFields.includes('cnpj') && lead.cnpj && (
                                                <p className="text-[10px] text-muted-foreground font-mono">{lead.cnpj}</p>
                                              )}

                                              {/* Tier + Temperatura */}
                                              {(visibleFields.includes('tier') || visibleFields.includes('temperatura')) && (
                                                <div className="flex gap-1.5 flex-wrap">
                                                  {visibleFields.includes('tier') && lead.tier && (
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${lead.tier === 'A' ? 'bg-red-500/10 text-red-400 border-red-500/30' : lead.tier === 'B' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-gray-500/10 text-gray-400 border-gray-500/30'}`}>
                                                      {lead.tier}
                                                    </span>
                                                  )}
                                                  {visibleFields.includes('temperatura') && lead.temperatura && (
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${lead.temperatura === 'quente' ? 'bg-red-500/10 text-red-400 border-red-500/30' : lead.temperatura === 'morno' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' : 'bg-blue-500/10 text-blue-400 border-blue-500/30'}`}>
                                                      {lead.temperatura === 'quente' ? '🔥' : lead.temperatura === 'morno' ? '🌡️' : '❄️'} {lead.temperatura}
                                                    </span>
                                                  )}
                                                </div>
                                              )}

                                              {/* Localização */}
                                              {visibleFields.includes('localizacao') && (lead.municipio || lead.uf) && (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide w-14 shrink-0">Local</span>
                                                  <span className="text-muted-foreground truncate">📍 {[lead.municipio, lead.uf].filter(Boolean).join(' · ')}</span>
                                                </div>
                                              )}

                                              {/* Bairro */}
                                              {visibleFields.includes('bairro') && lead.bairro && (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide w-14 shrink-0">Bairro</span>
                                                  <span className="text-muted-foreground truncate">{lead.bairro}</span>
                                                </div>
                                              )}

                                              {/* Endereço */}
                                              {visibleFields.includes('endereco') && lead.endereco && (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide w-14 shrink-0">Endereço</span>
                                                  <span className="text-muted-foreground truncate">{lead.endereco}</span>
                                                </div>
                                              )}

                                              {/* CEP */}
                                              {visibleFields.includes('cep') && lead.cep && (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide w-14 shrink-0">CEP</span>
                                                  <span className="text-muted-foreground font-mono">{lead.cep}</span>
                                                </div>
                                              )}

                                              {/* Faturamento */}
                                              {visibleFields.includes('faturamento') && lead.faturamento && (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide w-14 shrink-0">Fatur.</span>
                                                  <span className="text-muted-foreground truncate">💰 {lead.faturamento}</span>
                                                </div>
                                              )}

                                              {/* Funcionários */}
                                              {visibleFields.includes('funcionarios') && lead.numFuncionarios && (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide w-14 shrink-0">Func.</span>
                                                  <span className="text-muted-foreground">👥 {lead.numFuncionarios}</span>
                                                </div>
                                              )}

                                              {/* Porte */}
                                              {visibleFields.includes('porte') && lead.porte && (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide w-14 shrink-0">Porte</span>
                                                  <span className="text-muted-foreground">{lead.porte}</span>
                                                </div>
                                              )}

                                              {/* Regime */}
                                              {visibleFields.includes('regime') && lead.regime && (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide w-14 shrink-0">Regime</span>
                                                  <span className="text-muted-foreground">{lead.regime}</span>
                                                </div>
                                              )}

                                              {/* CNAE */}
                                              {visibleFields.includes('cnae') && lead.cnae && (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide w-14 shrink-0">CNAE</span>
                                                  <span className="text-muted-foreground truncate">{lead.cnae}</span>
                                                </div>
                                              )}

                                              {/* Chance de contato */}
                                              {visibleFields.includes('chanceContato') && lead.chanceContato && (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide w-14 shrink-0">Chance</span>
                                                  <span className="text-muted-foreground">📊 {lead.chanceContato}</span>
                                                </div>
                                              )}

                                              {/* WhatsApp */}
                                              {visibleFields.includes('whatsapp') && lead.whatsapp && (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide w-14 shrink-0">WhatsApp</span>
                                                  <span className="text-green-400 truncate">📱 {lead.whatsapp}</span>
                                                </div>
                                              )}

                                              {/* Telefone */}
                                              {visibleFields.includes('telefone') && lead.telefone && (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide w-14 shrink-0">Telefone</span>
                                                  <span className="text-muted-foreground truncate">📞 {lead.telefone}</span>
                                                </div>
                                              )}

                                              {/* Email */}
                                              {visibleFields.includes('email') && lead.email && (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide w-14 shrink-0">Email</span>
                                                  <span className="text-muted-foreground truncate">✉️ {lead.email}</span>
                                                </div>
                                              )}

                                              {/* Site */}
                                              {visibleFields.includes('site') && lead.site && (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide w-14 shrink-0">Site</span>
                                                  <span className="text-muted-foreground truncate">🌐 {lead.site}</span>
                                                </div>
                                              )}

                                              {/* Instagram */}
                                              {visibleFields.includes('instagram') && lead.instagram && (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide w-14 shrink-0">Instagram</span>
                                                  <span className="text-muted-foreground truncate">📸 {lead.instagram}</span>
                                                </div>
                                              )}

                                              {/* LinkedIn */}
                                              {visibleFields.includes('linkedin') && lead.linkedin && (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide w-14 shrink-0">LinkedIn</span>
                                                  <span className="text-muted-foreground truncate">💼 {lead.linkedin}</span>
                                                </div>
                                              )}

                                              {/* Origem */}
                                              {visibleFields.includes('origem') && lead.origem && (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide w-14 shrink-0">Origem</span>
                                                  <span className="text-muted-foreground truncate">{lead.origem}</span>
                                                </div>
                                              )}

                                              {/* Resumo */}
                                              {visibleFields.includes('summary') && lead.summary && (
                                                <div className="bg-secondary/50 p-2 rounded text-xs text-muted-foreground border-l-2 border-l-primary/50 mt-0.5">
                                                  <span className="line-clamp-2 leading-relaxed">{lead.summary}</span>
                                                </div>
                                              )}

                                              {/* Ícones de contato */}
                                              {visibleFields.includes('contatos') && (lead.temWpp || lead.temEmail || lead.temSite) && (
                                                <div className="flex gap-1.5 mt-0.5 flex-wrap">
                                                  {lead.temWpp && <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded">📱 WPP</span>}
                                                  {lead.temEmail && <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded">✉️ Email</span>}
                                                  {lead.temSite && <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded">🌐 Site</span>}
                                                </div>
                                              )}

                                              {/* Tags */}
                                              {visibleFields.includes('tags') && lead.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-0.5">
                                                  {lead.tags.map(tag => (
                                                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border">{tag}</span>
                                                  ))}
                                                </div>
                                              )}
                                            </CardContent>
                                          </Card>
                                        </div>
                                      )}
                                    </Draggable>
                                  ))}
                                  {provided.placeholder}
                                  {hasMore && (
                                    <button
                                      onClick={() => setColLimits(p => ({ ...p, [col.id]: (p[col.id] ?? COL_PAGE_SIZE) + COL_PAGE_SIZE }))}
                                      className="w-full mt-1 py-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-lg hover:border-primary/40 transition-colors"
                                    >
                                      Ver mais {Math.min(COL_PAGE_SIZE, columnLeads.length - limit)} de {columnLeads.length - limit} restantes
                                    </button>
                                  )}
                                </div>
                              )}
                            </Droppable>
                          </div>
                        )
                      })}
                    </div>
                  </DragDropContext>
                </div>
              </div>
            )}
          </TabsContent>

          {/* === LISTA VIEW DETALHADA === */}
          <TabsContent value="lista" className="m-0 focus-visible:outline-none p-4 md:p-8">
            {/* Toolbar da Lista */}
            <div className="flex items-center gap-3 mb-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                    <Share2 className="w-3.5 h-3.5" /> Campos ({listColumns.length})
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-60 p-3 bg-background border-border shadow-lg" align="start">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Colunas da lista</p>
                  <div className="space-y-2">
                    {ALL_LIST_COLS.map(col => (
                      <label key={col.key} className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                        <input type="checkbox" className="rounded" checked={listColumns.includes(col.key)} onChange={() => toggleListCol(col.key)} />
                        {col.label}
                      </label>
                    ))}
                  </div>
                  <div className="border-t border-border mt-3 pt-2 flex gap-2">
                    <button onClick={() => { const all = ALL_LIST_COLS.map(c=>c.key); setListColumns(all); localStorage.setItem(LIST_COLS_KEY, JSON.stringify(all)); }} className="text-xs text-primary">Marcar todos</button>
                    <button onClick={() => { setListColumns(DEFAULT_LIST_COLS); localStorage.setItem(LIST_COLS_KEY, JSON.stringify(DEFAULT_LIST_COLS)); }} className="text-xs text-muted-foreground ml-auto">Padrão</button>
                  </div>
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">{Math.min(listLimit, processedLeads.length).toLocaleString('pt-BR')} de {processedLeads.length.toLocaleString('pt-BR')} registros</span>
            </div>

            <div className="bg-card border border-border rounded-xl shadow-sm w-full overflow-hidden">
              <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
                <table className="w-full text-left align-middle border-collapse table-auto">
                  <thead className="bg-secondary/40 text-muted-foreground border-b border-border text-xs uppercase tracking-wider font-semibold sticky top-0 z-10">
                    <tr>
                      {listColumns.includes('name')             && <th className="px-5 py-4">Empresa / Nome</th>}
                      {listColumns.includes('cnpj')             && <th className="px-5 py-4">CNPJ</th>}
                      {listColumns.includes('decisor')          && <th className="px-5 py-4">Decisor</th>}
                      {listColumns.includes('tier')             && <th className="px-5 py-4">Tier</th>}
                      {listColumns.includes('temperatura')      && <th className="px-5 py-4">Temperatura</th>}
                      {listColumns.includes('telefone')         && <th className="px-5 py-4">Telefone</th>}
                      {listColumns.includes('email')            && <th className="px-5 py-4">Email</th>}
                      {listColumns.includes('status')           && <th className="px-5 py-4">Etapa</th>}
                      {listColumns.includes('score')            && <th className="px-5 py-4">Score</th>}
                      {listColumns.includes('faturamento')      && <th className="px-5 py-4">Faturamento</th>}
                      {listColumns.includes('numFuncionarios')  && <th className="px-5 py-4">Funcionários</th>}
                      {listColumns.includes('uf')               && <th className="px-5 py-4">UF</th>}
                      {listColumns.includes('municipio')        && <th className="px-5 py-4">Município</th>}
                      {listColumns.includes('chanceContato')    && <th className="px-5 py-4">Chance</th>}
                      {listColumns.includes('tags')             && <th className="px-5 py-4">Tags</th>}
                      {listColumns.includes('origem')           && <th className="px-5 py-4">Origem</th>}
                      {listColumns.includes('createdAt')        && <th className="px-5 py-4">Criação</th>}
                      <th className="px-5 py-4 text-right w-24">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-background">
                    {processedLeads.slice(0, listLimit).map(lead => (
                      <tr key={lead.id} className="hover:bg-muted/30 cursor-pointer transition-colors group" onClick={() => handleCardClick(lead)}>
                        {listColumns.includes('name') && (
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/20 shrink-0">
                                {lead.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-semibold text-foreground text-sm truncate max-w-[180px]">{lead.name}</span>
                            </div>
                          </td>
                        )}
                        {listColumns.includes('cnpj')            && <td className="px-5 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">{lead.cnpj || '—'}</td>}
                        {listColumns.includes('decisor')         && <td className="px-5 py-3 text-sm text-muted-foreground max-w-[140px] truncate">{lead.decisor || '—'}</td>}
                        {listColumns.includes('tier') && (
                          <td className="px-5 py-3">
                            {lead.tier ? (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded border ${lead.tier === 'A' ? 'bg-red-500/10 text-red-400 border-red-500/30' : lead.tier === 'B' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-gray-500/10 text-gray-400 border-gray-500/30'}`}>{lead.tier}</span>
                            ) : '—'}
                          </td>
                        )}
                        {listColumns.includes('temperatura') && (
                          <td className="px-5 py-3">
                            {lead.temperatura ? (
                              <span className={`text-xs px-2 py-0.5 rounded border ${lead.temperatura === 'quente' ? 'bg-red-500/10 text-red-400 border-red-500/30' : lead.temperatura === 'morno' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' : 'bg-blue-500/10 text-blue-400 border-blue-500/30'}`}>
                                {lead.temperatura === 'quente' ? '🔥' : lead.temperatura === 'morno' ? '🌡️' : '❄️'} {lead.temperatura}
                              </span>
                            ) : '—'}
                          </td>
                        )}
                        {listColumns.includes('telefone')        && <td className="px-5 py-3 text-sm text-muted-foreground whitespace-nowrap">{lead.phone || '—'}</td>}
                        {listColumns.includes('email')           && <td className="px-5 py-3 text-sm text-muted-foreground max-w-[160px] truncate">{lead.email || '—'}</td>}
                        {listColumns.includes('status') && (
                          <td className="px-5 py-3">
                            <Badge variant="outline" className="bg-secondary/30 text-xs px-2 py-0.5 text-foreground border-border whitespace-nowrap">
                              {COLUMNS.find(c => c.id === lead.status)?.title}
                            </Badge>
                          </td>
                        )}
                        {listColumns.includes('score') && (
                          <td className="px-5 py-3">
                            <span className={`font-bold text-sm ${getScoreColor(lead.score)}`}>🔥 {lead.score}</span>
                          </td>
                        )}
                        {listColumns.includes('faturamento')     && <td className="px-5 py-3 text-sm text-muted-foreground whitespace-nowrap">{lead.faturamento || '—'}</td>}
                        {listColumns.includes('numFuncionarios') && <td className="px-5 py-3 text-sm text-muted-foreground whitespace-nowrap">{lead.numFuncionarios || '—'}</td>}
                        {listColumns.includes('uf')              && <td className="px-5 py-3 text-sm text-muted-foreground">{lead.uf || '—'}</td>}
                        {listColumns.includes('municipio')       && <td className="px-5 py-3 text-sm text-muted-foreground whitespace-nowrap">{lead.municipio || '—'}</td>}
                        {listColumns.includes('chanceContato')   && <td className="px-5 py-3 text-sm text-muted-foreground">{lead.chanceContato || '—'}</td>}
                        {listColumns.includes('tags') && (
                          <td className="px-5 py-3">
                            <div className="flex gap-1 flex-wrap">
                              {lead.tags.slice(0, 2).map(tag => (
                                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border whitespace-nowrap">{tag}</span>
                              ))}
                              {lead.tags.length > 2 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground">+{lead.tags.length - 2}</span>}
                            </div>
                          </td>
                        )}
                        {listColumns.includes('origem')    && <td className="px-5 py-3 text-xs text-muted-foreground max-w-[120px] truncate">{lead.origem || '—'}</td>}
                        {listColumns.includes('createdAt') && <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">{lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('pt-BR') : '—'}</td>}
                        <td className="px-5 py-3 text-right">
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-xs">Ver</Button>
                        </td>
                      </tr>
                    ))}
                    {processedLeads.length === 0 && (
                      <tr>
                        <td colSpan={listColumns.length + 1} className="px-6 py-12 text-center text-muted-foreground">
                          <div className="flex flex-col items-center justify-center">
                            <List className="w-10 h-10 mb-3 opacity-20" />
                            <p>Nenhum lead encontrado.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {processedLeads.length > listLimit && (
              <div className="mt-3 flex items-center justify-center">
                <button
                  onClick={() => setListLimit(l => l + 50)}
                  className="px-6 py-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-lg hover:border-primary/40 transition-colors"
                >
                  Ver mais {Math.min(50, processedLeads.length - listLimit)} de {(processedLeads.length - listLimit).toLocaleString('pt-BR')} restantes
                </button>
              </div>
            )}
          </TabsContent>

          {/* === RANKING VIEW === */}
          <TabsContent value="ranking" className="m-0 focus-visible:outline-none p-4 md:p-8 pb-12">
            <div className="w-full max-w-7xl mx-auto space-y-5">

              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-primary" /> Ranking B2B
                  </h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    Leads ordenados por rank score · {rankingLeads.length.toLocaleString('pt-BR')} encontrados
                  </p>
                </div>
              </div>

              {/* Quick filters */}
              <div className="flex flex-wrap items-center gap-2 p-3 bg-card border border-border rounded-xl">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tier:</span>
                {(['A','B','C'] as const).map(t => (
                  <button key={t}
                    onClick={() => setRankTier(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                    className={`text-xs font-bold px-2.5 py-1 rounded border transition-colors ${
                      rankTier.includes(t)
                        ? t === 'A' ? 'bg-red-500 text-white border-red-500' : t === 'B' ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-500 text-white border-gray-500'
                        : t === 'A' ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20' : t === 'B' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/30 hover:bg-gray-500/20'
                    }`}
                  >{t}</button>
                ))}

                <div className="w-px h-5 bg-border mx-1" />

                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Temp:</span>
                {([
                  ['quente','🔥','bg-red-500/10 text-red-400 border-red-500/30','bg-red-500 text-white border-red-500','hover:bg-red-500/20'],
                  ['morno','🌡️','bg-orange-500/10 text-orange-400 border-orange-500/30','bg-orange-500 text-white border-orange-500','hover:bg-orange-500/20'],
                  ['frio','❄️','bg-blue-500/10 text-blue-400 border-blue-500/30','bg-blue-500 text-white border-blue-500','hover:bg-blue-500/20'],
                ] as const).map(([val, icon, inactive, active, hover]) => (
                  <button key={val}
                    onClick={() => setRankTemp(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val])}
                    className={`text-xs px-2.5 py-1 rounded border transition-colors ${rankTemp.includes(val) ? active : `${inactive} ${hover}`}`}
                  >{icon} {val}</button>
                ))}

                <div className="w-px h-5 bg-border mx-1" />

                <Select value={rankUF || 'all'} onValueChange={v => setRankUF(v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-7 w-28 text-xs border-border bg-background"><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos UFs</SelectItem>
                    {rankUFs.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={rankChance || 'all'} onValueChange={v => setRankChance(v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-7 w-36 text-xs border-border bg-background"><SelectValue placeholder="Chance" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as chances</SelectItem>
                    {['Alta','Regular','Baixa'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>

                {(rankTier.length > 0 || rankTemp.length > 0 || rankUF || rankChance) && (
                  <button
                    onClick={() => { setRankTier([]); setRankTemp([]); setRankUF(''); setRankChance(''); }}
                    className="text-xs text-muted-foreground hover:text-red-500 transition-colors ml-auto flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Limpar
                  </button>
                )}
              </div>

              {/* Ranking list */}
              <div className="space-y-2">
                {rankingLeads.slice(0, rankLimit).map((lead, idx) => {
                  const hasRank = (lead.rankScore ?? 0) > 0;
                  return (
                    <div key={lead.id} onClick={() => handleCardClick(lead)}
                      className="flex items-center gap-3 md:gap-4 p-4 bg-card border border-border rounded-xl cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all group">

                      {/* Rank number */}
                      <div className="w-10 shrink-0 text-center">
                        {hasRank
                          ? <span className={`text-sm font-bold font-mono ${idx < 3 ? 'text-primary' : 'text-muted-foreground'}`}>#{lead.rankScore}</span>
                          : <span className="text-xs text-muted-foreground/40">—</span>
                        }
                      </div>

                      {/* Tier badge */}
                      <div className="w-8 shrink-0 flex justify-center">
                        {lead.tier
                          ? <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${lead.tier==='A'?'bg-red-500/10 text-red-400 border-red-500/30':lead.tier==='B'?'bg-blue-500/10 text-blue-400 border-blue-500/30':'bg-gray-500/10 text-gray-400 border-gray-500/30'}`}>{lead.tier}</span>
                          : <span className="text-xs text-muted-foreground/30">—</span>
                        }
                      </div>

                      {/* Company + decisor + location */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">{lead.name}</p>
                        {lead.decisor && <p className="text-xs text-muted-foreground truncate">👤 {lead.decisor}</p>}
                        {(lead.municipio || lead.uf) && (
                          <p className="text-xs text-muted-foreground">📍 {[lead.municipio, lead.uf].filter(Boolean).join(' · ')}</p>
                        )}
                      </div>

                      {/* Faturamento */}
                      {lead.faturamento && (
                        <div className="hidden md:block shrink-0 w-36">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Fatur.</p>
                          <p className="text-xs text-foreground font-medium truncate">💰 {lead.faturamento}</p>
                        </div>
                      )}

                      {/* Channel icons */}
                      <div className="hidden sm:flex items-center gap-1 shrink-0">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${lead.temWpp ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-secondary/20 text-muted-foreground/30 border-border'}`}>📱</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${lead.temEmail ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-secondary/20 text-muted-foreground/30 border-border'}`}>✉️</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${lead.temSite ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-secondary/20 text-muted-foreground/30 border-border'}`}>🌐</span>
                      </div>

                      {/* Score */}
                      <div className="shrink-0 w-14 text-right">
                        <span className={`text-sm font-bold ${getScoreColor(lead.score)}`}>🔥 {lead.score}</span>
                      </div>

                      {/* Chance de contato */}
                      {lead.chanceContato && (
                        <div className="hidden lg:block shrink-0">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            lead.chanceContato === 'Alta' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                            lead.chanceContato === 'Regular' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' :
                            'bg-gray-500/10 text-gray-400 border-gray-500/30'
                          }`}>{lead.chanceContato}</span>
                        </div>
                      )}

                      {/* Status */}
                      <div className="shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground bg-secondary/20 whitespace-nowrap">
                          {COLUMNS.find(c => c.id === lead.status)?.title}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {rankingLeads.length === 0 && (
                  <div className="text-center py-16 text-muted-foreground">
                    <Trophy className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p>Nenhum lead encontrado com os filtros selecionados.</p>
                  </div>
                )}
              </div>

              {rankingLeads.length > rankLimit && (
                <div className="flex justify-center">
                  <button
                    onClick={() => setRankLimit(l => l + 50)}
                    className="px-6 py-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-lg hover:border-primary/40 transition-colors"
                  >
                    Ver mais {Math.min(50, rankingLeads.length - rankLimit)} de {(rankingLeads.length - rankLimit).toLocaleString('pt-BR')} restantes
                  </button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* === EMAIL VIEW INBOX === */}
          <TabsContent value="email" className="m-0 focus-visible:outline-none mt-4 border-t border-border w-full min-h-[600px]">
            <div className="flex flex-col md:flex-row w-full h-full min-h-[600px]">
              {/* Esquerda: Lista de Emails */}
              <div className="w-full md:w-1/3 min-w-[300px] border-r border-border bg-card flex flex-col h-full md:min-h-[600px]">
                <div className="p-4 border-b border-border flex justify-between items-center bg-muted/10 h-[64px]">
                  <h3 className="font-semibold text-sm text-foreground">Caixa de Entrada</h3>
                  <Button size="sm" onClick={() => setIsComposingEmail(true)} className="bg-[#a855f7] hover:bg-[#9333ea] text-white cursor-pointer z-10 transition-colors">Nova Mensagem</Button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {fakeEmails.map(email => (
                    <div key={email.id} onClick={() => setIsComposingEmail(false)} className="p-4 border-b border-border cursor-pointer hover:bg-secondary/50 flex gap-3 transition-colors">
                      <div className="mt-1">
                        {email.unread ? <div className="w-2 h-2 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.8)]" /> : <Mail className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${email.unread ? 'font-bold text-foreground' : 'font-medium text-foreground/80'}`}>E-mail mock)</p>
                        <p className="text-xs text-muted-foreground truncate">{email.title}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium">{email.date}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Direita: Visão do Email Vazio ou Selecionado */}
              <div className="flex-1 bg-muted/10 flex flex-col w-full h-full md:min-h-[600px]">
                {isComposingEmail ? (
                  <div className="p-6 flex flex-col w-full h-full max-w-4xl mx-auto bg-background animate-in fade-in zoom-in-95 duration-200 shadow-sm border border-border">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2"><Send className="w-5 h-5 text-primary" /> Nova Mensagem</h2>
                      <Button variant="ghost" size="sm" onClick={() => setIsComposingEmail(false)}><XCircle className="w-4 h-4 mr-2" /> Cancelar</Button>
                    </div>
                    <div className="space-y-4 flex-1 flex flex-col">
                      <Input
                        placeholder="Para: email@cliente.com"
                        className="bg-card font-medium"
                      />
                      <Input
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="Assunto da mensagem"
                        className="bg-card font-medium"
                      />
                      <Textarea
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        placeholder="Escreva sua mensagem aqui..."
                        className="flex-1 min-h-[300px] bg-card resize-none p-4 leading-relaxed"
                      />
                      <div className="flex justify-end mt-4">
                        <Button onClick={handleSendEmail} className="bg-primary text-primary-foreground font-semibold px-8 py-4">Enviar Email</Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground m-auto p-12">
                    <Mail className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-xl font-semibold text-foreground">Nenhuma mensagem selecionada</h3>
                    <p className="text-sm mt-2 max-w-sm mx-auto leading-relaxed">Selecione uma mensagem na caixa de entrada à esquerda ou clique em "Nova Mensagem" para enviar um e-mail.</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* === ABA CALENDARIO (AGENDA DO DIA E REUNIÕES ) === */}
          <TabsContent value="calendario" className="m-0 focus-visible:outline-none p-6 mt-4">
            <div className="w-full max-w-6xl mx-auto">
              <div className="flex flex-col md:flex-row gap-8">
                {/* Lateral Esquerda - DatePicker Nav */}
                <div className="w-full md:w-[320px] flex-shrink-0 space-y-6">
                  <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                    <CalendarUI
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      className="rounded-md mx-auto"
                    />
                  </div>
                  <div className="bg-secondary/20 border border-border rounded-xl p-6 shadow-sm">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                       <LineChart className="w-4 h-4 text-primary" /> Resumo do Dia
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Follow-ups</span>
                        <span className="font-bold text-foreground">
                           {leads.filter(l => l.score > 70 && l.status !== 'ganho' && l.status !== 'perdido').length}
                        </span>
                      </div>
                       <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Leads Novos</span>
                        <span className="font-bold text-green-500">
                          {leads.filter(l => l.status === 'triagem').length}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lateral Direita - Timeline da Agenda */}
                <div className="flex-1 bg-card rounded-xl border border-border shadow-sm flex flex-col min-h-[500px]">
                  <div className="p-5 border-b border-border flex justify-between items-center bg-card rounded-t-xl">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">Agenda Diária</h2>
                      <p className="text-muted-foreground text-sm mt-0.5">
                        {date ? date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Selecione uma data'}
                      </p>
                    </div>
                    <Button size="sm" className="bg-primary text-primary-foreground gap-2">
                      <Plus className="w-4 h-4" /> Novo Agendamento
                    </Button>
                  </div>
                  <div className="p-5 bg-background rounded-b-xl">
                    <div className="space-y-3">
                      {leads.filter(l => l.status !== 'ganho' && l.status !== 'perdido').slice(0, 10).map(lead => (
                        <div key={lead.id} className="group flex gap-4 p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-md transition-all cursor-pointer" onClick={() => handleCardClick(lead)}>
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center text-primary font-bold text-sm">
                            {lead.temWpp ? '📱' : '📞'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2">
                              <h3 className="font-semibold text-foreground text-sm truncate">{lead.name}</h3>
                              <Badge variant="outline" className={`shrink-0 text-xs ${lead.score > 80 ? 'text-orange-500 border-orange-500' : ''}`}>Score {lead.score}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 truncate">{lead.faturamento ? `💰 ${lead.faturamento}` : lead.summary || 'Necessita contato e nutrição.'}</p>
                            {lead.whatsapp && <p className="text-xs text-green-400 mt-0.5">📱 {lead.whatsapp}</p>}
                          </div>
                        </div>
                      ))}
                      {leads.filter(l => l.status !== 'ganho' && l.status !== 'perdido').length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">Nenhum follow-up pendente.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="painel" className="m-0 focus-visible:outline-none p-4 md:p-8 pb-12">
            <div className="w-full max-w-7xl mx-auto space-y-6">

              {/* Header + filtro de período */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Visão Geral do Funil</h2>
                  <p className="text-muted-foreground text-sm">
                    {panelPeriod === '30d' ? 'Últimos 30 dias' : panelPeriod === '90d' ? 'Últimos 90 dias' : panelPeriod === 'year' ? 'Este ano' : 'Todos os leads'}
                    {' '}— {panelLeads.length.toLocaleString('pt-BR')} leads no período
                  </p>
                </div>
                <div className="flex bg-secondary/50 rounded-lg p-1 gap-0.5">
                  {([['30d','30 dias'],['90d','90 dias'],['year','Este Ano'],['all','Todos']] as const).map(([val, label]) => (
                    <Button key={val} variant="ghost" size="sm"
                      className={`text-xs h-7 px-3 ${panelPeriod === val ? 'bg-background shadow-sm' : ''}`}
                      onClick={() => setPanelPeriod(val)}>{label}</Button>
                  ))}
                </div>
              </div>

              {/* Métricas principais */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { title: 'Total no Período', value: panelLeads.length, icon: UserCircle, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                  { title: 'Qualificados', value: panelLeads.filter(l => l.status === 'qualificado').length, icon: Sparkles, color: 'text-orange-500', bg: 'bg-orange-500/10' },
                  { title: 'Em Negociação', value: panelLeads.filter(l => l.status === 'negociacao').length, icon: Clock, color: 'text-purple-500', bg: 'bg-purple-500/10' },
                  { title: 'Vendas Ganhas', value: panelLeads.filter(l => l.status === 'ganho').length, icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10' },
                ].map((m, i) => (
                  <Card key={i} className="border-border shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground tracking-wide mb-1">{m.title}</p>
                          <p className="text-3xl font-bold text-foreground">{m.value.toLocaleString('pt-BR')}</p>
                        </div>
                        <div className={`w-10 h-10 rounded-full ${m.bg} flex items-center justify-center shrink-0`}>
                          <m.icon className={`w-5 h-5 ${m.color}`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Funil + Conversão */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="border-border shadow-sm">
                  <CardContent className="p-6 flex flex-col items-center text-center">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 w-full text-left">Taxa de Conversão</h3>
                    <div className="relative w-36 h-36 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path className="text-secondary/50 stroke-current" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path className="text-green-500 stroke-current" strokeWidth="3" strokeDasharray={`${panelLeads.length > 0 ? Math.round((panelLeads.filter(l=>l.status==='ganho').length/panelLeads.length)*100) : 0}, 100`} fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold">{panelLeads.length > 0 ? Math.round((panelLeads.filter(l=>l.status==='ganho').length/panelLeads.length)*100) : 0}%</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold">Conversão</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-4">De leads para Venda Ganha</p>
                  </CardContent>
                </Card>

                <Card className="col-span-1 lg:col-span-2 border-border shadow-sm">
                  <CardContent className="p-6">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-5">Etapas Pipeline</h3>
                    <div className="space-y-4">
                      {COLUMNS.map(col => {
                        const count = panelLeads.filter(l => l.status === col.id).length;
                        const pct = panelLeads.length > 0 ? Math.round((count/panelLeads.length)*100) : 0;
                        return (
                          <div key={col.id}>
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-sm font-semibold flex items-center gap-2"><col.icon className="w-4 h-4 text-muted-foreground" />{col.title}</span>
                              <span className="text-sm font-bold">{count.toLocaleString('pt-BR')} <span className="text-xs font-normal text-muted-foreground">({pct}%)</span></span>
                            </div>
                            <div className="w-full h-2.5 bg-secondary/50 rounded-full overflow-hidden">
                              <div className={`h-full ${col.bg.replace('/10','')} transition-all duration-500`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Distribuições B2B */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                {/* Tier */}
                <Card className="border-border shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Distribuição por Tier</h3>
                    <div className="space-y-3">
                      {(['A','B','C'] as const).map(tier => {
                        const count = panelLeads.filter(l => l.tier === tier).length;
                        const pct = panelLeads.length > 0 ? Math.round((count/panelLeads.length)*100) : 0;
                        return (
                          <div key={tier}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className={`font-bold ${tier==='A'?'text-red-400':tier==='B'?'text-blue-400':'text-gray-400'}`}>Tier {tier}</span>
                              <span className="text-muted-foreground">{count.toLocaleString('pt-BR')} ({pct}%)</span>
                            </div>
                            <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${tier==='A'?'bg-red-500':tier==='B'?'bg-blue-500':'bg-gray-500'}`} style={{width:`${pct}%`}} />
                            </div>
                          </div>
                        );
                      })}
                      <p className="text-xs text-muted-foreground pt-1">{panelLeads.filter(l => !l.tier).length.toLocaleString('pt-BR')} sem tier</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Temperatura */}
                <Card className="border-border shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Temperatura</h3>
                    <div className="space-y-3">
                      {([['quente','🔥','text-red-400','bg-red-500'],['morno','🌡️','text-orange-400','bg-orange-500'],['frio','❄️','text-blue-400','bg-blue-500']] as const).map(([t, icon, cls, bg]) => {
                        const count = panelLeads.filter(l => l.temperatura === t).length;
                        const pct = panelLeads.length > 0 ? Math.round((count/panelLeads.length)*100) : 0;
                        return (
                          <div key={t}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className={`font-semibold ${cls}`}>{icon} {t}</span>
                              <span className="text-muted-foreground">{count.toLocaleString('pt-BR')} ({pct}%)</span>
                            </div>
                            <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${bg}`} style={{width:`${pct}%`}} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Canais de contato */}
                <Card className="border-border shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Canais Disponíveis</h3>
                    <div className="space-y-3">
                      {[
                        { label: 'Tem WhatsApp', count: panelLeads.filter(l=>l.temWpp).length, color: 'bg-green-500', cls: 'text-green-400' },
                        { label: 'Tem Email', count: panelLeads.filter(l=>l.temEmail).length, color: 'bg-blue-500', cls: 'text-blue-400' },
                        { label: 'Tem Site', count: panelLeads.filter(l=>l.temSite).length, color: 'bg-purple-500', cls: 'text-purple-400' },
                      ].map(({ label, count, color, cls }) => {
                        const pct = panelLeads.length > 0 ? Math.round((count/panelLeads.length)*100) : 0;
                        return (
                          <div key={label}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className={`font-semibold ${cls}`}>{label}</span>
                              <span className="text-muted-foreground">{count.toLocaleString('pt-BR')} ({pct}%)</span>
                            </div>
                            <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${color}`} style={{width:`${pct}%`}} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Top UFs */}
                <Card className="border-border shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Top Estados (UF)</h3>
                    <div className="space-y-2">
                      {Object.entries(
                        panelLeads.reduce((acc, l) => { if (l.uf) acc[l.uf] = (acc[l.uf]||0)+1; return acc; }, {} as Record<string,number>)
                      ).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([uf, count]) => {
                        const pct = panelLeads.length > 0 ? Math.round((count/panelLeads.length)*100) : 0;
                        return (
                          <div key={uf} className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold w-7 text-foreground">{uf}</span>
                            <div className="flex-1 h-2 bg-secondary/50 rounded-full overflow-hidden">
                              <div className="h-full bg-primary/60 rounded-full" style={{width:`${pct}%`}} />
                            </div>
                            <span className="text-xs text-muted-foreground w-10 text-right">{count.toLocaleString('pt-BR')}</span>
                          </div>
                        );
                      })}
                      {panelLeads.filter(l=>!l.uf).length > 0 && (
                        <p className="text-xs text-muted-foreground pt-1">{panelLeads.filter(l=>!l.uf).length.toLocaleString('pt-BR')} sem UF</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

              </div>

              {/* Top leads por rank */}
              <Card className="border-border shadow-sm">
                <CardContent className="p-5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Top 10 Leads por Rank</h3>
                  <div className="divide-y divide-border">
                    {panelLeads.filter(l=>(l.rankScore??0)>0).sort((a,b)=>(a.rankScore??0)-(b.rankScore??0)).slice(0,10).map((lead, i) => (
                      <div key={lead.id} className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-muted/20 rounded px-1 transition-colors" onClick={()=>handleCardClick(lead)}>
                        <span className="text-xs font-bold text-muted-foreground w-5 text-right">#{lead.rankScore}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{lead.name}</p>
                          <p className="text-xs text-muted-foreground">{[lead.municipio, lead.uf].filter(Boolean).join(' · ')}{lead.faturamento ? ` · 💰 ${lead.faturamento}` : ''}</p>
                        </div>
                        {lead.tier && <span className={`text-xs font-bold px-1.5 py-0.5 rounded border shrink-0 ${lead.tier==='A'?'bg-red-500/10 text-red-400 border-red-500/30':lead.tier==='B'?'bg-blue-500/10 text-blue-400 border-blue-500/30':'bg-gray-500/10 text-gray-400 border-gray-500/30'}`}>{lead.tier}</span>}
                        <span className={`text-xs font-bold shrink-0 ${getScoreColor(lead.score)}`}>🔥{lead.score}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

            </div>
          </TabsContent>

          <TabsContent value="atividades" className="m-0 focus-visible:outline-none p-6 mt-4">
            <div className="w-full max-w-4xl mx-auto space-y-6 pb-12">
              <div className="flex justify-between items-center border-b border-border pb-4 mb-8">
                <div>
                   <h2 className="text-2xl font-bold text-foreground">Log Global de Atividades</h2>
                   <p className="text-muted-foreground text-sm uppercase tracking-wider font-semibold mt-1">Sincronização em tempo real</p>
                </div>
                <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20"><Activity className="w-3 h-3 mr-2 animate-pulse" /> Ativo</Badge>
              </div>
              
              {(() => {
                const allEvents = leads
                  .flatMap(l => {
                    const events: { id: string; type: string; label: string; author: string; leadName: string; content: string; timestampRaw: string; score: number }[] = [];
                    events.push({
                      id: `create-${l.id}`,
                      type: 'system',
                      label: 'Novo Lead Capturado',
                      author: 'Assistente de IA',
                      leadName: l.name,
                      content: `Lead entrou na plataforma com status ${l.status.toUpperCase()}.`,
                      timestampRaw: l.createdAt,
                      score: l.score
                    });
                    if (l.lastInteractionRaw && l.lastInteractionRaw !== l.createdAt) {
                      events.push({
                        id: `update-${l.id}`,
                        type: 'move',
                        label: 'Classificação Atualizada',
                        author: 'Agente n8n',
                        leadName: l.name,
                        content: l.summary || `O lead foi classificado como ${l.status.toUpperCase()} e recebeu tags.`,
                        timestampRaw: l.lastInteractionRaw,
                        score: l.score
                      });
                    }
                    return events;
                  })
                  .sort((a, b) => new Date(b.timestampRaw).getTime() - new Date(a.timestampRaw).getTime());

                const visible = allEvents.slice(0, atividadesLimit);
                const hasMore = allEvents.length > atividadesLimit;

                return (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">{Math.min(atividadesLimit, allEvents.length).toLocaleString('pt-BR')} de {allEvents.length.toLocaleString('pt-BR')} eventos</span>
                    </div>
                    <div className="space-y-6">
                      {visible.map((act) => (
                        <div key={act.id} className="relative pl-8">
                          <div className="absolute left-[15px] top-8 bottom-[-24px] w-0.5 bg-border rounded-full" />
                          <div className="absolute left-0 top-0 w-8 h-8 rounded-full border-4 border-background bg-secondary flex items-center justify-center z-10">
                            {act.type === 'system' && <Bot className="w-3 h-3 text-blue-500" />}
                            {act.type === 'move' && <LayoutGrid className="w-3 h-3 text-orange-500" />}
                          </div>
                          <div className="flex gap-4 items-start bg-card/80 p-5 rounded-xl border border-border shadow-sm hover:border-primary/20 transition-all cursor-default">
                            <div className="flex-1">
                              <div className="flex justify-between items-center mb-2">
                                <span className="font-semibold text-foreground text-sm flex items-center gap-2">
                                  {act.label}
                                  <span className="text-muted-foreground font-normal text-xs px-2 py-0.5 bg-secondary rounded-full">em {act.leadName}</span>
                                </span>
                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                  {formatRelativeTime(act.timestampRaw)}
                                </span>
                              </div>
                              <p className="text-sm text-foreground/80 leading-relaxed bg-background/50 border border-border/50 p-3 rounded-lg mt-2">
                                {act.content}
                              </p>
                              <div className="flex gap-2 mt-3 items-center">
                                <Badge variant="outline" className="text-[10px] uppercase font-semibold text-muted-foreground border-border bg-transparent">Autoria: {act.author}</Badge>
                                <div className={`text-[10px] font-bold ${act.score > 70 ? 'text-orange-500' : 'text-blue-500'}`}>
                                  Score Atual: {act.score}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {leads.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                          Nenhuma atividade registrada no momento.
                        </div>
                      )}
                    </div>

                    {hasMore && (
                      <div className="mt-6 flex justify-center">
                        <button
                          onClick={() => setAtividadesLimit(l => l + 50)}
                          className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground"
                        >
                          Ver mais {Math.min(50, allEvents.length - atividadesLimit)} de {(allEvents.length - atividadesLimit).toLocaleString('pt-BR')} restantes
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </TabsContent>

        </Tabs>
      </div>

      {/* MODAL DETALHES DO CARD */}
      <Sheet open={isSheetOpen} onOpenChange={(open) => { setIsSheetOpen(open); if (!open) cancelEdit(); }}>
        <SheetContent className="sm:max-w-xl w-full border-l border-border p-0 flex flex-col bg-background">
          {selectedLead && (
            <>
              {/* Header */}
              <SheetHeader className="p-4 border-b border-border bg-card/50 shrink-0">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-base font-bold leading-tight truncate">{selectedLead.name}</SheetTitle>
                    {selectedLead.cnpj && <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{selectedLead.cnpj}</p>}
                    <SheetDescription asChild>
                      <div className="flex items-center gap-2 mt-2">
                        <Select value={selectedLead.status} onValueChange={(v) => handleUpdateStage(selectedLead.id, v as LeadStatus)}>
                          <SelectTrigger className="w-[160px] h-7 text-xs bg-background"><SelectValue /></SelectTrigger>
                          <SelectContent>{COLUMNS.map(col => <SelectItem key={col.id} value={col.id}><span className="flex items-center gap-2"><col.icon className="w-3 h-3" />{col.title}</span></SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </SheetDescription>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {canEdit && !isEditing && (
                      <Button variant="outline" size="sm" onClick={startEdit} className="h-8 text-xs gap-1.5">
                        <Pencil className="w-3.5 h-3.5" /> Editar
                      </Button>
                    )}
                    {isEditing && (
                      <>
                        <Button variant="ghost" size="sm" onClick={cancelEdit} className="h-8 text-xs text-muted-foreground">Cancelar</Button>
                        <Button size="sm" onClick={handleSaveLead} disabled={isSaving} className="h-8 text-xs gap-1.5">
                          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Salvar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </SheetHeader>

              {/* Corpo */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-5 space-y-6">

                  {isEditing && editDraft ? (
                    /* ══ MODO EDIÇÃO ══ */
                    <div className="space-y-5">

                      {/* Identificação */}
                      <div>
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Identificação</h3>
                        <div className="grid grid-cols-2 gap-2.5">
                          {[
                            { label: 'Razão Social', field: 'razaoSocial' as keyof Lead },
                            { label: 'Nome Fantasia', field: 'nomeFantasia' as keyof Lead },
                            { label: 'Decisor', field: 'decisor' as keyof Lead },
                            { label: 'CNPJ', field: 'cnpj' as keyof Lead },
                          ].map(({ label, field }) => (
                            <div key={field} className={field === 'razaoSocial' ? 'col-span-2' : ''}>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{label}</label>
                              <Input className="h-8 text-sm" value={String(editDraft[field] ?? '')} onChange={e => setDraft(field, e.target.value)} />
                            </div>
                          ))}
                          <div>
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Tier</label>
                            <Select value={editDraft.tier || ''} onValueChange={v => setDraft('tier', v)}>
                              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent><SelectItem value="A">A</SelectItem><SelectItem value="B">B</SelectItem><SelectItem value="C">C</SelectItem></SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Temperatura</label>
                            <Select value={editDraft.temperatura || 'frio'} onValueChange={v => setDraft('temperatura', v)}>
                              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="quente">🔥 Quente</SelectItem><SelectItem value="morno">🌡️ Morno</SelectItem><SelectItem value="frio">❄️ Frio</SelectItem></SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Localização */}
                      <div>
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Localização</h3>
                        <div className="grid grid-cols-2 gap-2.5">
                          {[
                            { label: 'UF', field: 'uf' as keyof Lead },
                            { label: 'Município', field: 'municipio' as keyof Lead },
                            { label: 'Bairro', field: 'bairro' as keyof Lead },
                            { label: 'CEP', field: 'cep' as keyof Lead },
                          ].map(({ label, field }) => (
                            <div key={field}>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{label}</label>
                              <Input className="h-8 text-sm" value={String(editDraft[field] ?? '')} onChange={e => setDraft(field, e.target.value)} />
                            </div>
                          ))}
                          <div className="col-span-2">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Endereço</label>
                            <Input className="h-8 text-sm" value={editDraft.endereco || ''} onChange={e => setDraft('endereco', e.target.value)} />
                          </div>
                        </div>
                      </div>

                      {/* Dados Comerciais */}
                      <div>
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Dados Comerciais</h3>
                        <div className="grid grid-cols-2 gap-2.5">
                          {[
                            { label: 'Faturamento', field: 'faturamento' as keyof Lead },
                            { label: 'Funcionários', field: 'numFuncionarios' as keyof Lead },
                            { label: 'Porte', field: 'porte' as keyof Lead },
                            { label: 'Regime', field: 'regime' as keyof Lead },
                            { label: 'Score', field: 'score' as keyof Lead },
                            { label: 'Origem', field: 'origem' as keyof Lead },
                          ].map(({ label, field }) => (
                            <div key={field}>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{label}</label>
                              <Input className="h-8 text-sm" value={String(editDraft[field] ?? '')} onChange={e => setDraft(field, field === 'score' ? Number(e.target.value) : e.target.value)} />
                            </div>
                          ))}
                          <div className="col-span-2">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">CNAE</label>
                            <Input className="h-8 text-sm" value={editDraft.cnae || ''} onChange={e => setDraft('cnae', e.target.value)} />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Chance de Contato</label>
                            <Select value={editDraft.chanceContato || ''} onValueChange={v => setDraft('chanceContato', v)}>
                              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent><SelectItem value="Alta">Alta</SelectItem><SelectItem value="Regular">Regular</SelectItem><SelectItem value="Baixa">Baixa</SelectItem></SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Contatos */}
                      <div>
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Contatos</h3>
                        <div className="grid grid-cols-2 gap-2.5">
                          {[
                            { label: 'WhatsApp', field: 'whatsapp' as keyof Lead },
                            { label: 'Telefone', field: 'telefone' as keyof Lead },
                            { label: 'Email', field: 'email' as keyof Lead },
                            { label: 'Site', field: 'site' as keyof Lead },
                            { label: 'Instagram', field: 'instagram' as keyof Lead },
                            { label: 'LinkedIn', field: 'linkedin' as keyof Lead },
                          ].map(({ label, field }) => (
                            <div key={field} className={field === 'email' || field === 'site' ? 'col-span-2' : ''}>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{label}</label>
                              <Input className="h-8 text-sm" value={String(editDraft[field] ?? '')} onChange={e => setDraft(field, e.target.value)} />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Qualificação IA */}
                      <div>
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Qualificação / Resumo</h3>
                        <Textarea className="min-h-[80px] text-sm resize-none" value={editDraft.summary || ''} onChange={e => setDraft('summary', e.target.value)} />
                      </div>
                    </div>
                  ) : (
                    /* ══ MODO LEITURA ══ */
                    <div className="space-y-5">

                      {/* Identificação */}
                      <div>
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Identificação</h3>
                        <div className="grid grid-cols-2 gap-2">
                          {selectedLead.nomeFantasia && <InfoField label="Nome Fantasia" value={selectedLead.nomeFantasia} span={2} />}
                          {selectedLead.decisor && <InfoField label="Decisor" value={selectedLead.decisor} span={2} />}
                          {selectedLead.cnpj && <InfoField label="CNPJ" value={selectedLead.cnpj} mono />}
                          <div className="flex gap-1.5 items-center col-span-1">
                            {selectedLead.tier && <span className={`text-xs font-bold px-2 py-0.5 rounded border ${selectedLead.tier === 'A' ? 'bg-red-500/10 text-red-400 border-red-500/30' : selectedLead.tier === 'B' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-gray-500/10 text-gray-400 border-gray-500/30'}`}>{selectedLead.tier}</span>}
                            {selectedLead.temperatura && <span className={`text-xs px-2 py-0.5 rounded border ${selectedLead.temperatura === 'quente' ? 'bg-red-500/10 text-red-400 border-red-500/30' : selectedLead.temperatura === 'morno' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' : 'bg-blue-500/10 text-blue-400 border-blue-500/30'}`}>{selectedLead.temperatura === 'quente' ? '🔥' : selectedLead.temperatura === 'morno' ? '🌡️' : '❄️'} {selectedLead.temperatura}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Localização */}
                      {(selectedLead.municipio || selectedLead.uf || selectedLead.bairro || selectedLead.endereco || selectedLead.cep) && (
                        <div>
                          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Localização</h3>
                          <div className="grid grid-cols-2 gap-2">
                            {selectedLead.municipio && <InfoField label="Município" value={selectedLead.municipio} />}
                            {selectedLead.uf && <InfoField label="UF" value={selectedLead.uf} />}
                            {selectedLead.bairro && <InfoField label="Bairro" value={selectedLead.bairro} span={2} />}
                            {selectedLead.endereco && <InfoField label="Endereço" value={selectedLead.endereco} span={2} />}
                            {selectedLead.cep && <InfoField label="CEP" value={selectedLead.cep} mono />}
                          </div>
                        </div>
                      )}

                      {/* Dados Comerciais */}
                      <div>
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Dados Comerciais</h3>
                        <div className="grid grid-cols-2 gap-2">
                          {selectedLead.faturamento && <InfoField label="Faturamento" value={`💰 ${selectedLead.faturamento}`} span={2} />}
                          {selectedLead.numFuncionarios && <InfoField label="Funcionários" value={`👥 ${selectedLead.numFuncionarios}`} />}
                          {selectedLead.porte && <InfoField label="Porte" value={selectedLead.porte} />}
                          {selectedLead.regime && <InfoField label="Regime" value={selectedLead.regime} span={2} />}
                          {selectedLead.cnae && <InfoField label="CNAE" value={selectedLead.cnae} span={2} />}
                          {selectedLead.chanceContato && <InfoField label="Chance Contato" value={`📊 ${selectedLead.chanceContato}`} />}
                          <InfoField label="Score IA" value={`🔥 ${selectedLead.score}/100`} />
                          {selectedLead.origem && <InfoField label="Origem" value={selectedLead.origem} span={2} />}
                        </div>
                      </div>

                      {/* Contatos */}
                      {(selectedLead.whatsapp || selectedLead.telefone || selectedLead.email || selectedLead.site || selectedLead.instagram || selectedLead.linkedin) && (
                        <div>
                          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Contatos</h3>
                          <div className="grid grid-cols-2 gap-2">
                            {selectedLead.whatsapp && <InfoField label="WhatsApp" value={`📱 ${selectedLead.whatsapp}`} green />}
                            {selectedLead.telefone && <InfoField label="Telefone" value={`📞 ${selectedLead.telefone}`} />}
                            {selectedLead.email && <InfoField label="Email" value={`✉️ ${selectedLead.email}`} span={2} />}
                            {selectedLead.site && <InfoField label="Site" value={`🌐 ${selectedLead.site}`} span={2} />}
                            {selectedLead.instagram && <InfoField label="Instagram" value={`📸 ${selectedLead.instagram}`} />}
                            {selectedLead.linkedin && <InfoField label="LinkedIn" value={`💼 ${selectedLead.linkedin}`} />}
                          </div>
                        </div>
                      )}

                      {/* Tags */}
                      <div>
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Tags</h3>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {selectedLead.tags.map(tag => (
                            <span key={tag} className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 group">
                              {tag}
                              <button onClick={() => handleRemoveTag(selectedLead.id, tag)} className="opacity-50 group-hover:opacity-100 hover:text-red-500 transition-opacity">
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          ))}
                          {selectedLead.tags.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma tag.</p>}
                        </div>
                        <div className="flex gap-2 max-w-xs">
                          <Select value={newTag} onValueChange={setNewTag}>
                            <SelectTrigger className="h-8 text-xs bg-background flex-1"><SelectValue placeholder="Adicionar tag..." /></SelectTrigger>
                            <SelectContent>{AVAILABLE_TAGS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                          </Select>
                          <Button size="sm" variant="secondary" className="h-8 px-2" onClick={() => handleAddTag(selectedLead.id)}><Plus className="w-4 h-4" /></Button>
                        </div>
                      </div>

                      {/* Qualificação IA */}
                      {selectedLead.summary && (
                        <div>
                          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><Bot className="w-3.5 h-3.5" /> Qualificação da IA</h3>
                          <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg">
                            <p className="text-sm leading-relaxed text-foreground/90">{selectedLead.summary}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Atividade & Comentários — sempre visível */}
                  <div className="space-y-4 border-t border-border pt-5 pb-8">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Atividade & Comentários</h3>
                    <div className="flex gap-3 items-start">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                        <UserCircle className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <Textarea placeholder="Adicione um comentário interno..." className="min-h-[72px] bg-secondary/20 border-border resize-none text-sm" value={newComment} onChange={e => setNewComment(e.target.value)} />
                        <div className="flex justify-end">
                          <Button size="sm" onClick={handleAddComment} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                            <Send className="w-3 h-3" /> Salvar
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3 pl-4 border-l-2 border-border ml-3">
                      {selectedLead.activities.map(act => (
                        <div key={act.id} className="relative pl-6">
                          <div className="absolute -left-[29px] top-1 w-4 h-4 rounded-full border-2 border-background bg-secondary flex items-center justify-center">
                            {act.type === 'comment' && <MessageSquare className="w-2 h-2 text-primary" />}
                            {act.type === 'move' && <LayoutGrid className="w-2 h-2 text-orange-500" />}
                            {act.type === 'system' && <Bot className="w-2 h-2 text-blue-500" />}
                          </div>
                          <div className="bg-secondary/40 p-3 rounded-lg border border-border">
                            <div className="flex justify-between items-start mb-1.5">
                              <span className="text-xs font-semibold text-foreground">{act.author}</span>
                              <span className="text-[10px] text-muted-foreground">{act.timestamp}</span>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">{act.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ImportLeadsModal
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        botId={selectedBot?.id || ''}
        onImported={fetchLeads}
      />
    </div>
  );
}
