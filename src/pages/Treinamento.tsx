import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import {
  ShoppingCart, Headphones, BookOpen, Users, Settings2, MessageCircle, QrCode, Wifi, WifiOff, RefreshCw, Send, Instagram, CheckCircle2, Database, Globe, HelpCircle, AlignLeft, FileText, UploadCloud,
  Trash2, Plus, Eye
} from 'lucide-react';
import { useBot } from '@/contexts/BotContext';
import { useToast } from '@/hooks/use-toast';
import { generateWhatsAppQR, getWhatsAppStatus, disconnectWhatsApp, saveBotTraining, BotTrainingConfig, BotType, uploadPdfToGCP, fetchBotPdfs, viewSecurePdf } from '@/lib/api';


const botModes = [
  { id: 'vendas', label: 'Vendas', icon: ShoppingCart, description: 'Focado em conversão e vendas' },
  { id: 'suporte', label: 'Suporte', icon: Headphones, description: 'Atendimento e resolução de problemas' },
  { id: 'ensino', label: 'Ensino', icon: BookOpen, description: 'Explicações didáticas e passo a passo' },
  { id: 'personalizado', label: 'Personalizado', icon: Settings2, description: 'Configure do seu jeito do zero' },
];


const defaultInstructions = {
  vendas: "Você é um assistente virtual focado em Vendas. Seu objetivo principal é entender a necessidade do cliente, apresentar os benefícios dos nossos produtos de forma persuasiva e conduzir a conversa para o fechamento. Seja proativo, educado e termine sempre com uma pergunta que incentive a compra ou o próximo passo lógico.",
  suporte: "Você é um assistente de Suporte e Atendimento. Seu objetivo é resolver problemas de forma rápida, clara e empática. Peça detalhes sobre o problema do usuário passo a passo, forneça a solução e sempre confirme se a dúvida foi resolvida. Seja paciente, objetivo e nunca invente informações que não estão na sua base.",
  ensino: "Você é um assistente focado em Ensino e Treinamento. Seu objetivo é explicar conceitos complexos de forma simples, guiando o usuário em seu aprendizado. Use analogias, divida a explicação em tópicos curtos (bullet points) e pergunte se o usuário compreendeu antes de avançar para o próximo assunto.",
  personalizado: "" // Deixa a caixa de texto completamente em branco para o utilizador
};

