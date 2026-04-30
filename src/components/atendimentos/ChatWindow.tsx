import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, Image, File, Check, CheckCheck, ChevronLeft, MoreVertical } from 'lucide-react';
import { Message, Conversation } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format, isSameDay, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';

interface ChatWindowProps {
  conversation: Conversation | null;
  messages: Message[];
  onSendMessage: (content: string, type: Message['type'], attachmentUrl?: string) => void;
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
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFileType, setPendingFileType] = useState<Message['type']>('file');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim(), 'text');
      setInputValue('');
    }
  };

  const triggerFileSelect = (type: Message['type']) => {
    setPendingFileType(type);
    fileInputRef.current?.click();
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // Converte para Base64 em vez de fazer upload para bucket
      const base64Data = await fileToBase64(file);
      onSendMessage(file.name, pendingFileType, base64Data);
      
      toast({
        title: 'Sucesso',
        description: 'Arquivo preparado para envio',
      });
    } catch (error: any) {
      toast({
        title: 'Erro no arquivo',
        description: error.message || 'Não foi possível processar o arquivo',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
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
    <div className="flex-1 flex flex-col bg-background w-full min-w-0">
      <div className="h-16 border-b border-border px-4 flex items-center justify-between bg-card shrink-0">
        <div 
          className="flex items-center gap-3 cursor-pointer hover:bg-secondary/50 p-1 rounded-lg transition-colors" 
          onClick={onOpenContact}
        >
          {onBack && (
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onBack(); }} className="md:hidden shrink-0 -ml-2">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
            {conversation.avatarUrl ? (
              <img src={conversation.avatarUrl} alt={conversation.contactName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg font-semibold text-muted-foreground">
                {conversation.contactName.charAt(0).toUpperCase()}
              </span>
            )}
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3">
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
                    {/* Detectar se é áudio pelo tipo ou pela extensão do arquivo */}
                    {(msg.type === 'audio' || (msg.attachmentUrl && /\.(mp3|wav|ogg|m4a|opus|aac)(\?.*)?$/i.test(msg.attachmentUrl))) && (
                      msg.attachmentUrl ? (
                        <audio controls src={msg.attachmentUrl} className="max-w-full mb-1" />
                      ) : (
                        <div className="flex items-center gap-2 mb-1 opacity-70 text-sm italic">
                          🎵 Áudio enviado
                        </div>
                      )
                    )}
                    
                    {msg.type === 'image' && (
                      msg.attachmentUrl ? (
                        <img src={msg.attachmentUrl} alt="Imagem" className="max-w-full rounded-lg mb-1" />
                      ) : (
                        <div className="p-3 bg-black/5 dark:bg-white/5 rounded border border-white/10 mb-1 text-sm italic opacity-70">
                          🖼️ Imagem: {msg.content || 'enviada'}
                        </div>
                      )
                    )}
                    
                    {(msg.type === 'document' || msg.type === 'file' || msg.type === 'pdf') && (
                      msg.attachmentUrl ? (
                        <a href={msg.attachmentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 underline mb-1 font-semibold">
                          <File className="w-4 h-4" /> {msg.content || 'Documento Anexado'}
                        </a>
                      ) : (
                        <div className="flex items-center gap-2 mb-1 opacity-70 text-sm">
                          <File className="w-4 h-4" /> {msg.content || 'Arquivo enviado'}
                        </div>
                      )
                    )}
                    
                    {/* Exibir transcrição ou legenda se houver anexo e conteúdo de texto */}
                    {msg.type !== 'text' && msg.attachmentUrl && msg.content && !msg.content.startsWith('http') && (
                      <p className="text-sm break-words whitespace-pre-wrap mt-2 pt-2 border-t border-foreground/10 italic">
                        {msg.content}
                      </p>
                    )}

                    {msg.type === 'text' && (
                       <div className="space-y-2">
                         <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>
                         {/* Se for texto mas tiver um anexo que não foi pego acima, mostrar como link se não for áudio já exibido */}
                         {msg.attachmentUrl && !/\.(mp3|wav|ogg|m4a|opus|aac|jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(msg.attachmentUrl) && (
                            <a href={msg.attachmentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 underline text-xs opacity-70">
                              <Paperclip className="w-3 h-3" /> Ver anexo
                            </a>
                         )}
                       </div>
                    )}
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

      <div className="p-4 border-t border-border bg-card shrink-0">
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileChange}
        />
        <div className="flex items-end gap-1 md:gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => triggerFileSelect('file')}
            disabled={isUploading}
          >
            <Paperclip className="w-5 h-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="shrink-0 hidden sm:flex text-muted-foreground hover:text-foreground"
            onClick={() => triggerFileSelect('image')}
            disabled={isUploading}
          >
            <Image className="w-5 h-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="shrink-0 hidden sm:flex text-muted-foreground hover:text-foreground"
            onClick={() => triggerFileSelect('file')}
            disabled={isUploading}
          >
            <File className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0 bg-secondary rounded-xl min-h-[44px] flex items-center px-4">
            <Input
              placeholder={isUploading ? "Enviando arquivo..." : "Digite uma mensagem..."}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1 bg-transparent border-none focus-visible:ring-0 px-0"
              disabled={isUploading}
            />
          </div>

          {inputValue.trim() ? (
            <Button 
              size="icon" 
              onClick={handleSend}
              className="bg-primary text-primary-foreground rounded-full transition-all"
              disabled={isUploading}
            >
              <Send className="w-5 h-5" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="text-muted-foreground shrink-0" disabled={isUploading}>
              <Mic className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
