import { supabase } from '@/integrations/supabase/client';

// Keep for backward compatibility with mock data
export type BotType = 'rh' | 'sac' | 'comercial' | string;

export interface Conversation {
  id: string;
  contactName: string;
  contactPhone: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  status: 'open' | 'assigned' | 'closed' | 'pending';
  assignedTo?: string;
  botId: BotType;
  avatarUrl?: string;
}

export interface BotTrainingConfig {
  mode: string;
  instructions: string;
  user_id: string;
  botName: string;
  tone: string;
  autoTransfer: boolean;
  n8nWebhookUrl?: string;
  zapi_instance?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  type: 'text' | 'image' | 'audio' | 'document';
  sender: 'user' | 'agent' | 'bot' | 'human';
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read';
  attachmentUrl?: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  botId: string;
  createdAt: Date;
  lastInteraction?: Date;
  tags?: string[];
}

export interface DashboardData {
  conversationsByBot: { bot: string; count: number }[];
  conversationsByAgent: { agent: string; count: number }[];
  slaMetrics: { period: string; avgResponseTime: number; target: number }[];
  totalConversations: number;
  activeConversations: number;
  closedToday: number;
  avgResponseTime: string;
  humanInterventions: number;
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  status: 'online' | 'away' | 'offline';
}

// Mocks temporários para sua tela de Contatos/Dashboard não quebrar
const mockContacts: Contact[] = [
  {
    id: 'c1',
    name: 'João Silva',
    phone: '+55 11 99999-1234',
    email: 'joao@email.com',
    botId: 'sac',
    createdAt: new Date(),
    tags: ['VIP'],
  }
];

const mockAgent: Agent = {
  id: 'agent-1',
  name: 'Ana Atendente',
  email: 'ana@empresa.com',
  role: 'Atendente Senior',
  status: 'online',
};

// --- API Functions (Supabase Reais) ---

export async function fetchConversations(botSlug: string): Promise<Conversation[]> {
  console.log("🔍 1. Tentando buscar o bot com slug:", botSlug);

  const { data: botData, error: botError } = await supabase
    .from('bots')
    .select('id')
    .eq('slug', botSlug)
    .single();

  if (botError) {
    console.error("❌ ERRO AO BUSCAR BOT:", botError);
    return [];
  }
  
  if (!botData) {
    console.warn("⚠️ NENHUM BOT ENCONTRADO NO BANCO COM O SLUG:", botSlug);
    return [];
  }

  console.log("✅ 2. Bot encontrado! ID:", botData.id);
  console.log("🔍 3. Buscando chats atrelados a este bot...");

  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('bot_id', botData.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("❌ ERRO AO BUSCAR CHATS NO SUPABASE:", error);
    return [];
  }

  console.log("✅ 4. Chats retornados do banco:", data);

  return data.map((chat) => ({
    id: chat.id,
    contactName: chat.contact_name || 'Cliente',
    contactPhone: chat.contact_phone || '',
    lastMessage: 'Abrir conversa', 
    lastMessageTime: chat.created_at ? new Date(chat.created_at) : new Date(),
    unreadCount: 0,
    status: (chat.status as Conversation['status']) || 'open',
    assignedTo: chat.assigned_to || undefined,
    botId: botSlug,
  }));
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  console.log(`🔍 Buscando mensagens para o chat_id: ${conversationId}`);

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error("❌ ERRO AO BUSCAR MENSAGENS:", error);
    return [];
  }

  console.log(`✅ Mensagens encontradas para o chat ${conversationId}:`, data);

  return data.map((msg) => ({
    id: msg.id,
    conversationId: msg.chat_id || '',
    content: msg.content || '',
    type: 'text',
    sender: msg.sender_type as Message['sender'],
    timestamp: msg.created_at ? new Date(msg.created_at) : new Date(),
    status: 'read',
  }));
}