export default function Treinamento() {
  const { selectedBot, refreshBots } = useBot();
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();

  // Training state Estados de Configuração do Bot
  const [selectedMode, setSelectedMode] = useState('suporte');
  const [instructions, setInstructions] = useState('');
  const [botName, setBotName] = useState(selectedBot?.bot_name || '');
  const [autoTransfer, setAutoTransfer] = useState(true);
  const [authorizationEnabled, setAuthorizationEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fontes State (NOVO)
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [linksInclusos, setLinksInclusos] = useState(0);
  const [linksExtraidos, setLinksExtraidos] = useState([]);
  const [savedSites, setSavedSites] = useState<any[]>([]);
  const [qaList, setQaList] = useState<any[]>([]);

  // Estados de PDF (Dinâmicos)
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [uploadedPdfs, setUploadedPdfs] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);


  // --- ESTADOS PARA A ABA TEXTO ---
  const [textoTitulo, setTextoTitulo] = useState('');
  const [textoConteudo, setTextoConteudo] = useState('');
  const [savedTextos, setSavedTextos] = useState<any[]>([]);
  const [isSavingTexto, setIsSavingTexto] = useState(false);

  // WhatsApp state
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  // 1. Crie o estado inicial
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState('');

  // Estados de Matriculas (NOVO)
  const [matriculasList, setMatriculasList] = useState<any[]>([]);
  const [novaMatricula, setNovaMatricula] = useState('');
  const [novoNomeMatricula, setNovoNomeMatricula] = useState('');
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const csvFileInputRef = useRef<HTMLInputElement>(null);

  const fetchMatriculasDoBot = async () => {
    if (!selectedBot?.id) return;
    try {
      const { data, error } = await supabase
        .from('bot_matriculas')
        .select('*')
        .eq('bot_id', selectedBot.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMatriculasList(data || []);
    } catch (error) {
      console.error("Erro ao buscar matriculas:", error);
    }
  };

  const handleAddMatricula = async () => {
    if (!novaMatricula.trim() || !selectedBot?.id) return;
    try {
      const { error } = await supabase
        .from('bot_matriculas')
        .insert([{ bot_id: selectedBot.id, matricula: novaMatricula, nome: novoNomeMatricula }]);
      
      if (error) throw error;
      
      toast({ title: 'Matrícula adicionada!', description: 'Usuário autorizado concluído com sucesso.' });
      setNovaMatricula('');
      setNovoNomeMatricula('');
      fetchMatriculasDoBot();
    } catch(err) {
      toast({ title: 'Erro', description: 'Não foi possível adicionar matrícula.', variant: 'destructive' });
    }
  };

  const handleRemoverMatricula = async (id: string) => {
    try {
      const { error } = await supabase.from('bot_matriculas').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Removido', description: 'Matrícula excluída da base de autorizados.' });
      fetchMatriculasDoBot();
    } catch (err) {
      toast({ title: 'Erro', description: 'Falha ao remover.', variant: 'destructive' });
    }
  };

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedBot?.id) return;
    
    setIsUploadingCsv(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const rowsToInsert = [];
        
        // Pular cabeçalho assumindo que a linha 1 é cabeçalho
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          // Suportando virgula e ponto e virgula
          const cols = line.split(/[;,]/);
          const matricula = cols[0]?.trim();
          const nome = cols[1]?.trim() || '';
          
          if (matricula) {
            rowsToInsert.push({
              bot_id: selectedBot.id,
              matricula,
              nome
            });
          }
        }
        
        if (rowsToInsert.length > 0) {
          const { error } = await supabase.from('bot_matriculas').insert(rowsToInsert);
          if (error) throw error;
          
          toast({ title: 'Sucesso!', description: `${rowsToInsert.length} matrículas importadas do arquivo.` });
          fetchMatriculasDoBot();
        } else {
          toast({ title: 'Aviso', description: 'Nenhum dado válido encontrado. O arquivo deve ter uma coluna de Matrícula.', variant: 'destructive' });
        }
      } catch (err) {
        toast({ title: 'Erro na importação', description: 'Certifique-se que o arquivo é CSV e bem formatado.', variant: 'destructive' });
      } finally {
        setIsUploadingCsv(false);
        if (csvFileInputRef.current) csvFileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // 1. A FUNÇÃO PRINCIPAL (É o seu código exato, mas agora aceita arquivos de qualquer lugar)
  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;

    const validFiles = files.filter(file => file.type === 'application/pdf');

    if (validFiles.length !== files.length) {
      toast({
        title: 'Aviso',
        description: 'Alguns arquivos foram ignorados pois não são PDF.',
        variant: 'destructive'
      });
    }

    if (validFiles.length === 0) return;

    setIsUploadingPdf(true);
    try {
      const uploadPromises = validFiles.map(file =>
        uploadPdfToGCP(file, selectedBot?.id || 'default', selectedBot?.slug)
      );

      const novosPdfs = await Promise.all(uploadPromises);
      setUploadedPdfs(prev => [...prev, ...novosPdfs]);

      toast({
        title: 'Upload concluído!',
        description: `${novosPdfs.length} arquivo(s) salvo(s) com sucesso.`
      });
    } catch (error) {
      toast({
        title: 'Erro no envio',
        description: 'Não foi possível enviar um ou mais arquivos.',
        variant: 'destructive'
      });
    } finally {
      setIsUploadingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 2. FUNÇÃO DO CLIQUE (Quando clica no botão "Carregar")
  const handlePdfSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(Array.from(event.target.files || []));
  };

  // 3. FUNÇÕES DO ARRASTAR E SOLTAR (O segredo para não abrir nova aba)
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); // Impede o navegador de tentar abrir o PDF
    setIsDragging(true);    // Deixa a caixa verde (se você adicionou o estado isDragging)
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);   // Tira a cor verde quando o mouse sai da caixa
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); // Impede o navegador de tentar abrir o PDF
    setIsDragging(false);

    // Pega os arquivos que foram soltos e manda para a função principal
    const droppedFiles = Array.from(event.dataTransfer.files || []);
    processFiles(droppedFiles);
  };

  const fetchSitesDoBot = async () => {
    if (!selectedBot?.id) return;

    try {
      // Usamos .select() em vez de .single() para trazer TODOS os sites
      const { data, error } = await supabase
        .from('bot_websites')
        .select('id, url, conteudo')
        .eq('bot_id', selectedBot.id);

      if (error) throw error;

      if (data && data.length > 0) {
        setSavedSites(data); // Guarda a lista de sites

        let todosLinks: string[] = [];
        const regexLinks = /\]\((http[^)]+)\)/g;

        // Extrai os links de todos os sites guardados
        data.forEach(site => {
          let match;
          while ((match = regexLinks.exec(site.conteudo)) !== null) {
            todosLinks.push(match[1]);
          }
        });

        // Remove duplicados e atualiza a interface
        const linksUnicos = [...new Set(todosLinks)];
        setLinksInclusos(linksUnicos.length > 0 ? linksUnicos.length : data.length);
        setLinksExtraidos(linksUnicos.length > 0 ? linksUnicos : data.map(d => d.url));
      } else {
        setSavedSites([]);
        setLinksInclusos(0);
        setLinksExtraidos([]);
      }
    } catch (error) {
      console.error("Erro ao buscar sites:", error);
    }
  };

  // 2. DEPOIS: O useEffect para sincronização
  useEffect(() => {
    if (selectedBot?.id) {
      // Limpa o estado anterior ao trocar de bot
      setQrCode(null);
      setWhatsappConnected(false);
      setWhatsappPhone(null);
      setInstructions(selectedBot.instructions || '');
      setBotName(selectedBot.bot_name || '');
      setSelectedMode(selectedBot.mode || 'suporte');
      setAuthorizationEnabled(selectedBot.exigir_matricula || false);

      // === Busca os PDFs ===
      const loadPdfs = async () => {
        setIsLoadingFiles(true);
        try {
          const pdfs = await fetchBotPdfs(selectedBot.id);
          setUploadedPdfs(pdfs);
        } catch (error) {
          console.error("Erro ao carregar lista de PDFs:", error);
        } finally {
          setIsLoadingFiles(false);
        }
      };
      loadPdfs();

      // === Busca o Q&A ===
      const loadQA = async () => {
        try {
          const { data, error } = await supabase
            .from('bot_qa')
            .select('*')
            .eq('bot_id', selectedBot.id)
            .order('created_at', { ascending: true });

          if (error) throw error;
          setQaList(data || []);
        } catch (error: any) {
          console.error("Erro ao carregar Q&A:", error.message);
        }
      };
      loadQA();

      // === MÚLTIPLOS SITES: Chama a função que você criou lá em cima! ===
      fetchSitesDoBot();

      fetchTextosDoBot();
      fetchMatriculasDoBot();
    }

    // --- LÓGICA DE VERIFICAÇÃO AUTOMÁTICA (POLLING) ---
    let intervalId: NodeJS.Timeout;

    const checkConnection = async () => {
      if (!selectedBot?.zapInstance || !selectedBot?.zapToken) {
        setWhatsappConnected(false);
        setWhatsappPhone(null);
        return;
      }

      try {
        const status = await getWhatsAppStatus(selectedBot.zapInstance, selectedBot.zapToken);
        setWhatsappConnected(status.connected);
        if (status.phone) setWhatsappPhone(status.phone);
        else setWhatsappPhone(null);

        if (status.connected) {
          setQrCode(null);
          setIsGeneratingQR(false);
        }
      } catch (error) {
        console.error("Erro ao verificar status na Z-API");
        setWhatsappConnected(false);
        setWhatsappPhone(null);
      }
    };

    checkConnection();
    intervalId = setInterval(checkConnection, 5000);

    return () => clearInterval(intervalId);
  }, [selectedBot]); // <- O fetchSitesDoBot vai rodar sempre que mudar de bot


  const handleSaveTraining = async () => {
    if (!selectedBot || !user) return;
    setIsSaving(true);

    try {
      // Cria um texto final unindo as instruções visíveis com o nome do bot em "segundo plano"
      const instrucoesFinais = `${instructions}

[DIRETRIZES DE IDENTIDADE]
- O seu nome é: ${botName}
      `.trim();

      // Salva no banco (assumindo que a sua função atualiza a coluna 'instructions' e 'name')
      await saveBotTraining(selectedBot.slug, {
        name: botName, // Atualiza o nome oficial do bot no banco
        instructions: instructions, // Salva o texto completo com a injeção do nome
        mode: selectedMode,
        user_id: user.id,
        exigir_matricula: authorizationEnabled,
        isAdmin: isAdmin
      });

      await refreshBots();

      toast({
        title: 'Treinamento salvo!',
        description: 'As configurações foram sincronizadas com o banco.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível atualizar o banco de dados.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateQR = async () => {
    if (!selectedBot?.zapInstance || !selectedBot?.zapToken) {
      toast({
        title: 'Configuração ausente',
        description: 'Instância ou Token da Z-API não configurados para este bot.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const result = await generateWhatsAppQR(selectedBot.zapInstance, selectedBot.zapToken);
      setQrCode(result.qrCode);
    } catch (error: any) {
      toast({
        title: 'Atenção',
        description: error.message, // Exibirá a mensagem de "Já está conectado"
        variant: 'destructive',
      });
    }
    setIsGeneratingQR(true);
    try {
      // Passa os dados reais salvos no Supabase
      const result = await generateWhatsAppQR(selectedBot.zapInstance, selectedBot.zapToken);
      setQrCode(result.qrCode);
      toast({
        title: 'QR Code gerado!',
        description: 'Escaneie o código com seu WhatsApp.',
      });
      // Inicie aqui um setInterval para verificar o status da conexão se desejar
    } catch (error) {
      toast({
        title: 'Erro ao conectar',
        description: 'Não foi possível obter o QR Code da Z-API.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingQR(false);
    }
  };

  // 2. Substitua a sua função handleDisconnect por esta:
  const handleDisconnect = async () => {
    if (!selectedBot?.zapInstance || !selectedBot?.zapToken) return;
    setIsDisconnecting(true);
    try {
      // Passa os dados reais da Z-API para a função desconectar
      await disconnectWhatsApp(selectedBot.zapInstance, selectedBot.zapToken);
      setWhatsappConnected(false);
      setWhatsappPhone(null);
      setQrCode(null);
      toast({
        title: 'WhatsApp desconectado',
        description: 'A sessão foi encerrada com sucesso.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao desconectar',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Funções de apoio para Q&A
  // ADICIONAR: Cria a linha no banco primeiro para pegar o ID real
  const addQaPair = async () => {
    if (!selectedBot) return;
    try {
      const { data, error } = await supabase
        .from('bot_qa')
        .insert([{ bot_id: selectedBot.id, pergunta: '', resposta: '' }])
        .select()
        .single();

      if (error) throw error;
      setQaList([...qaList, data]); // Adiciona o objeto vindo do banco à lista
    } catch (err) {
      toast({ title: 'Erro', description: 'Não foi possível adicionar a linha.', variant: 'destructive' });
    }
  };

  // REMOVER: Apaga do banco e depois da tela
  const removeQaPair = async (id: string) => {
    try {
      const { error } = await supabase
        .from('bot_qa')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setQaList(qaList.filter(qa => qa.id !== id));
      toast({ title: 'Removido', description: 'Pergunta excluída com sucesso.' });
    } catch (err) {
      toast({ title: 'Erro', description: 'Não foi possível excluir.', variant: 'destructive' });
    }
  };

  // ATUALIZAR: Salva enquanto o usuário digita (debounce seria ideal, mas aqui é direto)
  const updateQaPair = async (id: string, field: 'pergunta' | 'resposta', value: string) => {
    // Atualiza localmente para ser instantâneo na tela
    setQaList(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));

    // Salva no Supabase
    try {
      const { error } = await supabase
        .from('bot_qa')
        .update({ [field]: value })
        .eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.error("Erro ao salvar campo:", field);
    }
  };

  const handleRemoverSite = async (siteId: string) => {
    try {
      const { error } = await supabase
        .from('bot_websites')
        .delete()
        .eq('id', siteId);

      if (error) throw error;

      toast({ title: 'Site removido', description: 'O conteúdo foi apagado da memória do bot.' });
      // Atualiza a lista na tela
      fetchSitesDoBot();
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível remover o site.', variant: 'destructive' });
    }
  };

  const handleExtrairSite = async () => {
    if (!websiteUrl) {
      toast({ title: 'Erro', description: 'Digite uma URL válida.', variant: 'destructive' });
      return;
    }
    if (!selectedBot?.id) return;

    setIsExtracting(true);
    toast({ title: 'A extrair...', description: 'Estamos a analisar o site alvo.' });

    try {
      const { data, error } = await supabase.functions.invoke('extrair-site', {
        body: { url: websiteUrl, botId: selectedBot?.id }
      });

      if (error) throw error;

      if (data.sucesso) {
        // setLinksInclusos(data.totalLinks);
        // setLinksExtraidos(data.links);
        await fetchSitesDoBot();
        setWebsiteUrl('');
        toast({
          title: 'Sucesso!',
          description: data.mensagem,
          className: 'bg-green-500 text-white'
        });
      } else {
        throw new Error(data.erro);
      }

    } catch (error: any) {
      toast({
        title: 'Falha na Extração',
        description: error.message || 'Não foi possível extrair os dados do site.',
        variant: 'destructive'
      });
    } finally {
      setIsExtracting(false);
    }
  };

  // 1. Buscar os Textos do Bot
  const fetchTextosDoBot = async () => {
    if (!selectedBot?.id) return;
    try {
      const { data, error } = await supabase
        .from('bot_textos')
        .select('*')
        .eq('bot_id', selectedBot.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedTextos(data || []);
    } catch (error) {
      console.error("Erro ao buscar textos:", error);
    }
  };

  // 2. Salvar um Novo Texto
  const handleSalvarTexto = async () => {
    if (!textoTitulo.trim() || !textoConteudo.trim()) {
      toast({ title: 'Campos vazios', description: 'Preencha o título e o conteúdo.', variant: 'destructive' });
      return;
    }
    if (!selectedBot?.id) return;

    setIsSavingTexto(true);
    try {
      const { error } = await supabase
        .from('bot_textos')
        .insert([{ bot_id: selectedBot.id, titulo: textoTitulo, conteudo: textoConteudo }]);

      if (error) throw error;

      toast({ title: 'Texto salvo!', description: 'O conhecimento foi adicionado à memória do bot.' });
      setTextoTitulo(''); // Limpa o campo
      setTextoConteudo(''); // Limpa o campo
      fetchTextosDoBot(); // Atualiza a lista na tela
    } catch (error) {
      toast({ title: 'Erro ao salvar', description: 'Não foi possível salvar o texto.', variant: 'destructive' });
    } finally {
      setIsSavingTexto(false);
    }
  };

  // 3. Remover um Texto
  const handleRemoverTexto = async (id: string) => {
    try {
      const { error } = await supabase.from('bot_textos').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Texto removido', description: 'Apagado com sucesso.' });
      fetchTextosDoBot(); // Atualiza a lista na tela
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível remover o texto.', variant: 'destructive' });
    }
  };

  // Função que lida com o clique no Card de Modo
  const handleModeSelection = (modeId) => {
    setSelectedMode(modeId); // Muda a cor do botão
    setInstructions(defaultInstructions[modeId]); // Preenche a caixa de texto com o template
  };



  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Treinamento - Bot {selectedBot?.name || ''}</h1>
        <p className="text-muted-foreground">Configure o comportamento, fontes de dados e integrações do seu bot</p>
      </div>

      <Tabs defaultValue="treinamento" className="w-full">
        {/* Alterado para 4 colunas para acomodar a nova aba Avançados */}
        <TabsList className="grid w-full grid-cols-4 max-w-3xl bg-secondary/50 p-1 rounded-xl">
          <TabsTrigger value="treinamento" className="flex items-center gap-2 rounded-lg">
            <MessageCircle className="w-4 h-4" /> Configurações
          </TabsTrigger>
          <TabsTrigger value="fontes" className="flex items-center gap-2 rounded-lg">
            <Database className="w-4 h-4" /> Fontes
          </TabsTrigger>
          <TabsTrigger value="integracoes" className="flex items-center gap-2 rounded-lg">
            <Wifi className="w-4 h-4" /> Integrações
          </TabsTrigger>
          <TabsTrigger value="avancados" className="flex items-center gap-2 rounded-lg">
            <Settings2 className="w-4 h-4" /> Avançados
          </TabsTrigger>
        </TabsList>

        {/* --- ABA 1: CONFIGURAÇÕES --- */}
        {/* Training Tab */}
        <TabsContent value="treinamento" className="space-y-6 mt-6">

          {/* Bot Mode Selection - Com overflow-visible para o Tooltip */}
          <Card className="bg-card border-border overflow-visible">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <CardTitle className="text-foreground">Modo do Bot</CardTitle>

                {/* NOVO: Tooltip / Balão de Ajuda */}
                <div className="relative group cursor-pointer flex items-center">
                  <HelpCircle className="w-4 h-4 text-muted-foreground hover:text-green-500 transition-colors" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden w-64 rounded-md border border-border bg-popover p-3 text-xs text-popover-foreground shadow-xl group-hover:block z-50 text-center">
                    Selecione o arquétipo principal. Isto define como o bot estrutura as respostas:
                    <br /><br />
                    <span className="text-green-500 font-semibold">Vendas:</span> Persuasivo e focado no produto.<br />
                    <span className="text-green-500 font-semibold">Suporte:</span> Direto e focado na resolução.<br />
                    <span className="text-green-500 font-semibold">Ensino:</span> Didático e passo a passo.
                    {/* Triângulo apontando para baixo */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-popover"></div>
                  </div>
                </div>
              </div>
              <CardDescription>
                Selecione o tipo de atendimento que o bot realizará
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {botModes.map((mode) => {
                  const isSelected = selectedMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => handleModeSelection(mode.id)}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${isSelected
                        ? 'border-green-500 bg-green-500/10'
                        : 'border-border hover:border-green-500/50 bg-secondary/50'
                        }`}
                    >
                      <mode.icon className={`w-8 h-8 mb-3 ${isSelected ? 'text-green-500' : 'text-muted-foreground'}`} />
                      <p className={`font-semibold ${isSelected ? 'text-green-500' : 'text-foreground'}`}>
                        {mode.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{mode.description}</p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Bot Instructions */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Instruções do Bot</CardTitle>
              <CardDescription>
                Descreva detalhadamente como o bot deve se comportar nas conversas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Exemplo: Você é um assistente virtual da empresa. Sempre cumprimente o cliente pelo nome quando disponível. Seja objetivo nas respostas."
                className="min-h-[200px] bg-secondary/50 border-border"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                maxLength={200000}
              />
              <div className="flex justify-end">
                <span className="text-sm text-muted-foreground">
                  {instructions.length}/10000 caracteres
                </span>
              </div>
            </CardContent>
          </Card>

          {/* NOVO: Bloco de Configurações Gerais (Nome, Tom e Transferência) */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Configurações Gerais</CardTitle>
              <CardDescription>Personalize a identidade e comportamento do bot</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="bot-name">Nome do Bot</Label>
                <Input
                  id="bot-name"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder="Ex: Marvin"
                  className="max-w-md"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                <div>
                  <p className="font-medium text-foreground">Transferência Automática</p>
                  <p className="text-sm text-muted-foreground">
                    Transferir para humano quando o bot não conseguir resolver
                  </p>
                </div>
                <Switch
                  checked={autoTransfer}
                  onCheckedChange={setAutoTransfer}
                />
              </div>
            </CardContent>
          </Card>

          <Button size="lg" onClick={handleSaveTraining} disabled={isSaving}>
            {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Salvar Configurações
          </Button>
        </TabsContent>

        {/* --- ABA 2: FONTES DE DADOS (NOVO) --- */}
        <TabsContent value="fontes" className="space-y-6 mt-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Suas fontes</h2>
            <p className="text-sm text-muted-foreground mb-6">Escolha as fontes de informação para treinar seu agente.</p>

            <Tabs defaultValue="website" className="w-full">
              <TabsList className="w-full justify-start border-b border-border rounded-none h-auto p-0 bg-transparent flex overflow-x-auto gap-6">
                <TabsTrigger value="website" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 flex items-center gap-2">
                  <Globe className="w-4 h-4" /> WebSite
                </TabsTrigger>
                <TabsTrigger value="qa" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" /> Q&A
                </TabsTrigger>
                <TabsTrigger value="texto" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 flex items-center gap-2">
                  <AlignLeft className="w-4 h-4" /> Texto
                </TabsTrigger>
                <TabsTrigger value="pdf" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> PDF
                </TabsTrigger>
              </TabsList>

              {/* Sub-Aba: WebSite */}
              <TabsContent value="website" className="pt-6">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-lg">WebSite</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <Label className="mb-2 block">Extrair</Label>
                      <div className="flex gap-3">
                        <Input
                          placeholder="https://www.exemplo.com"
                          value={websiteUrl}
                          onChange={(e) => setWebsiteUrl(e.target.value)}
                          className="bg-secondary/50"
                          disabled={isExtracting}
                        />
                        <Button
                          className="bg-[#4ade80] hover:bg-[#22c55e] text-black w-32"
                          onClick={handleExtrairSite} // Conecta o clique à função
                          disabled={isExtracting}
                        >
                          {isExtracting ? (
                            <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Lendo...</>
                          ) : 'Carregar'}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">Essa ação vai extrair todas as informações relevantes do site que você colocar.</p>
                    </div>


                    {/* --- NOVO: LISTA DE SITES SALVOS (RAIZ) --- */}
                    {savedSites && savedSites.length > 0 && (
                      <div className="mt-6 mb-6">
                        <p className="text-sm font-medium mb-3 text-foreground">
                          Fontes de site ativas no cérebro do Bot:
                        </p>
                        <div className="space-y-2">
                          {savedSites.map((site) => (
                            <div
                              key={site.id}
                              className="flex items-center justify-between p-3 rounded-md border border-border bg-card shadow-sm"
                            >
                              <a
                                href={site.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-primary hover:underline truncate mr-4 flex-1 font-medium"
                              >
                                {site.url}
                              </a>

                              {/* O famoso Botão de Apagar! */}
                              <button
                                onClick={() => handleRemoverSite(site.id)}
                                className="text-red-400 hover:text-red-500 hover:bg-red-400/10 p-2 rounded-md transition-colors flex-shrink-0"
                                title="Remover este site da memória do bot"
                              >
                                <svg xmlns="http://www.w0.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 6h18"></path>
                                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Animação e contagem visual da barra verde */}
                    <div className="pt-6 border-t border-border">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium">Links inclusos</span>
                      </div>
                      <div className="w-full bg-secondary h-1 rounded-full mb-2 overflow-hidden relative">
                        <div
                          className={`bg-[#4ade80] h-1 rounded-full transition-all duration-1000 ${isExtracting ? 'w-1/2 animate-pulse' : 'w-full'}`}
                        ></div>
                      </div>
                      <p className="text-xs text-right text-muted-foreground mb-4">
                        {linksInclusos > 0
                          ? `Última extração de ${linksInclusos} endereços finalizada hoje`
                          : 'Nenhuma extração recente'}
                      </p>

                      {/* --- NOVO: LISTA DE LINKS EXTRAÍDOS --- */}
                      {linksExtraidos && linksExtraidos.length > 0 && (
                        <div className="mt-4 max-h-48 overflow-y-auto rounded-md border border-border bg-muted/50 p-4 text-sm custom-scrollbar">
                          <p className="mb-3 font-semibold text-foreground">
                            Páginas mapeadas pelo Agente:
                          </p>
                          <ul className="space-y-1">
                            {linksExtraidos.map((link, index) => (
                              <li key={index} className="flex items-start gap-2 text-muted-foreground hover:text-foreground transition-colors">
                                <span className="text-[#4ade80] mt-0.5">•</span>
                                <a
                                  href={link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="truncate break-all hover:underline"
                                  title={link}
                                >
                                  {link}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {/* -------------------------------------- */}

                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Sub-Aba: Q&A */}
              <TabsContent value="qa" className="pt-6">
                <Card className="bg-card border-border">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Perguntas e respostas</CardTitle>
                    <Button variant="outline" size="sm" onClick={addQaPair}>
                      <Plus className="w-4 h-4 mr-2" /> Adicionar
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {qaList.map((qa) => (
                      <div key={qa.id} className="relative p-4 rounded-lg border border-border bg-secondary/20">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                          onClick={() => removeQaPair(qa.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>

                        <div className="space-y-4 pr-8">
                          <div>
                            <Label className="text-xs text-muted-foreground">Pergunta</Label>
                            <Input
                              placeholder="Ex: Qual o horário de funcionamento?"
                              value={qa.pergunta || ''} // Usando o nome do banco
                              onChange={(e) => updateQaPair(qa.id, 'pergunta', e.target.value)}
                              className="mt-1 bg-background"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Resposta</Label>
                            <Textarea
                              placeholder="Atendemos de segunda a sexta..."
                              value={qa.resposta || ''} // Usando o nome do banco
                              onChange={(e) => updateQaPair(qa.id, 'resposta', e.target.value)}
                              className="mt-1 min-h-[80px] bg-background"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button onClick={addQaPair} variant="outline"
                      className="w-full border-dashed border-2 hover:border-green-500 hover:text-green-500 hover:bg-green-500/10 transition-colors py-6 mt-4"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Adicionar nova Pergunta e Resposta
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Sub-Aba: Texto */}
              <TabsContent value="texto">
                <Card>
                  <CardHeader>
                    <CardTitle>Conhecimento em Texto</CardTitle>
                    <CardDescription>
                      Cole aqui comunicados, história da empresa, regras ou qualquer informação em texto livre para o bot aprender.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">

                    {/* Formulário de Adição */}
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium mb-1 block">Título do Assunto</label>
                        <Input
                          value={textoTitulo}
                          onChange={e => setTextoTitulo(e.target.value)}
                          placeholder="Ex: Política de Férias 2026"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">Conteúdo</label>
                        <textarea
                          value={textoConteudo}
                          onChange={e => setTextoConteudo(e.target.value)}
                          placeholder="Cole todo o texto aqui..."
                          className="flex min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring custom-scrollbar resize-y"
                        />
                      </div>
                      <Button
                        onClick={handleSalvarTexto}
                        disabled={isSavingTexto}
                        className="w-full sm:w-auto"
                      >
                        {isSavingTexto ? 'A guardar...' : 'Guardar na Memória'}
                      </Button>
                    </div>

                    {/* Lista de Textos Salvos */}
                    {savedTextos && savedTextos.length > 0 && (
                      <div className="mt-8 pt-6 border-t border-border">
                        <p className="text-sm font-medium mb-4 text-foreground">
                          Textos ativos no cérebro do Bot:
                        </p>
                        <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
                          {savedTextos.map((texto) => (
                            <div
                              key={texto.id}
                              className="flex flex-col justify-between p-4 rounded-md border border-border bg-card shadow-sm hover:shadow-md transition-shadow relative group"
                            >
                              <div className="pr-8">
                                <h4 className="font-semibold text-sm text-foreground truncate" title={texto.titulo}>
                                  {texto.titulo}
                                </h4>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {texto.conteudo}
                                </p>
                              </div>

                              <button
                                onClick={() => handleRemoverTexto(texto.id)}
                                className="absolute top-3 right-3 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded-md transition-colors"
                                title="Remover este texto"
                              >
                                <svg xmlns="http://www.w0.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 6h18"></path>
                                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </CardContent>
                </Card>
              </TabsContent>

              {/* Sub-Aba: PDF */}
              <TabsContent value="pdf" className="pt-6">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-lg">PDF</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">

                    {/* INPUT INVISÍVEL PARA ARQUIVOS */}
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      multiple
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handlePdfSelection}
                    />

                    <div
                      onClick={() => !isUploadingPdf && fileInputRef.current?.click()}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center transition-all ${isDragging
                        ? 'border-green-500 bg-green-500/10 scale-[1.02]' // Efeito visual ao arrastar
                        : 'border-border bg-secondary/20 hover:bg-secondary/40'}
                        ${isUploadingPdf ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <UploadCloud className="w-10 h-10 text-muted-foreground mb-4" />
                      <div className="flex items-center gap-4">
                        <Button
                          className="bg-[#4ade80] hover:bg-[#22c55e] text-black"
                          disabled={isUploadingPdf}
                        >
                          {isUploadingPdf ? (
                            <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                          ) : 'Carregar'}
                        </Button>
                        <span className="text-sm text-muted-foreground font-medium">ou Solte arquivos aqui</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {uploadedPdfs.map((pdf) => (
                        <div key={pdf.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg border border-border">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <FileText className="w-5 h-5 text-[#4ade80] flex-shrink-0" />
                            <div className="truncate">
                              <p className="text-sm font-medium truncate">{pdf.name}</p>
                              <p className="text-xs text-muted-foreground">{pdf.size}</p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {pdf.url && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-primary"
                                onClick={async () => {
                                  try {
                                    toast({ title: 'Abrindo...', description: 'Carregando documento seguro.', duration: 2000 });
                                    await viewSecurePdf(pdf.url);
                                  } catch (e) {
                                    console.error(e);
                                    toast({ title: 'Erro de Acesso', description: 'Não foi possível carregar o PDF.', variant: 'destructive' });
                                  }
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => setUploadedPdfs(prev => prev.filter(p => p.id !== pdf.id))}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

            </Tabs>
          </div>
        </TabsContent>

        {/* --- ABA 3: INTEGRAÇÕES (WHATSAPP) --- */}
        <TabsContent value="integracoes" className="space-y-6 mt-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#25D366]/20 flex items-center justify-center">
                    <Send className="w-6 h-6 text-[#25D366]" />
                  </div>
                  <div>
                    <CardTitle>WhatsApp Web</CardTitle>
                    <CardDescription>Conecte seu WhatsApp para receber mensagens</CardDescription>
                  </div>
                </div>
                <Badge variant={whatsappConnected ? 'default' : 'secondary'} className={whatsappConnected ? 'bg-[#25D366]' : ''}>
                  {whatsappConnected ? 'Conectado' : 'Desconectado'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {whatsappConnected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-[#25D366]/10 rounded-lg border border-[#25D366]/30">
                    <CheckCircle2 className="w-8 h-8 text-[#25D366]" />
                    <p className="font-medium">Sessão ativa: {whatsappPhone}</p>
                  </div>
                  <Button variant="destructive" onClick={handleDisconnect} disabled={isDisconnecting}>
                    Desconectar
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {qrCode ? (
                    <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-lg">
                      <img src={qrCode} alt="QR Code" className="w-64 h-64 object-contain" />
                      <p className="text-sm text-gray-600">Escaneie o código com seu WhatsApp</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 p-8 bg-secondary/50 rounded-lg border-2 border-dashed">
                      <QrCode className="w-16 h-16 text-muted-foreground" />
                      <p className="font-medium">Nenhuma sessão ativa</p>
                    </div>
                  )}
                  <Button className="w-full" onClick={handleGenerateQR} disabled={isGeneratingQR}>
                    {isGeneratingQR ? "Gerando..." : qrCode ? "Gerar Novo QR Code" : "Gerar QR Code"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* NOVO: Outras integrações (Instagram e Telegram) restauradas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-card/50 border-border opacity-60">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Instagram className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Instagram</p>
                  <p className="text-sm text-muted-foreground">Em breve</p>
                </div>
                <Badge variant="outline">Em breve</Badge>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border opacity-60">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="w-12 h-12 rounded-xl bg-[#0088cc] flex items-center justify-center">
                  <Send className="w-6 h-6 text-white" />
                        <p className="font-medium text-foreground">Telegram</p>
                  <p className="text-sm text-muted-foreground">Em breve</p>
                </div>
                <Badge variant="outline">Em breve</Badge>
              </CardContent>
            </Card>
          </div>

        </TabsContent>

        {/* --- ABA 4: AVANÇADOS --- */}
        <TabsContent value="avancados" className="space-y-6 mt-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Autorização Avançada</CardTitle>
              <CardDescription>
                Gerencie permissões estritas para usuários matriculados no seu banco local.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                <div>
                  <p className="font-medium text-foreground">Verificação de Manutenção/Autorização</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Exigir que a matrícula do usuário ou informações estejam presentes e autorizadas na base de dados.
                  </p>
                </div>
                <Switch
                  checked={authorizationEnabled}
                  onCheckedChange={setAuthorizationEnabled}
                />
              </div>
            </CardContent>
          </Card>

          {/* NOVO BLOCO DE MATRICULAS */}
          <Card className="bg-card border-border mt-6">
            <CardHeader>
              <CardTitle>Base de Usuários Autorizados</CardTitle>
              <CardDescription>Envie matrículas autorizadas a realizar atendimentos no robô.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Adição Manual */}
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Label className="text-xs mb-1 block">Matrícula</Label>
                  <Input placeholder="Ex: 4616" value={novaMatricula} onChange={e => setNovaMatricula(e.target.value)} />
                </div>
                <div className="flex-1">
                  <Label className="text-xs mb-1 block">Nome do Usuário</Label>
                  <Input placeholder="Ex: Kauê Augusto" value={novoNomeMatricula} onChange={e => setNovoNomeMatricula(e.target.value)} />
                </div>
                <Button onClick={handleAddMatricula}>
                  <Plus className="w-4 h-4 mr-2" /> Adicionar
                </Button>
              </div>

              <div className="relative flex py-3 items-center">
                  <div className="flex-grow border-t border-border"></div>
                  <span className="flex-shrink-0 mx-4 text-muted-foreground text-xs uppercase">Ou importar em lote</span>
                  <div className="flex-grow border-t border-border"></div>
              </div>

              {/* Importação CSV */}
              <div>
                <input type="file" accept=".csv" className="hidden" ref={csvFileInputRef} onChange={handleCsvUpload} />
                <Button variant="outline" className="w-full border-dashed" onClick={() => !isUploadingCsv && csvFileInputRef.current?.click()}>
                  {isUploadingCsv ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
                  Importar Tabela (.CSV)
                </Button>
                <p className="text-xs text-muted-foreground mt-2 text-center">Faça o download da sua planilha como 'Valores Separados por Vírgulas (.csv)'. A coluna A deve ser a Matrícula e a coluna B o Nome.</p>
              </div>

              {/* Lista de matriculas */}
              {matriculasList.length > 0 && (
                <div className="mt-6 border rounded-lg overflow-hidden">
                  <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-sm text-left align-middle">
                      <thead className="text-xs text-muted-foreground bg-secondary/50 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 font-medium">Matrícula</th>
                          <th className="px-4 py-3 font-medium">Nome</th>
                          <th className="px-4 py-3 font-medium text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {matriculasList.map(item => (
                          <tr key={item.id} className="hover:bg-muted/50">
                            <td className="px-4 py-3 font-medium">{item.matricula}</td>
                            <td className="px-4 py-3">{item.nome || '-'}</td>
                            <td className="px-4 py-3 text-right">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10" onClick={() => handleRemoverMatricula(item.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}