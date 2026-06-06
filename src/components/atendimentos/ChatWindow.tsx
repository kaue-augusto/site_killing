import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, Image, File as FileIcon, Check, CheckCheck, ChevronLeft, MoreVertical } from 'lucide-react';
import { Message, Conversation, uploadPdfToGCP } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format, isSameDay, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';

interface ChatWindowProps {
  conversation: Conversation | null;
  messages: Message[];
  botId?: string;
  permitirAudio?: boolean;
  onSendMessage: (content: string, type: Message['type'], attachmentUrl?: string) => void;
  isLoading?: boolean;
  onBack?: () => void;
  onOpenContact?: () => void;
}

export function ChatWindow({
  conversation,
  messages,
  botId,
  permitirAudio,
  onSendMessage,
  isLoading,
  onBack,
  onOpenContact,
}: ChatWindowProps) {
  const [inputValue, setInputValue] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [pendingFileType, setPendingFileType] = useState<Message['type']>('file');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  };

  // Scroll on mount and when messages change
  useEffect(() => {
    if (messages.length > 0) {
      // Small delay to ensure rendering and images are starting to load
      const timer = setTimeout(() => scrollToBottom(messages.length <= 10 ? 'auto' : 'smooth'), 100);
      return () => clearTimeout(timer);
    }
  }, [messages, conversation?.id]);

  // Scroll to bottom when conversation changes to ensure we start at the end
  useEffect(() => {
    if (conversation) {
      const timer = setTimeout(() => scrollToBottom('auto'), 50);
      return () => clearTimeout(timer);
    }
  }, [conversation?.id]);

  const handleSend = async () => {
    if (inputValue.trim() && !isSending) {
      setIsSending(true);
      try {
        await onSendMessage(inputValue.trim(), 'text');
        setInputValue('');
      } catch (error) {
        console.error('Error sending message:', error);
      } finally {
        setIsSending(false);
      }
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
      // Usar a função de upload para GCP/Supabase em vez de Base64
      // Se não tiver botId (improvável), cai no fallback de Base64
      let fileUrl = '';
      if (botId) {
        const uploadResult = await uploadPdfToGCP(file, botId, 'chat-attachments');
        fileUrl = uploadResult.url;
      } else {
        fileUrl = await fileToBase64(file);
      }
      
      await onSendMessage(file.name, pendingFileType, fileUrl);
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Erro no arquivo',
        description: error.message || 'Não foi possível enviar o arquivo',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg; codecs=opus' });
        const audioFile = new File([audioBlob], `audio_${Date.now()}.ogg`, { type: 'audio/ogg' });
        
        setIsUploading(true);
        try {
          let audioUrl = '';
          if (botId) {
            const uploadResult = await uploadPdfToGCP(audioFile, botId, 'audio-messages');
            audioUrl = uploadResult.url;
          } else {
            audioUrl = await fileToBase64(audioFile);
          }
          
          await onSendMessage('Mensagem de áudio', 'audio', audioUrl);
        } catch (error: any) {
          console.error('Error sending audio:', error);
          toast({
            title: 'Erro no áudio',
            description: 'Não foi possível enviar o áudio',
            variant: 'destructive',
          });
        } finally {
          setIsUploading(false);
        }

        // Parar todos os tracks do stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: 'Erro no microfone',
        description: 'Não foi possível acessar o microfone',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.onstop = null; // Ignorar o evento onstop
      setIsRecording(false);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      
      // Limpar stream
      const stream = mediaRecorderRef.current.stream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
    <div className="flex-1 flex flex-col bg-background w-full min-w-0 h-full max-h-full overflow-hidden">
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
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground truncate">
              {conversation.contactName}
            </h3>
            <p className="text-xs text-muted-foreground truncate">
              {conversation.contactPhone}
            </p>
          </div>
        </div>
        {onOpenContact && (
          <Button variant="ghost" size="icon" onClick={onOpenContact} className="shrink-0">
            <MoreVertical className="w-5 h-5 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3 min-h-0 relative whatsapp-chat-bg">
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
                    {/* Detectar se é áudio pelo tipo ou pela extensão do arquivo ou se começa com data:audio */}
                    {(msg.type === 'audio' || (msg.attachmentUrl && (/\.(mp3|wav|ogg|m4a|opus|aac)(\?.*)?$/i.test(msg.attachmentUrl) || msg.attachmentUrl.startsWith('data:audio')))) && (
                      msg.attachmentUrl ? (
                        <div className="flex flex-col gap-2 min-w-[200px] py-1">
                          <audio controls src={msg.attachmentUrl} className="w-full h-8" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mb-1 opacity-70 text-sm italic">
                          <Mic className="w-4 h-4" /> Áudio enviado
                        </div>
                      )
                    )}
                    
                    {msg.type === 'image' && (
                      msg.attachmentUrl ? (
                        <img 
                          src={msg.attachmentUrl} 
                          alt="Imagem" 
                          className="max-w-full rounded-lg mb-1" 
                          onLoad={() => scrollToBottom('auto')}
                        />
                      ) : (
                        <div className="p-3 bg-black/5 dark:bg-white/5 rounded border border-white/10 mb-1 text-sm italic opacity-70">
                          🖼️ Imagem: {msg.content || 'enviada'}
                        </div>
                      )
                    )}
                    
                    {(msg.type === 'document' || msg.type === 'file' || msg.type === 'pdf') && (
                      msg.attachmentUrl ? (
                        <a href={msg.attachmentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 underline mb-1 font-semibold">
                          <FileIcon className="w-4 h-4" /> {msg.content || 'Documento Anexado'}
                        </a>
                      ) : (
                        <div className="flex items-center gap-2 mb-1 opacity-70 text-sm">
                          <FileIcon className="w-4 h-4" /> {msg.content || 'Arquivo enviado'}
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
                          <p className="text-sm break-words whitespace-pre-wrap">
                            {msg.content?.replace(/\[AUDIO_RESPONSE\]/g, '').replace(/🎤/g, '').trim()}
                          </p>
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

      <div className="p-2 md:p-4 border-t border-border bg-card shrink-0">
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
            className="shrink-0 text-muted-foreground hover:text-foreground h-9 w-9 md:h-10 md:w-10"
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
            <FileIcon className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0 bg-secondary rounded-xl min-h-[44px] flex items-center px-4 relative">
            {isRecording ? (
              <div className="flex-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-foreground">Gravando {formatTime(recordingTime)}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-destructive h-8 px-2"
                  onClick={cancelRecording}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <Input
                placeholder={isUploading ? "Enviando arquivo..." : "Digite uma mensagem..."}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 bg-transparent border-none focus-visible:ring-0 px-0"
                disabled={isUploading}
              />
            )}
          </div>

          {isRecording ? (
            <Button 
              size="icon" 
              onClick={stopRecording}
              className="bg-red-500 hover:bg-red-600 text-white rounded-full h-10 w-10 shrink-0"
            >
              <Send className="w-5 h-5" />
            </Button>
          ) : inputValue.trim() ? (
            <Button 
              size="icon" 
              onClick={handleSend}
              className="bg-primary text-primary-foreground rounded-full h-10 w-10 shrink-0 transition-all"
              disabled={isUploading || isSending}
            >
              <Send className={`w-5 h-5 ${isSending ? 'animate-pulse' : ''}`} />
            </Button>
          ) : permitirAudio ? (
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0 h-10 w-10" 
              disabled={isUploading || isSending}
              onClick={startRecording}
            >
              <Mic className="w-5 h-5" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