export async function sendMessage(payload: {
  conversationId: string;
  content: string;
  type: Message['type'];
}): Promise<Message> {
  
  // 1. Inserir no banco de dados (Para aparecer no painel)
  const { data, error } = await supabase
    .from('messages')
    .insert({
      chat_id: payload.conversationId,
      content: payload.content,
      sender_type: 'human'
    })
    .select()
    .single();

  if (error) {
    console.error("Erro ao salvar mensagem:", error);
    throw new Error(error.message);
  }

  // 2. Enviar a mensagem de verdade para o WhatsApp via Z-API
  if (payload.type === 'text') {
    // Buscar qual é o telefone do usuário e qual é o bot
    const { data: chatData } = await supabase
      .from('chats')
      .select('contact_phone, bot_id')
      .eq('id', payload.conversationId)
      .single();

    if (chatData) {
      // Buscar token e as credenciais da Z-API do robô atual
      const { data: botData } = await supabase
        .from('bots')
        .select('zapi_instance, zap_token')
        .eq('id', chatData.bot_id)
        .single();

      if (botData && botData.zapi_instance && botData.zap_token) {
        try {
          await fetch(`https://api.z-api.io/instances/${botData.zapi_instance}/token/${botData.zap_token}/send-text`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Client-Token': 'F24b2619953344130ba2eaf6d576dddceS'
            },
            body: JSON.stringify({
              phone: chatData.contact_phone,
              message: payload.content
            })
          });
        } catch (zapiError) {
          console.error("Erro ao despachar POST na Z-API:", zapiError);
        }
      }
    }
  }

  return {
    id: data.id,
    conversationId: data.chat_id,
    content: data.content,
    type: payload.type,
    sender: data.sender_type as Message['sender'], 
    timestamp: new Date(data.created_at),
    status: 'sent',
  };
}

export async function closeConversation(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('chats')
    .update({ status: 'closed' })
    .eq('id', conversationId);

  if (error) throw error;
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('chats')
    .delete()
    .eq('id', conversationId);

  if (error) throw error;
}

export async function blockContact(contactPhone: string): Promise<void> {
  const { error } = await supabase
    .from('chats')
    .update({ status: 'blocked' }) 
    .eq('contact_phone', contactPhone);

  if (error) throw error;
}

export async function fetchDashboard(botSlug?: string): Promise<DashboardData> {
  // 1. Busca todos os bots
  const { data: bots } = await supabase.from('bots').select('id, bot_name, slug');
  let botFilterId = null;
  
  if (botSlug && bots) {
    const selected = bots.find(b => b.slug === botSlug);
    if (selected) botFilterId = selected.id;
  }

  // 2. Busca todas as conversas (daquele bot específico, se houver filtro)
  let query = supabase.from('chats').select('*');
  if (botFilterId) {
    query = query.eq('bot_id', botFilterId);
  }
  const { data: chats } = await query;
  
  const allChats = chats || [];
  
  const totalConversations = allChats.length;
  const activeConversations = allChats.filter(c => c.status === 'open' || c.status === 'assigned' || c.status === 'pending').length;
  
  const today = new Date();
  today.setHours(0,0,0,0);
  const closedToday = allChats.filter(c => {
    if (c.status !== 'closed') return false;
    const updatedAt = new Date((c as any).updated_at || c.last_message_at || c.created_at);
    return updatedAt >= today;
  }).length;

  // 3. Gráfico: Conversas por Bot (visão global de todos os chats da empresa)
  const byBotMap = new Map<string, number>();
  if (bots) {
    bots.forEach(b => byBotMap.set(b.bot_name || b.slug || 'Chat', 0));
  }
  
  const { data: globalChats } = await supabase.from('chats').select('bot_id');
  if (globalChats && bots) {
    globalChats.forEach(c => {
      const bot = bots.find(b => b.id === c.bot_id);
      if (bot) {
        const name = bot.bot_name || bot.slug || 'Bot';
        byBotMap.set(name, (byBotMap.get(name) || 0) + 1);
      }
    });
  }
  
  const conversationsByBot = Array.from(byBotMap.entries()).map(([bot, count]) => ({ bot, count }));

  // 4. Gráfico: Robô vs Humano (Avaliando histórico de mensagens)
  const chatIds = allChats.map(c => c.id);
  
  // Buscar quais chats tiveram envio do tipo 'human'
  const { data: humanMsgs } = await supabase
    .from('messages')
    .select('chat_id')
    .eq('sender_type', 'human')
    .in('chat_id', chatIds);
    
  const humanChatIds = new Set(humanMsgs?.map(m => m.chat_id) || []);
  
  const iaCount = allChats.filter(c => !humanChatIds.has(c.id)).length;
  const humanCount = allChats.filter(c => humanChatIds.has(c.id)).length;
  
  const conversationsByAgent = [
    { agent: 'Robô (IA)', count: iaCount },
    { agent: 'Humano (Agente)', count: humanCount }
  ];

  // 5. SLA Metrics (Mantendo mockado até termos timestamp fino de respostas)
  const slaMetrics = [
    { period: 'Seg', avgResponseTime: 2.5, target: 3 },
    { period: 'Ter', avgResponseTime: 1.8, target: 3 },
    { period: 'Qua', avgResponseTime: 3.2, target: 3 },
    { period: 'Qui', avgResponseTime: 2.1, target: 3 },
    { period: 'Sex', avgResponseTime: 2.8, target: 3 },
  ];

  return {
    conversationsByBot: conversationsByBot.length > 0 ? conversationsByBot : [{ bot: botSlug || 'Bot', count: totalConversations }],
    conversationsByAgent,
    slaMetrics,
    totalConversations,
    activeConversations,
    closedToday,
    humanInterventions: humanCount,
    avgResponseTime: '1m 20s', // Pode ser alterado depois para cálculo real
  };
}

