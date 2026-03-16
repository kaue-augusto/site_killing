// API Mock Functions - Replace with real API calls

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
  status: 'open' | 'assigned' | 'closed';
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
}

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  type: 'text' | 'image' | 'audio' | 'document';
  sender: 'user' | 'agent' | 'bot';
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read';
  attachmentUrl?: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  botId: BotType;
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
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  status: 'online' | 'away' | 'offline';
}

// Mock Data
const mockConversations: Conversation[] = [
  {
    id: '1',
    contactName: 'João Silva',
    contactPhone: '+55 11 99999-1234',
    lastMessage: 'Olá, preciso de ajuda com meu pedido',
    lastMessageTime: new Date(Date.now() - 5 * 60 * 1000),
    unreadCount: 3,
    status: 'open',
    botId: 'sac',
  },
  {
    id: '2',
    contactName: 'Maria Santos',
    contactPhone: '+55 11 98888-5678',
    lastMessage: 'Qual o prazo de entrega?',
    lastMessageTime: new Date(Date.now() - 15 * 60 * 1000),
    unreadCount: 0,
    status: 'assigned',
    assignedTo: 'agent-1',
    botId: 'comercial',
  },
  {
    id: '3',
    contactName: 'Carlos Oliveira',
    contactPhone: '+55 11 97777-9012',
    lastMessage: 'Sobre as férias do próximo mês...',
    lastMessageTime: new Date(Date.now() - 30 * 60 * 1000),
    unreadCount: 1,
    status: 'open',
    botId: 'rh',
  },
  {
    id: '4',
    contactName: 'Ana Pereira',
    contactPhone: '+55 11 96666-3456',
    lastMessage: 'Obrigada pelo atendimento!',
    lastMessageTime: new Date(Date.now() - 60 * 60 * 1000),
    unreadCount: 0,
    status: 'closed',
    botId: 'sac',
  },
  {
    id: '5',
    contactName: 'Pedro Costa',
    contactPhone: '+55 11 95555-7890',
    lastMessage: 'Gostaria de saber mais sobre o produto X',
    lastMessageTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    unreadCount: 2,
    status: 'open',
    botId: 'comercial',
  },
];

const mockMessages: Message[] = [
  {
    id: 'm1',
    conversationId: '1',
    content: 'Olá! Bem-vindo ao SAC. Como posso ajudá-lo?',
    type: 'text',
    sender: 'bot',
    timestamp: new Date(Date.now() - 10 * 60 * 1000),
    status: 'read',
  },
  {
    id: 'm2',
    conversationId: '1',
    content: 'Olá, preciso de ajuda com meu pedido',
    type: 'text',
    sender: 'user',
    timestamp: new Date(Date.now() - 8 * 60 * 1000),
    status: 'read',
  },
  {
    id: 'm3',
    conversationId: '1',
    content: 'Claro! Pode me informar o número do pedido?',
    type: 'text',
    sender: 'agent',
    timestamp: new Date(Date.now() - 6 * 60 * 1000),
    status: 'delivered',
  },
  {
    id: 'm4',
    conversationId: '1',
    content: 'O número é 12345',
    type: 'text',
    sender: 'user',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    status: 'read',
  },
];

const mockContacts: Contact[] = [
  {
    id: 'c1',
    name: 'João Silva',
    phone: '+55 11 99999-1234',
    email: 'joao@email.com',
    botId: 'sac',
    createdAt: new Date('2024-01-15'),
    tags: ['VIP', 'Frequente'],
  },
  {
    id: 'c2',
    name: 'Maria Santos',
    phone: '+55 11 98888-5678',
    email: 'maria@email.com',
    botId: 'comercial',
    createdAt: new Date('2024-02-20'),
    tags: ['Novo'],
  },
  {
    id: 'c3',
    name: 'Carlos Oliveira',
    phone: '+55 11 97777-9012',
    email: 'carlos@empresa.com',
    botId: 'rh',
    createdAt: new Date('2024-03-10'),
    tags: ['Funcionário'],
  },
];

const mockAgent: Agent = {
  id: 'agent-1',
  name: 'Ana Atendente',
  email: 'ana@empresa.com',
  role: 'Atendente Senior',
  status: 'online',
};

// API Functions
export async function fetchConversations(bot: BotType): Promise<Conversation[]> {
  // Simulating API delay
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockConversations.filter(c => c.botId === bot);
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return mockMessages.filter(m => m.conversationId === conversationId);
}

export async function sendMessage(payload: {
  conversationId: string;
  content: string;
  type: Message['type'];
}): Promise<Message> {
  await new Promise(resolve => setTimeout(resolve, 100));
  const newMessage: Message = {
    id: `m${Date.now()}`,
    conversationId: payload.conversationId,
    content: payload.content,
    type: payload.type,
    sender: 'agent',
    timestamp: new Date(),
    status: 'sent',
  };
  return newMessage;
}

