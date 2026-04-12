// src/contexts/BotContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bot } from '@/types/bot';
import { useAuth } from '@/contexts/AuthContext';

interface BotContextType {
  bots: Bot[];
  selectedBot: Bot | null;
  setSelectedBot: (bot: Bot) => Promise<void>; // Tornamos async para lidar com o banco
  isLoading: boolean;
  refreshBots: () => Promise<void>;
  getBotBySlug: (slug: string) => Bot | undefined;
  getBotById: (id: string) => Bot | undefined;
}

const BotContext = createContext<BotContextType | undefined>(undefined);

export function BotProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBots = async () => {
    if (!user) {
      setBots([]);
      setSelectedBot(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Busca os bots e a preferência de seleção em paralelo
      const [botsRes, profileRes] = await Promise.all([
        supabase.from('bots').select('*').eq('user_id', user.id).eq('is_active', true).order('name'),
        supabase.from('profiles').select('selected_bot_id').eq('id', user.id).maybeSingle()
      ]);

      if (botsRes.data) {
        const mappedBots: Bot[] = botsRes.data.map((b) => ({
          id: b.id,
          slug: b.slug,
          name: b.name,
          bot_name: b.bot_name || '',
          mode: b.bot_mode || 'personalizado',
          description: b.description,
          icon: b.icon || 'MessageSquare',
          color: b.color || 'blue',
          isActive: b.is_active,
          createdAt: b.created_at ? new Date(b.created_at) : new Date(),
          // MAPEAMENTO CRUCIAL:
          instructions: b.instructions || '',
          zapInstance: b.zapi_instance,
          zapToken: b.zap_token,
        }));

        setBots(mappedBots);

        // 2. Tenta restaurar o bot selecionado salvo no perfil
        const savedBotId = profileRes.data?.selected_bot_id;
        const savedBot = mappedBots.find(b => b.id === savedBotId);

        // Se não houver bot salvo, pega o primeiro da lista
        setSelectedBot(savedBot || mappedBots[0] || null);
      }
    } catch (error) {
      console.error("Erro ao carregar bots:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetSelectedBot = async (bot: Bot) => {
    setSelectedBot(bot);
    if (user) {
      // Salva a preferência no perfil do usuário para o próximo login
      await supabase
        .from('profiles')
        .update({ selected_bot_id: bot.id })
        .eq('id', user.id);
    }
  };

  useEffect(() => {
    fetchBots();
  }, [user?.id]);

  return (
    <BotContext.Provider
      value={{
        bots,
        selectedBot,
        setSelectedBot: handleSetSelectedBot,
        isLoading,
        refreshBots: fetchBots,
        getBotBySlug: (slug) => bots.find((b) => b.slug === slug),
        getBotById: (id) => bots.find((b) => b.id === id),
      }}
    >
      {children}
    </BotContext.Provider>
  );
}

export function useBot() {
  const context = useContext(BotContext);
  if (context === undefined) {
    throw new Error('useBot must be used within a BotProvider');
  }
  return context;
}