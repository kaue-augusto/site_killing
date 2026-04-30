import { useState, useEffect } from 'react';
import { useBot } from '@/contexts/BotContext';
import { supabase } from '@/lib/supabase'; // Certifique-se de que o caminho do seu client do Supabase está correto
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  closeConversation,
  deleteConversation,
  blockContact,
  reportContact,
  takeoverConversation,
  returnToBot,
  moveToPending,
  Conversation,
  Message
} from '@/lib/api';
import { ConversationList } from '@/components/atendimentos/ConversationList';
import { ChatWindow } from '@/components/atendimentos/ChatWindow';
import { ContactPanel } from '@/components/atendimentos/ContactPanel';
import { toast } from '@/hooks/use-toast';
import { Sheet, SheetContent } from '@/components/ui/sheet';

export default function Atendimentos() {
  const { selectedBot } = useBot();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);

  // Fetch conversations when bot changes
  useEffect(() => {
    const loadConversations = async () => {
      if (!selectedBot) return;

      setIsLoadingConversations(true);
      setSelectedConversation(null);
      setMessages([]);
      setIsSidePanelOpen(true);
      try {
        const data = await fetchConversations(selectedBot.slug);
        setConversations(data);
      } catch (error) {
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar as conversas',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingConversations(false);
      }
    };

    loadConversations();
  }, [selectedBot]);

  // Fetch messages when conversation is selected
  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedConversation) return;

      setIsLoadingMessages(true);
      try {
        const data = await fetchMessages(selectedConversation.id);
        setMessages(data);
      } catch (error) {
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar as mensagens',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingMessages(false);
      }
    };

    loadMessages();
  }, [selectedConversation]);

  // ------------------------------------------------------------------
  // 🟢 REALTIME 1: Atualiza as MENSAGENS do chat aberto na tela
  // ------------------------------------------------------------------
  useEffect(() => {
    // Se não tem chat selecionado, não escuta nada
    if (!selectedConversation) return;

    const messagesChannel = supabase
      .channel(`chat-aberto-${selectedConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${selectedConversation.id}`, // Escuta só mensagens deste chat!
        },
        (payload) => {
          const rawMsg = payload.new as any;

          const newMessage: Message = {
            id: rawMsg.id,
            conversationId: rawMsg.chat_id,
            content: rawMsg.content || '',
            type: rawMsg.message_type || rawMsg.type || 'text',
            sender: rawMsg.sender_type as Message['sender'],
            timestamp: new Date(rawMsg.created_at),
            status: 'read' as Message['status'],
            attachmentUrl: rawMsg.media_url || rawMsg.attachment_url || rawMsg.file_url || (rawMsg.message_type && rawMsg.message_type !== 'text' && rawMsg.content && rawMsg.content.startsWith('http') ? rawMsg.content : undefined)
          };

          // Adiciona a mensagem nova na tela se ela já não estiver lá
          if (newMessage.content === 'Robô pausado') return;

          // Se for uma mensagem de transferência do robô, atualizar status do chat automaticamente
          if (newMessage.sender === 'agent' && newMessage.content.toLowerCase().includes('transferindo seu atendimento')) {
            moveToPending(newMessage.conversationId).then(() => {
               // Atualizar localmente a conversa selecionada se for ela
               setSelectedConversation(prev => {
                 if (prev && prev.id === newMessage.conversationId) {
                   return { ...prev, status: 'pending' };
                 }
                 return prev;
               });
               
               // Atualizar lista de conversas para refletir o novo status
               if (selectedBot) {
                 fetchConversations(selectedBot.slug).then(setConversations);
               }
            });
          }
          
          setMessages((prev) => {
            if (prev.some((msg) => msg.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [selectedConversation]);


  // ------------------------------------------------------------------
  // 🟢 REALTIME 2: Atualiza a BARRA LATERAL (Última mensagem e ordem)
  // ------------------------------------------------------------------
  useEffect(() => {
    const sidebarChannel = supabase
      .channel('atualiza-sidebar')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' }, // Escuta TODAS as mensagens
        (payload) => {
          const novaMensagem = payload.new as any;

          setConversations((conversasAntigas) => {
            const index = conversasAntigas.findIndex(c => c.id === novaMensagem.chat_id);

            // Se a mensagem for de um chat que não tá na lista, ignora
            if (index === -1) return conversasAntigas;

            const conversasAtualizadas = [...conversasAntigas];

            // Atualiza o texto da última mensagem e o horário
            conversasAtualizadas[index] = {
              ...conversasAtualizadas[index],
              lastMessage: novaMensagem.content || 'Anexo',
              lastMessageTime: new Date(novaMensagem.created_at)
            };

            // Reordena a lista jogando a conversa atualizada pro topo
            return conversasAtualizadas.sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sidebarChannel);
    };
  }, []);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setIsSidePanelOpen(true);
  };

  const handleSendMessage = async (content: string, type: Message['type'], attachmentUrl?: string) => {
    if (!selectedConversation) return;

    try {
      const newMessage = await sendMessage({
        conversationId: selectedConversation.id,
        content,
        type,
        attachmentUrl
      });
      setMessages((prev) => {
        if (prev.some(m => m.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar a mensagem',
        variant: 'destructive',
      });
    }
  };

  const handleCloseConversation = async () => {
    if (!selectedConversation || !selectedBot) return;

    try {
      await closeConversation(selectedConversation.id);
      toast({
        title: 'Sucesso',
        description: 'Conversa encerrada com sucesso',
      });
      setSelectedConversation(null);
      // Refresh conversations
      const data = await fetchConversations(selectedBot.slug);
      setConversations(data);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível encerrar a conversa',
        variant: 'destructive',
      });
    }
  };

  const handleTakeoverConversation = async () => {
    if (!selectedConversation || !selectedBot) return;

    try {
      await takeoverConversation(selectedConversation.id);
      toast({
        title: 'Sucesso',
        description: 'Você assumiu a conversa. O robô foi pausado.',
      });
      setSelectedConversation({ ...selectedConversation, status: 'assigned' });
      // Atualizar lista para colorir/agrupar, se tiver
      const data = await fetchConversations(selectedBot.slug);
      setConversations(data);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível assumir a conversa',
        variant: 'destructive',
      });
    }
  };

  const handleReturnToBot = async () => {
    if (!selectedConversation || !selectedBot) return;

    try {
      await returnToBot(selectedConversation.id);
      toast({
        title: 'Sucesso',
        description: 'A conversa foi devolvida para o robô.',
      });
      setSelectedConversation({ ...selectedConversation, status: 'open' });
      const data = await fetchConversations(selectedBot.slug);
      setConversations(data);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível devolver para o robô',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversation || !selectedBot) return;

    try {
      await deleteConversation(selectedConversation.id);
      toast({
        title: 'Sucesso',
        description: 'Conversa apagada com sucesso',
      });
      setSelectedConversation(null);
      const data = await fetchConversations(selectedBot.slug);
      setConversations(data);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível apagar a conversa',
        variant: 'destructive',
      });
    }
  };

  const handleBlockContact = async () => {
    if (!selectedConversation || !selectedBot) return;

    try {
      await blockContact(selectedConversation.contactPhone);
      toast({
        title: 'Sucesso',
        description: `${selectedConversation.contactName} foi bloqueado`,
      });
      setSelectedConversation(null);
      setConversations((prev) => prev.filter((c) => c.id !== selectedConversation.id));
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível bloquear o contato',
        variant: 'destructive',
      });
    }
  };

  const handleReportContact = async (reason: string) => {
    if (!selectedConversation || !selectedBot) return;

    try {
      await reportContact(selectedConversation.contactPhone, reason);
      toast({
        title: 'Denúncia enviada',
        description: 'A denúncia foi registrada e o contato foi removido das conversas recentes',
      });
      setSelectedConversation(null);
      setConversations((prev) => prev.filter((c) => c.id !== selectedConversation.id));
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar a denúncia',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="h-full flex overflow-hidden">
      <ConversationList
        className={selectedConversation ? 'hidden md:flex' : 'flex'}
        conversations={conversations}
        selectedId={selectedConversation?.id}
        onSelect={handleSelectConversation}
        isLoading={isLoadingConversations}
      />

      {selectedConversation && (
        <div className={`h-full flex-1 flex min-w-0 ${!selectedConversation ? 'hidden md:flex' : 'flex'}`}>
          <ChatWindow
            conversation={selectedConversation}
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoadingMessages}
            onBack={() => setSelectedConversation(null)}
            onOpenContact={() => setIsSidePanelOpen(!isSidePanelOpen)}
          />

          {isSidePanelOpen && (
            <div className="hidden lg:block h-full shrink-0">
              <ContactPanel
                conversation={selectedConversation}
                messages={messages}
                onClose={handleCloseConversation}
                onTakeover={handleTakeoverConversation}
                onReturnToBot={handleReturnToBot}
                onDelete={handleDeleteConversation}
                onBlock={handleBlockContact}
                onReport={handleReportContact}
                onClosePanel={() => setIsSidePanelOpen(false)}
              />
            </div>
          )}

          <Sheet open={isContactPanelOpen} onOpenChange={setIsContactPanelOpen}>
            <SheetContent side="right" className="p-0 w-80 sm:w-96 border-none">
              <ContactPanel
                conversation={selectedConversation}
                messages={messages}
                onClose={() => { setIsContactPanelOpen(false); handleCloseConversation(); }}
                onTakeover={handleTakeoverConversation}
                onReturnToBot={handleReturnToBot}
                onDelete={() => { setIsContactPanelOpen(false); handleDeleteConversation(); }}
                onBlock={() => { setIsContactPanelOpen(false); handleBlockContact(); }}
                onReport={(reason) => { setIsContactPanelOpen(false); handleReportContact(reason); }}
                onClosePanel={() => setIsContactPanelOpen(false)}
              />
            </SheetContent>
          </Sheet>
        </div>
      )}
    </div>
  );
}