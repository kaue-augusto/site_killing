import { useState, useEffect } from 'react';
import { useBot } from '@/contexts/BotContext';
import { 
  fetchConversations, 
  fetchMessages, 
  sendMessage,
  closeConversation,
  deleteConversation,
  blockContact,
  reportContact,
  Conversation, 
  Message 
} from '@/lib/api';
import { ConversationList } from '@/components/atendimentos/ConversationList';
import { ChatWindow } from '@/components/atendimentos/ChatWindow';
import { ContactPanel } from '@/components/atendimentos/ContactPanel';
import { toast } from '@/hooks/use-toast';

export default function Atendimentos() {
  const { selectedBot } = useBot();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Fetch conversations when bot changes
  useEffect(() => {
    const loadConversations = async () => {
      if (!selectedBot) return;
      
      setIsLoadingConversations(true);
      setSelectedConversation(null);
      setMessages([]);
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

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
  };

  const handleSendMessage = async (content: string, type: Message['type']) => {
    if (!selectedConversation) return;

    try {
      const newMessage = await sendMessage({
        conversationId: selectedConversation.id,
        content,
        type,
      });
      setMessages((prev) => [...prev, newMessage]);
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

  const handleTransferConversation = () => {
    toast({
      title: 'Transferir',
      description: 'Funcionalidade de transferência em desenvolvimento',
    });
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
    <div className="h-full flex">
      <ConversationList
        conversations={conversations}
        selectedId={selectedConversation?.id}
        onSelect={handleSelectConversation}
        isLoading={isLoadingConversations}
      />
      
      <ChatWindow
        conversation={selectedConversation}
        messages={messages}
        onSendMessage={handleSendMessage}
        isLoading={isLoadingMessages}
      />
      
      <ContactPanel
        conversation={selectedConversation}
        onClose={handleCloseConversation}
        onTransfer={handleTransferConversation}
        onDelete={handleDeleteConversation}
        onBlock={handleBlockContact}
        onReport={handleReportContact}
      />
    </div>
  );
}