export async function fetchDashboard(): Promise<DashboardData> {
  await new Promise(resolve => setTimeout(resolve, 400));
  return {
    conversationsByBot: [
      { bot: 'SAC', count: 45 },
      { bot: 'Comercial', count: 32 },
      { bot: 'RH', count: 18 },
    ],
    conversationsByAgent: [
      { agent: 'Ana', count: 28 },
      { agent: 'Bruno', count: 22 },
      { agent: 'Carla', count: 15 },
      { agent: 'Diego', count: 30 },
    ],
    slaMetrics: [
      { period: 'Seg', avgResponseTime: 2.5, target: 3 },
      { period: 'Ter', avgResponseTime: 1.8, target: 3 },
      { period: 'Qua', avgResponseTime: 3.2, target: 3 },
      { period: 'Qui', avgResponseTime: 2.1, target: 3 },
      { period: 'Sex', avgResponseTime: 2.8, target: 3 },
    ],
    totalConversations: 95,
    activeConversations: 23,
    closedToday: 42,
    avgResponseTime: '2m 30s',
  };
}

export async function fetchContacts(bot: BotType): Promise<Contact[]> {
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockContacts.filter(c => c.botId === bot);
}

export async function createContact(contact: Omit<Contact, 'id' | 'createdAt'>): Promise<Contact> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return {
    ...contact,
    id: `c${Date.now()}`,
    createdAt: new Date(),
  };
}

export async function fetchAgent(): Promise<Agent> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return mockAgent;
}

export async function closeConversation(conversationId: string): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 200));
  console.log(`Conversation ${conversationId} closed`);
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 200));
  console.log(`Conversation ${conversationId} deleted`);
}

export async function blockContact(contactPhone: string): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 200));
  console.log(`Contact ${contactPhone} blocked`);
}

export async function reportContact(contactPhone: string, reason: string): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 200));
  console.log(`Contact ${contactPhone} reported. Reason: ${reason}`);
}

export async function transferConversation(
  conversationId: string,
  targetAgentId: string
): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 200));
  console.log(`Conversation ${conversationId} transferred to ${targetAgentId}`);
}

// Bot Training Types and Functions
export interface BotTrainingConfig {
  mode: string;
  instructions: string;
  user_id: string;
  botName: string;
  tone: string;
  autoTransfer: boolean;
  zapi_instance?: string; // Campo opcional (com ?) para não dar erro se estiver vazio
}

export async function generateWhatsAppQR(instanceId: string, token: string): Promise<{ qrCode: string }> {
  const cleanId = instanceId.trim();
  const cleanToken = token.trim();


  // Tenta desconectar primeiro para "limpar" a sessão travada
  try {
    await fetch(`https://api.z-api.io/instances/${cleanId}/token/${cleanToken}/disconnect`, { method: 'GET' });
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  catch (e) {
    console.warn("Aviso: Falha ao resetar, tentando gerar QR diretamente...");
  }

  // Bate no endpoint padrão sem dar disconnect antes!
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

  if (!data.value) {
    throw new Error("A Z-API não enviou a imagem do QR Code.");
  }

  return { qrCode: data.value };
}

export async function saveBotTraining(
  botSlug: string,
  config: { instructions: string, user_id: string } // Agora focado apenas nas instruções
): Promise<void> {
  const { data, error } = await supabase
    .from('bots')
    .update({ instructions: config.instructions })// Personalidade completa aqui
    .eq('slug', botSlug)
    .eq('user_id', config.user_id)
    .select(); // Garante que salva no bot do usuário certo

  if (error) throw error;

  if (!data || data.length === 0) {
    throw new Error("Não foi possível encontrar o bot para atualizar");
  }
}

export async function getWhatsAppStatus(
  instanceId: string,
  token: string
): Promise<{ connected: boolean; phone?: string }> {
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
      connected: data.connected === true, // Retorna true se estiver conectado
      phone: data.phone || 'Número Oculto', // Traz o número se a API fornecer
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

  if (!response.ok) {
    throw new Error('Erro ao desconectar da Z-API');
  }
}

export async function uploadPdfToGCP(file: File, botId: string, folderName?: string): Promise<{ id: string, name: string, size: string, url: string }> {
  // Prepara o arquivo para envio
  const formData = new FormData();
  formData.append('file', file);
  // Usa o folderName (slug) se existir para criar a pasta com nome amigável, caso contrário usa o botId
  formData.append('botId', folderName || botId);

  try {
    // 1. Chama a Edge Function para enviar ao Google Cloud
    const { data, error } = await supabase.functions.invoke('upload-gcp-pdf', {
      body: formData,
    });

    if (error) {
      throw new Error(error.message || 'Falha ao processar o arquivo no servidor.');
    }

    // 2. Monta a URL pública do arquivo no GCP (usando o nome retornado pela Edge Function)
    const fileUrl = `https://storage.googleapis.com/n8n-flow/${data.fileName}`;

    // 3. SALVA NO BANCO DE DADOS: Insere o registro na tabela arquivos_bot
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

    // 4. Retorna para a tela o arquivo já com o ID real do banco
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
  // Faz a consulta na tabela arquivos_pdf filtrando pelo bot correspondente
  const { data, error } = await supabase
    .from('arquivos_bot')
    .select('*')
    .eq('bot_id', botSlug); // Se a sua coluna de relacionamento com o bot tiver outro nome (ex: bot_slug), altere aqui.

  if (error) {
    console.error("Erro ao buscar PDFs na tabela arquivos_pdf:", error);
    return [];
  }

  if (!data) return [];

  // Ajustando para os nomes das colunas que apareceram no seu erro:
  // nome_arquivo e caminho_gcp
  return data.map((file) => ({
    id: file.id.toString(),
    name: file.nome_arquivo || 'Documento.pdf',
    size: (file as any).tamanho || 'Tamanho desconhecido',
    url: file.caminho_gcp
  }));
}

