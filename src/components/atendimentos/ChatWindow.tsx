import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, Image, File, Check, CheckCheck, ChevronLeft, MoreVertical } from 'lucide-react';
import { Message, Conversation } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format, isSameDay, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChatWindowProps {
  conversation: Conversation | null;
  messages: Message[];
  onSendMessage: (content: string, type: Message['type']) => void;
  isLoading?: boolean;
  onBack?: () => void;
  onOpenContact?: () => void;
}

export function ChatWindow({
  conversation,
  messages,
  onSendMessage,
  isLoading,
  onBack,
  onOpenContact,
}: ChatWindowProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim(), 'text');
      setInputValue('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getStatusIcon = (status: Message['status']) => {
    switch (status) {
      case 'sent':
        return <Check className="w-3 h-3 text-muted-foreground" />;
      case 'delivered':
        return <CheckCheck className="w-3 h-3 text-muted-foreground" />;
      case 'read':
        return <CheckCheck className="w-3 h-3 text-primary" />;
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <Send className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            Selecione uma conversa
          </h3>
          <p className="text-sm text-muted-foreground">
            Escolha uma conversa da lista para começar
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      <div className="h-16 border-b border-border px-4 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden shrink-0 -ml-2">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
            <span className="text-lg font-semibold text-muted-foreground">
              {conversation.contactName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <h2 className="font-medium text-foreground truncate">{conversation.contactName}</h2>
            <p className="text-sm text-muted-foreground truncate">{conversation.contactPhone}</p>
          </div>
        </div>
        {onOpenContact && (
          <Button variant="ghost" size="icon" onClick={onOpenContact} className="lg:hidden shrink-0 -mr-2">
            <MoreVertical className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}
              >
                <div className="animate-pulse">
                  <div className="h-12 bg-muted rounded-2xl w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          messages.map((msg, index) => {
            const previousMsg = index > 0 ? messages[index - 1] : null;
            const showDateSeparator = !previousMsg || !isSameDay(msg.timestamp, previousMsg.timestamp);
            
            let dateSeparatorText = '';
            if (showDateSeparator) {
              if (isToday(msg.timestamp)) {
                dateSeparatorText = 'Hoje';
              } else if (isYesterday(msg.timestamp)) {
                dateSeparatorText = 'Ontem';
              } else {
                dateSeparatorText = format(msg.timestamp, "d 'de' MMMM", { locale: ptBR });
              }
            }

            return (
              <div key={msg.id} className="flex flex-col">
                {showDateSeparator && (
                  <div className="flex justify-center my-4">
                    <span className="text-xs font-medium bg-muted/50 text-muted-foreground px-3 py-1 rounded-full shadow-sm">
                      {dateSeparatorText}
                    </span>
                  </div>
                )}
                <div
                  className={`flex ${msg.sender === 'agent' || msg.sender === 'human' ? 'justify-end' : 'justify-start'} animate-fade-in mb-3`}
                >
                  <div
                    className={`max-w-[70%] px-4 py-2 ${
                      msg.sender === 'agent' || msg.sender === 'human'
                        ? 'chat-bubble-sent'
                        : msg.sender === 'bot'
                        ? 'bg-muted text-foreground rounded-2xl rounded-bl-sm'
                        : 'chat-bubble-received'
                    }`}
                  >
                    {msg.type === 'image' && (
                      <img src={msg.attachmentUrl || msg.content} alt="Imagem" className="max-w-full rounded-lg mb-1" />
                    )}
                    {msg.type === 'audio' && (
                      <audio controls src={msg.attachmentUrl || msg.content} className="max-w-full mb-1" />
                    )}
                    {(msg.type === 'document' || msg.type === 'file' || msg.type === 'pdf') && (
                      <a href={msg.attachmentUrl || msg.content} target="_blank" rel="noreferrer" className="flex items-center gap-2 underline mb-1 font-semibold">
                        <File className="w-4 h-4" /> Documento Anexado
                      </a>
                    )}
                    {msg.type === 'text' && <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>}
                    {!['image', 'audio', 'document', 'file', 'pdf', 'text'].includes(msg.type) && (
                       <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>
                    )}
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[10px] text-chat-timestamp">
                        {format(msg.timestamp, 'HH:mm', { locale: ptBR })}
                      </span>
                      {(msg.sender === 'agent' || msg.sender === 'human') && getStatusIcon(msg.status)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-border p-3 bg-card">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <Paperclip className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <Image className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <File className="w-5 h-5" />
          </Button>

          <Input
            placeholder="Digite uma mensagem..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 bg-secondary border-border"
          />

          {inputValue.trim() ? (
            <Button size="icon" onClick={handleSend}>
              <Send className="w-5 h-5" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Mic className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
