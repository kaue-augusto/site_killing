export interface Bot {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  isActive: boolean;
  createdAt: Date;
  instructions?: string; // Adicionado
  zapInstance?: string; // Adicione esta linha
  zapToken?: string;
}

export interface WhatsAppConnection {
  id: string;
  botId: string;
  connected: boolean;
  phoneNumber: string | null;
  connectedBy: string | null;
  connectedAt: Date | null;
  lastActivity: Date | null;
}

export interface WhatsAppConnectionLog {
  id: string;
  botId: string;
  action: string;
  performedBy: string | null;
  createdAt: Date;
}
