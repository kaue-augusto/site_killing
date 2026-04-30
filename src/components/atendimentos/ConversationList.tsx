import { useState, useEffect } from 'react';
import { Search, Filter } from 'lucide-react';
import { Conversation } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { isToday, isYesterday, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatWhatsAppDate(date: Date) {
  if (isToday(date)) {
    return format(date, 'HH:mm');
  }
  if (isYesterday(date)) {
    return 'Ontem';
  }
  return format(date, 'dd/MM/yyyy');
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (conversation: Conversation) => void;
  isLoading?: boolean;
  className?: string;
}

type FilterType = 'all' | 'pending' | 'mine' | 'unassigned' | 'closed';

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading,
  className,
}: ConversationListProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [width, setWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      setWidth(Math.min(Math.max(e.clientX, 250), 600));
    };
    const handleMouseUp = () => setIsResizing(false);
    
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const pendingCount = conversations.filter(c => c.status === 'pending').length;

  const filters: { key: FilterType; label: React.ReactNode }[] = [
    { key: 'all', label: 'Todas' },
    { 
      key: 'pending', 
      label: (
        <span className="flex items-center gap-1.5">
          Aguardando
          {pendingCount > 0 && (
            <span className="bg-yellow-500 text-white text-[10px] px-1.5 py-0.5 rounded-full leading-none">
              {pendingCount}
            </span>
          )}
        </span>
      ) 
    },
    { key: 'mine', label: 'Minhas' },
    { key: 'unassigned', label: 'Não atribuídas' },
    { key: 'closed', label: 'Encerradas' },
  ];

  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch =
      conv.contactName.toLowerCase().includes(search.toLowerCase()) ||
      conv.contactPhone.includes(search);

    let matchesFilter = true;
    switch (filter) {
      case 'pending':
        matchesFilter = conv.status === 'pending';
        break;
      case 'mine':
        matchesFilter = conv.assignedTo === 'agent-1';
        break;
      case 'unassigned':
        matchesFilter = !conv.assignedTo && conv.status !== 'closed';
        break;
      case 'closed':
        matchesFilter = conv.status === 'closed';
        break;
    }

    return matchesSearch && matchesFilter;
  }).sort((a, b) => {
    // pending always first
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    // then by time
    return b.lastMessageTime.getTime() - a.lastMessageTime.getTime();
  });

  return (
    <div 
      className={`border-r border-border flex flex-col bg-card relative shrink-0 w-full md:w-[var(--list-width)] ${className || ''}`}
      style={{ '--list-width': `${width}px` } as React.CSSProperties}
    >
      {/* Resizer Handle */}
      <div 
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/50 bg-transparent transition-colors z-20"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
      />
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary border-border"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="p-2 border-b border-border flex gap-1 overflow-x-auto">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filter === f.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <p>Nenhuma conversa encontrada</p>
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv)}
              className={`w-full p-3 flex gap-3 text-left transition-colors border-b border-border hover:bg-secondary ${
                selectedId === conv.id ? 'bg-secondary' : ''
              }`}
            >
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                {conv.avatarUrl ? (
                  <img src={conv.avatarUrl} alt={conv.contactName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-semibold text-muted-foreground">
                    {conv.contactName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground truncate flex items-center gap-2">
                    {conv.contactName}
                    {conv.status === 'pending' && (
                      <span className="px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500 text-[10px] font-bold uppercase tracking-wider">
                        Aguardando
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatWhatsAppDate(conv.lastMessageTime)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                    {conv.lastMessage}
                  </p>
                  {conv.unreadCount > 0 && (
                    <span className="status-badge bg-primary text-primary-foreground">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