export async function fetchContacts(botSlug: string): Promise<Contact[]> {
  // 1. Busca os dados do robô selecionado
  const { data: botData, error: botError } = await supabase
    .from('bots')
    .select('id')
    .eq('slug', botSlug)
    .single();

  if (botError || !botData) return mockContacts;

  // 2. Busca todas as conversas do robô
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('bot_id', botData.id)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  // Pega apenas contatos unicos (agrupado pelo numero de telefone)
  const uniqueContacts = new Map<string, Contact>();

  data.forEach((chat) => {
    if (chat.contact_phone && !uniqueContacts.has(chat.contact_phone)) {
      uniqueContacts.set(chat.contact_phone, {
        id: chat.id,
        name: chat.contact_name || 'Desconhecido',
        phone: chat.contact_phone || 'Sem número',
        email: 'Sem email',
        botId: botSlug,
        createdAt: new Date(chat.created_at || Date.now()),
        lastInteraction: new Date(chat.created_at || Date.now()),
        tags: chat.status === 'open' ? ['Atendimento Ativo'] : ['Atendimento Finalizado'] ,
      });
    }
  });

  return Array.from(uniqueContacts.values());
}

export async function createContact(contactData: { name: string, phone: string, email?: string, botId: string }): Promise<Contact> {
  // 1. Busca o ID do bot
  const { data: botData, error: botError } = await supabase
    .from('bots')
    .select('id')
    .eq('slug', contactData.botId)
    .single();

  if (botError || !botData) throw new Error('Bot não encontrado');

  // 2. Insere o novo contato na tabela 'chats' (criando uma conversa inicial)
  const { data: newChat, error: insertError } = await supabase
    .from('chats')
    .insert({
      bot_id: botData.id,
      contact_phone: contactData.phone,
      contact_name: contactData.name,
      status: 'open', // Novo contato inicia em atendimento aberto
      last_message_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) throw insertError;

  // 3. Retorna o objeto Contact formatado
  return {
    id: newChat.id,
    name: newChat.contact_name || 'Desconhecido',
    phone: newChat.contact_phone || 'Sem número',
    email: 'Sem email',
    botId: contactData.botId,
    createdAt: new Date(newChat.created_at),
    lastInteraction: new Date(newChat.last_message_at),
    tags: ['Atendimento Ativo'],
  };
}

export async function fetchAgent(): Promise<Agent> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return mockAgent;
}

export async function reportContact(contactPhone: string, reason: string): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 200));
  console.log(`Contact ${contactPhone} reported. Reason: ${reason}`);
}

export async function takeoverConversation(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('chats')
    .update({ status: 'assigned' }) // Apenas altera o status, evitando erro de tipagem UUID caso a coluna assigned_to exista
    .eq('id', conversationId);

  if (error) throw error;
}

export async function returnToBot(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('chats')
    .update({ status: 'open' }) // Volta para bot
    .eq('id', conversationId);

  if (error) throw error;
}

// --- Z-API & GCP Functions ---

