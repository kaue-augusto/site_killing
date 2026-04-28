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
  Filter, ArrowUpDown, Trash2, Loader2
} from 'lucide-react';
import { useBot } from '@/contexts/BotContext';
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
  createdAt: string; // ISO format date string for filtering
  email?: string;
  activities: ActivityLog[];
}

type FilterOperator = 'equals' | 'greater' | 'less';
export interface FilterCondition {
  id: string;
  field: 'createdAt' | 'score';
  operator: FilterOperator;
  value: string;
}

const VALID_STATUSES: LeadStatus[] = ['triagem', 'qualificado', 'negociacao', 'ganho', 'perdido'];

function mapDbToLead(row: any): Lead {
  return {
    id: row.id,
    name: row.contact_name || 'Sem nome',
    phone: row.contact_phone || '',
    status: VALID_STATUSES.includes(row.status) ? row.status : 'triagem',
    score: row.score ?? 0,
    tags: Array.isArray(row.tags) ? row.tags : [],
    summary: row.summary || '',
    lastInteraction: formatRelativeTime(row.last_interaction),
    lastInteractionRaw: row.last_interaction || new Date(row.created_at || Date.now()).toISOString(),
    createdAt: row.created_at || new Date().toISOString(),
    activities: [],
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

export default function CRM() {
  const { selectedBot } = useBot();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const fetchLeads = useCallback(async () => {
    if (!selectedBot?.id) { setIsLoading(false); return; }
    setIsLoading(true);
    const { data } = await (supabase as any)
      .from('crm_leads')
      .select('*')
      .eq('bot_id', selectedBot.id)
      .order('last_interaction', { ascending: false });
    if (data) setLeads(data.map(mapDbToLead));
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

  // --- Filters and Sorting State ---
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [sortConfig, setSortConfig] = useState<{ field: string, direction: 'asc' | 'desc' } | null>(null);

  const addFilter = () => {
    setFilters([...filters, { id: Date.now().toString(), field: 'createdAt', operator: 'equals', value: '' }]);
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  const updateFilter = (id: string, updates: Partial<FilterCondition>) => {
    setFilters(filters.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const availableDatePresets = [
    { label: 'Hoje', val: 'today' },
    { label: 'Este Mês', val: 'this_month' },
    { label: 'Este Ano', val: 'this_year' },
    { label: 'Último Ano', val: 'last_year' }
  ];

  // Helper date logic
  const leadPassesFilters = (lead: Lead) => {
    if (filters.length === 0) return true;
    return filters.every(filter => {
      if (filter.field === 'createdAt') {
        const leadDate = new Date(lead.createdAt);
        const today = new Date();
        if (filter.value === 'today') {
          return leadDate.toDateString() === today.toDateString();
        } else if (filter.value === 'this_month') {
          return leadDate.getMonth() === today.getMonth() && leadDate.getFullYear() === today.getFullYear();
        } else if (filter.value === 'this_year') {
          return leadDate.getFullYear() === today.getFullYear();
        } else if (filter.value === 'last_year') {
          return leadDate.getFullYear() === today.getFullYear() - 1;
        }
        return true; // Fallback if no valid condition set
      }
      return true;
    });
  };

  const processedLeads = leads
    .filter(l =>
      (l.name.toLowerCase().includes(searchTerm.toLowerCase()) || l.phone.includes(searchTerm)) &&
      leadPassesFilters(l)
    )
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

  // States Modal (Sheet)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [newTag, setNewTag] = useState('');

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
        <h1 className="text-xl font-bold flex items-center gap-2 mb-4">
          Controle de Clientes
          <span className="text-xs font-normal bg-primary/20 text-primary px-2 py-0.5 rounded-full">Bot: {selectedBot?.name || 'Geral'}</span>
        </h1>

        <Tabs defaultValue="kanban" className="w-full">
          <TabsList className="bg-transparent h-auto p-0 gap-6 border-b border-border w-full justify-start rounded-none flex-wrap">
            <TabsTrigger value="kanban" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-3 flex items-center gap-2 text-muted-foreground data-[state=active]:text-foreground">
              <LayoutGrid className="w-4 h-4" /> Kanban
            </TabsTrigger>
            <TabsTrigger value="lista" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-3 flex items-center gap-2 text-muted-foreground data-[state=active]:text-foreground">
              <List className="w-4 h-4" /> Lista
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

          {/* === GLOBAL CONTROLS (SEARCH, FILTERS, SORT) === */}
          <div className="p-3 flex flex-col md:flex-row justify-between md:items-center gap-3 bg-card border-b border-border shadow-sm">
            <div className="flex flex-wrap items-center gap-2 w-full">

              {/* FILTERS POPOVER */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={filters.length > 0 ? "default" : "outline"} size="sm" className={`h-8 text-xs ${filters.length > 0 ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-background hover:bg-muted'}`}>
                    <Filter className="w-3.5 h-3.5 mr-2" />
                    {filters.length > 0 ? `Filtrando por ${filters.length} itens` : 'Filtrar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[450px] p-4 bg-background border-border shadow-lg" align="start">
                  <div className="space-y-4">
                    {filters.map((filter) => (
                      <div key={filter.id} className="flex items-center gap-2">
                        <Select value={filter.field} onValueChange={(val) => updateFilter(filter.id, { field: val as any })}>
                          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="createdAt">Data de Criação</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select value={filter.operator} onValueChange={(val) => updateFilter(filter.id, { operator: val as any })}>
                          <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equals">Igual a</SelectItem>
                          </SelectContent>
                        </Select>

                        {filter.field === 'createdAt' ? (
                          <Select value={filter.value} onValueChange={(val) => updateFilter(filter.id, { value: val })}>
                            <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="Selecione data" /></SelectTrigger>
                            <SelectContent>
                              {availableDatePresets.map(dp => (
                                <SelectItem key={dp.val} value={dp.val}>{dp.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            className="flex-1 h-8 text-xs bg-background"
                            value={filter.value}
                            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                            placeholder="Valor..."
                          />
                        )}

                        <Button variant="ghost" size="icon" onClick={() => removeFilter(filter.id)} className="h-8 w-8 text-muted-foreground hover:bg-red-500/10 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}

                    <div className="flex items-center justify-between mt-4 border-t border-border pt-4">
                      <Button variant="ghost" size="sm" onClick={addFilter} className="text-xs text-muted-foreground hover:text-foreground">
                        <Plus className="w-4 h-4 mr-1" /> Adicionar condição
                      </Button>
                      <div className="flex items-center gap-2">
                        {filters.length > 0 && (
                          <Button variant="ghost" size="sm" onClick={() => setFilters([])} className="text-xs text-muted-foreground hover:text-foreground">
                            <Trash2 className="w-3 h-3 mr-1" /> Limpar Tudo
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* SORTING POPOVER */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={sortConfig ? "default" : "outline"} size="sm" className="h-8 text-xs hover:bg-muted bg-background text-foreground">
                    <ArrowUpDown className="w-3.5 h-3.5 mr-2" />
                    {sortConfig ? `Ordenando` : 'Ordenar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-4 bg-background border-border shadow-lg" align="start">
                  <div className="space-y-4">
                    {sortConfig ? (
                      <div className="flex items-center gap-2">
                        <Select value={sortConfig.field} onValueChange={(val) => setSortConfig({ ...sortConfig, field: val })}>
                          <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="createdAt">Data de Criação</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={sortConfig.direction} onValueChange={(val) => setSortConfig({ ...sortConfig, direction: val as any })}>
                          <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="asc">Mais antiga</SelectItem>
                            <SelectItem value="desc">Mais recente</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" onClick={() => setSortConfig(null)} className="h-8 w-8 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSortConfig({ field: 'createdAt', direction: 'desc' })} className="w-full text-xs justify-start h-8">Por Criação (Mais recentes)</Button>
                        <Button variant="outline" size="sm" onClick={() => setSortConfig({ field: 'createdAt', direction: 'asc' })} className="w-full text-xs justify-start h-8">Por Criação (Mais antigos)</Button>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* SEARCH INPUT */}
              <div className="relative w-full md:w-64 ml-auto">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar..."
                  className="pl-8 bg-background border-border h-8 text-xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
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
                                  {columnLeads.map((lead, index) => (
                                    <Draggable key={lead.id} draggableId={lead.id} index={index}>
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          onClick={() => handleCardClick(lead)}
                                        >
                                          <Card className={`cursor-pointer transition-shadow shadow-sm bg-card border-border relative group ${snapshot.isDragging ? 'shadow-lg border-primary ring-1 ring-primary/50' : 'hover:border-primary/50'}`}>
                                            <CardContent className="p-4 flex flex-col gap-3">
                                              <div className="flex justify-between items-start">
                                                <p className="font-semibold text-sm text-foreground">{lead.name}</p>
                                                <div className={`flex items-center gap-1 font-bold text-xs ${getScoreColor(lead.score)}`}>
                                                  🔥 {lead.score}
                                                </div>
                                              </div>
                                              <div className="bg-secondary/50 p-2 rounded text-xs text-muted-foreground border-l-2 border-l-primary/50 relative">
                                                <span className="line-clamp-2 leading-relaxed">{lead.summary}</span>
                                              </div>
                                              <div className="flex flex-wrap gap-1 mt-1">
                                                {lead.tags.map(tag => (
                                                  <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border">
                                                    {tag}
                                                  </span>
                                                ))}
                                              </div>
                                            </CardContent>
                                          </Card>
                                        </div>
                                      )}
                                    </Draggable>
                                  ))}
                                  {provided.placeholder}
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
            <div className="bg-card border border-border rounded-xl shadow-sm w-full overflow-hidden mt-2">
              <div className="overflow-x-auto">
                <table className="w-full text-left align-middle border-collapse table-auto">
                  <thead className="bg-secondary/40 text-muted-foreground border-b border-border text-xs uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-6 py-5">Contato</th>
                      <th className="px-6 py-5">Telefone</th>
                      <th className="px-6 py-5">Etapa / Funil</th>
                      <th className="px-6 py-5">Score IA</th>
                      <th className="px-6 py-5">Tags Resumo</th>
                      <th className="px-6 py-5 text-right w-24">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-background">
                    {processedLeads.map(lead => (
                      <tr key={lead.id} className="hover:bg-muted/30 cursor-pointer transition-colors group" onClick={() => handleCardClick(lead)}>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm border border-primary/20">
                              {lead.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground text-sm">{lead.name}</span>
                              <span className="text-xs text-muted-foreground mt-0.5">{lead.email || 'Sem e-mail cadastrado'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-sm text-muted-foreground font-medium">{lead.phone}</td>
                        <td className="px-6 py-5">
                          <Badge variant="outline" className="bg-secondary/30 text-xs px-2.5 py-1 text-foreground border-border">
                            {COLUMNS.find(c => c.id === lead.status)?.title}
                          </Badge>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-sm ${getScoreColor(lead.score)}`}>🔥 {lead.score}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex gap-1.5 flex-wrap">
                            {lead.tags.slice(0, 3).map(tag => (
                              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border whitespace-nowrap">
                                {tag}
                              </span>
                            ))}
                            {lead.tags.length > 3 && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground">+{lead.tags.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Ver Detalhes</Button>
                        </td>
                      </tr>
                    ))}
                    {leads.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
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
                <div className="flex-1 bg-card rounded-xl border border-border shadow-sm flex flex-col h-[700px]">
                  <div className="p-6 border-b border-border flex justify-between items-center bg-card rounded-t-xl">
                    <div>
                      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                         Agenda Diária
                      </h2>
                      <p className="text-muted-foreground text-sm mt-1">
                        {date ? date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Selecione uma data'}
                      </p>
                    </div>
                    <Button size="sm" className="bg-primary text-primary-foreground gap-2">
                      <Plus className="w-4 h-4" /> Novo Agendamento
                    </Button>
                  </div>
                  <div className="p-6 flex-1 overflow-y-auto custom-scrollbar bg-background rounded-b-xl">
                    <div className="space-y-4">
                      {leads.filter(l => l.status !== 'ganho' && l.status !== 'perdido').slice(0, 5).map((lead, i) => (
                        <div key={lead.id} className="group flex gap-4 p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-md transition-all cursor-pointer" onClick={() => handleCardClick(lead)}>
                           <div className="w-12 h-12 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center text-primary font-bold">
                             {lead.score > 80 ? '🔥' : '📞'}
                           </div>
                           <div className="flex-1">
                             <div className="flex justify-between items-start">
                               <h3 className="font-semibold text-foreground">{lead.name}</h3>
                               <Badge variant="outline" className={lead.score > 80 ? 'text-orange-500 border-orange-500' : ''}>Score {lead.score}</Badge>
                             </div>
                             <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{lead.summary || 'Necessita contato e nutrição.'}</p>
                             <div className="flex gap-2 mt-3">
                                {lead.tags.map(t => <span key={t} className="text-[10px] bg-secondary px-2 py-0.5 rounded text-muted-foreground">{t}</span>)}
                             </div>
                           </div>
                        </div>
                      ))}
                      {leads.filter(l => l.status !== 'ganho' && l.status !== 'perdido').length === 0 && (
                         <div className="text-center py-12 text-muted-foreground">
                            Nenhum follow-up pendente para este dia.
                         </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="painel" className="m-0 focus-visible:outline-none p-4 md:p-8 mt-4">
            <div className="w-full max-w-7xl mx-auto space-y-6">

              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Visão Geral do Funil</h2>
                  <p className="text-muted-foreground text-sm">Resumo da performance do seu CRM e estágios dos contatos.</p>
                </div>
                <div className="flex bg-secondary/50 rounded-lg p-1">
                  <Button variant="ghost" size="sm" className="bg-background shadow-sm text-xs h-7">Últimos 30 dias</Button>
                  <Button variant="ghost" size="sm" className="text-xs h-7">Este Ano</Button>
                </div>
              </div>

              {/* === METRIC CARDS === */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {[
                  { title: 'Total de Leads', value: leads.length, icon: UserCircle, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                  { title: 'Qualificados', value: leads.filter(l => l.status === 'qualificado').length, icon: Sparkles, color: 'text-orange-500', bg: 'bg-orange-500/10' },
                  { title: 'Em Negociação', value: leads.filter(l => l.status === 'negociacao').length, icon: Clock, color: 'text-purple-500', bg: 'bg-purple-500/10' },
                  { title: 'Vendas Ganhas', value: leads.filter(l => l.status === 'ganho').length, icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10' }
                ].map((metric, idx) => (
                  <Card key={idx} className="border-border shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground tracking-wide">{metric.title}</p>
                          <p className="text-3xl font-bold text-foreground">{metric.value}</p>
                        </div>
                        <div className={`w-12 h-12 rounded-full ${metric.bg} flex items-center justify-center flex-shrink-0`}>
                          <metric.icon className={`w-6 h-6 ${metric.color}`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* === FUNNEL & CONVERSION SECTION === */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">

                {/* Taxa de Conversão Chart */}
                <Card className="col-span-1 border-border shadow-sm">
                  <CardContent className="p-6 h-full flex flex-col justify-center items-center text-center">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6 w-full text-left">Taxa de Conversão</h3>
                    <div className="relative w-40 h-40 flex items-center justify-center mt-2">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path className="text-secondary/50 stroke-current" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path className="text-green-500 stroke-current" strokeWidth="3" strokeDasharray={`${leads.length > 0 ? Math.round((leads.filter(l => l.status === 'ganho').length / leads.length) * 100) : 0}, 100`} fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold text-foreground">
                          {leads.length > 0 ? Math.round((leads.filter(l => l.status === 'ganho').length / leads.length) * 100) : 0}%
                        </span>
                        <span className="text-xs text-muted-foreground uppercase font-semibold">Conversão</span>
                      </div>
                    </div>
                    <p className="text-sm text-foreground/80 mt-8 font-medium">De total de leads para Venda Ganha.</p>
                  </CardContent>
                </Card>

                {/* Funnel Progress Bars */}
                <Card className="col-span-1 lg:col-span-2 border-border shadow-sm">
                  <CardContent className="p-6">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">Etapas Pipeline</h3>
                    <div className="space-y-6">
                      {COLUMNS.map((col, index) => {
                        const count = leads.filter(l => l.status === col.id).length;
                        const percentage = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;

                        return (
                          <div key={col.id} className="w-full">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-semibold flex items-center gap-2 text-foreground">
                                <col.icon className="w-4 h-4 text-muted-foreground" /> {col.title}
                              </span>
                              <span className="text-sm font-bold text-foreground">{count} <span className="text-xs font-normal text-muted-foreground ml-1">({percentage}%)</span></span>
                            </div>
                            <div className="w-full h-3 bg-secondary/50 rounded-full overflow-hidden">
                              <div className={`h-full ${col.bg.replace('/10', '')} transition-all duration-500`} style={{ width: `${percentage}%` }}></div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>

              </div>
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
              
              <div className="space-y-6">
                {leads
                  .flatMap(l => {
                    // Mapeia entrada e última atualização para todos os leads para gerar timeline rica
                    const events = [];
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
                  .sort((a, b) => new Date(b.timestampRaw).getTime() - new Date(a.timestampRaw).getTime())
                  .map((act) => (
                    <div key={act.id} className="relative pl-8">
                      {/* Timeline Line Vertical */}
                      <div className="absolute left-[15px] top-8 bottom-[-24px] w-0.5 bg-border rounded-full" />
                      
                      {/* Ícone */}
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
            </div>
          </TabsContent>

        </Tabs>
      </div>

      {/* MODAL DETALHES DO CARD */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-xl w-full border-l border-border p-0 flex flex-col bg-background">
          {selectedLead && (
            <>
              {/* Header do Sheet */}
              <SheetHeader className="p-6 border-b border-border bg-card/50">
                <div className="flex justify-between items-start">
                  <div>
                    <SheetTitle className="text-xl flex items-center gap-2">
                      {selectedLead.name}
                    </SheetTitle>
                    <SheetDescription asChild>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Select
                          value={selectedLead.status}
                          onValueChange={(value) => handleUpdateStage(selectedLead.id, value as LeadStatus)}
                        >
                          <SelectTrigger className="w-[180px] h-8 text-xs bg-background">
                            <SelectValue placeholder="Selecione a etapa" />
                          </SelectTrigger>
                          <SelectContent>
                            {COLUMNS.map(col => (
                              <SelectItem key={col.id} value={col.id}>
                                <span className="flex items-center gap-2">
                                  <col.icon className="w-3 h-3 text-muted-foreground" />
                                  {col.title}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground flex items-center gap-1 ml-2"><Clock className="w-3 h-3" /> Atualizado há pouco</span>
                      </div>
                    </SheetDescription>
                  </div>
                  <Button variant="outline" size="sm" className="flex gap-2 text-primary border-primary/20 hover:bg-primary/10">
                    <Share2 className="w-4 h-4" /> Enviar Info
                  </Button>
                </div>
              </SheetHeader>

              {/* Corpo do Sheet */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-6 space-y-8">

                  {/* Seção 1: Dados do Cliente */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">Informações do Contato</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-secondary/30 p-3 rounded-lg border border-border">
                        <p className="text-xs text-muted-foreground mb-1">Telefone</p>
                        <p className="text-sm font-medium text-foreground">{selectedLead.phone}</p>
                      </div>
                      <div className="bg-secondary/30 p-3 rounded-lg border border-border">
                        <p className="text-xs text-muted-foreground mb-1">E-mail</p>
                        <p className="text-sm font-medium text-foreground">{selectedLead.email || 'Não informado'}</p>
                      </div>
                      <div className="bg-secondary/30 p-3 rounded-lg border border-border">
                        <p className="text-xs text-muted-foreground mb-1">Intenção (Score IA)</p>
                        <p className={`text-sm font-bold flex items-center gap-1 ${getScoreColor(selectedLead.score)}`}>
                          🔥 {selectedLead.score}/100
                        </p>
                      </div>
                      <div className="bg-secondary/30 p-3 rounded-lg border border-border col-span-2">
                        <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Gerenciar Tags do Lead</p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {selectedLead.tags.map(tag => (
                            <span key={tag} className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 group">
                              {tag}
                              <button onClick={() => handleRemoveTag(selectedLead.id, tag)} className="opacity-50 group-hover:opacity-100 hover:text-red-500 transition-opacity">
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2 w-full max-w-sm">
                          <Select value={newTag} onValueChange={(val) => setNewTag(val)}>
                            <SelectTrigger className="h-8 text-xs bg-background flex-1">
                              <SelectValue placeholder="Selecione uma tag..." />
                            </SelectTrigger>
                            <SelectContent>
                              {AVAILABLE_TAGS.map(t => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button size="sm" variant="secondary" className="h-8 px-2" onClick={() => handleAddTag(selectedLead.id)}>
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Seção 2: Resumo da Inteligência Artificial */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                      <Bot className="w-4 h-4" /> Qualificação da IA
                    </h3>
                    <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                      <p className="text-sm leading-relaxed text-foreground/90">{selectedLead.summary}</p>
                    </div>
                  </div>

                  {/* Seção 3: Atividades e Comentários */}
                  <div className="space-y-4 pb-8">
                    <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">Atividade & Comentários</h3>

                    {/* Add Comment */}
                    <div className="flex gap-3 items-start">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                        <UserCircle className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <Textarea
                          placeholder="Adicione um comentário interno..."
                          className="min-h-[80px] bg-secondary/20 border-border resize-none text-sm text-foreground"
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                        />
                        <div className="flex justify-end">
                          <Button size="sm" onClick={handleAddComment} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                            <Send className="w-3 h-3" /> Salvar
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Linha do Tempo */}
                    <div className="mt-6 space-y-4 pl-4 border-l-2 border-border ml-3 pb-8">
                      {selectedLead.activities.map((act) => (
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
    </div>
  );
}