export async function generateWhatsAppQR(instanceId: string, token: string): Promise<{ qrCode: string }> {
  const cleanId = instanceId.trim();
  const cleanToken = token.trim();

  try {
    await fetch(`https://api.z-api.io/instances/${cleanId}/token/${cleanToken}/disconnect`, { method: 'GET' });
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (e) {
    console.warn("Aviso: Falha ao resetar, tentando gerar QR diretamente...");
  }

  const response = await fetch(`https://api.z-api.io/instances/${cleanId}/token/${cleanToken}/qr-code/image`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Client-Token': 'F24b2619953344130ba2eaf6d576dddceS'
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Instância ocupada reiniciando. Aguarde 15 segundos e clique de novo.');
  }

  const data = await response.json();

  if (!data.value) throw new Error("A Z-API não enviou a imagem do QR Code.");

  return { qrCode: data.value };
}

export async function saveBotTraining(
  botSlug: string,
  config: { instructions: string, user_id: string; name?: string; mode?: string }
): Promise<void> {
  const { data, error } = await supabase
    .from('bots')
    .update({ instructions: config.instructions, bot_name: config.name, bot_mode: config.mode })
    .eq('slug', botSlug)
    .eq('user_id', config.user_id)
    .select(); 

  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Não foi possível encontrar o bot para atualizar");
}

export async function getWhatsAppStatus(instanceId: string, token: string): Promise<{ connected: boolean; phone?: string }> {
  const cleanId = instanceId.trim();
  const cleanToken = token.trim();

  try {
    const response = await fetch(`https://api.z-api.io/instances/${cleanId}/token/${cleanToken}/status`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Client-Token': 'F24b2619953344130ba2eaf6d576dddceS'
      }
    });

    if (!response.ok) return { connected: false };

    const data = await response.json();
    return {
      connected: data.connected === true, 
      phone: data.phone || 'Número Oculto', 
    };
  } catch (e) {
    return { connected: false };
  }
}

export async function disconnectWhatsApp(instanceId: string, token: string): Promise<void> {
  const cleanId = instanceId.trim();
  const cleanToken = token.trim();

  const response = await fetch(`https://api.z-api.io/instances/${cleanId}/token/${cleanToken}/disconnect`, {
    method: 'GET',
    headers: { 'Client-Token': 'F24b2619953344130ba2eaf6d576dddceS' }
  });

  if (!response.ok) throw new Error('Erro ao desconectar da Z-API');
}

export async function uploadPdfToGCP(file: File, botId: string, folderName?: string): Promise<{ id: string, name: string, size: string, url: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('botId', folderName || botId);

  try {
    const { data, error } = await supabase.functions.invoke('upload-gcp-pdf', { body: formData });
    if (error) throw new Error(error.message || 'Falha ao processar o arquivo no servidor.');

    const fileUrl = `https://storage.googleapis.com/n8n-flow/${data.fileName}`;

    const { data: dbData, error: dbError } = await supabase
      .from('arquivos_bot')
      .insert({
        bot_id: botId,
        nome_arquivo: file.name,
        caminho_gcp: fileUrl,
        tamanho: (file.size / (1024 * 1024)).toFixed(2) + 'MB'
      })
      .select()
      .single();

    if (dbError) {
      console.error("Erro ao inserir na tabela arquivos_bot:", dbError);
      throw new Error("O arquivo foi para o GCP, mas não pôde ser salvo no banco de dados.");
    }

    return {
      id: dbData.id.toString(),
      name: dbData.nome_arquivo,
      size: (file.size / (1024 * 1024)).toFixed(2) + 'MB',
      url: dbData.caminho_gcp
    };
  } catch (error) {
    console.error("Erro no processo de upload do PDF:", error);
    throw error;
  }
}

export async function fetchBotPdfs(botSlug: string): Promise<{ id: string, name: string, size: string, url: string }[]> {
  const { data, error } = await supabase
    .from('arquivos_bot')
    .select('*')
    .eq('bot_id', botSlug); 

  if (error) {
    console.error("Erro ao buscar PDFs na tabela arquivos_pdf:", error);
    return [];
  }

  if (!data) return [];

  return data.map((file) => ({
    id: file.id.toString(),
    name: file.nome_arquivo || 'Documento.pdf',
    size: file.tamanho || 'Tamanho desconhecido', // Tirei o as any daqui também
    url: file.caminho_gcp
  }));
}

export async function viewSecurePdf(fileUrl: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('generate-signed-url', {
    body: { filePath: fileUrl },
  });

  if (error) throw new Error(error.message);
  if (!data || !data.fileData) throw new Error("Não foi possível carregar o documento.");

  const byteCharacters = atob(data.fileData);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: data.contentType || 'application/pdf' });

  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank');
  
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
}