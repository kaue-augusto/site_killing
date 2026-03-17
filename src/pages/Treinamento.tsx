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
  ShoppingCart,
  Headphones,
  Users,
  Settings2,
  MessageCircle,
  QrCode,
  Wifi,
  WifiOff,
  RefreshCw,
  Send,
  Instagram,
  CheckCircle2,
  Database,
  Globe,
  HelpCircle,
  AlignLeft,
  FileText,
  UploadCloud,
  Trash2,
  Plus,
  Eye
} from 'lucide-react';
import { useBot } from '@/contexts/BotContext';
import { useToast } from '@/hooks/use-toast';
import { generateWhatsAppQR, getWhatsAppStatus, disconnectWhatsApp, saveBotTraining, BotTrainingConfig, BotType, uploadPdfToGCP, fetchBotPdfs } from '@/lib/api';

const botModes = [
  { id: 'vendas', label: 'Vendas', icon: ShoppingCart, description: 'Focado em conversão e vendas' },
  { id: 'suporte', label: 'Suporte', icon: Headphones, description: 'Atendimento e resolução de problemas' },
  { id: 'rh', label: 'RH', icon: Users, description: 'Recursos humanos e funcionários' },
  { id: 'personalizado', label: 'Personalizado', icon: Settings2, description: 'Configure do seu jeito' },
];

const toneOptions = [
  { id: 'formal', label: 'Formal' },
  { id: 'informal', label: 'Informal' },
  { id: 'neutro', label: 'Neutro' },
];

export default function Treinamento() {
  const { selectedBot, refreshBots } = useBot();
  const { toast } = useToast();
  const { user } = useAuth();

  // Training state Estados de Configuração do Bot
  const [selectedMode, setSelectedMode] = useState('suporte');
  const [instructions, setInstructions] = useState('');
  const [botName, setBotName] = useState(selectedBot?.name || '');
  const [tone, setTone] = useState('formal');
  const [autoTransfer, setAutoTransfer] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fontes State (NOVO)
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [linksInclusos, setLinksInclusos] = useState(0);
  const [qaList, setQaList] = useState<any[]>([]);

  // Estados de PDF (Dinâmicos)
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [uploadedPdfs, setUploadedPdfs] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // WhatsApp state
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  // 1. Crie o estado inicial
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState('');

  const handlePdfSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validação de segurança simples no frontend
    if (file.type !== 'application/pdf') {
      toast({ title: 'Formato inválido', description: 'Por favor, selecione apenas arquivos PDF.', variant: 'destructive' });
      return;
    }

    setIsUploadingPdf(true);
    try {
      // Chama a função da API passando o arquivo real e o slug do bot para a pasta
      const newPdf = await uploadPdfToGCP(file, selectedBot?.id || 'default', selectedBot?.slug);

      // Adiciona o novo PDF na lista visual
      setUploadedPdfs(prev => [...prev, newPdf]);

      toast({ title: 'PDF enviado!', description: 'O arquivo foi salvo no Google Cloud Storage.' });
    } catch (error) {
      toast({ title: 'Erro no envio', description: 'Não foi possível enviar o arquivo.', variant: 'destructive' });
    } finally {
      setIsUploadingPdf(false);
      // Limpa o input para permitir selecionar o mesmo arquivo de novo se precisar
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 2. DEPOIS: O useEffect para sincronização
  useEffect(() => {
    if (selectedBot?.id) {
      // Limpa o QR Code anterior ao trocar de bot para não confundir
      setQrCode(null);
      // Carrega os dados reais do banco
      setInstructions(selectedBot.instructions || '');
      setBotName(selectedBot.name || '');

      // === NOVO CÓDIGO: Busca os PDFs da tabela arquivos_pdf ===
      const loadPdfs = async () => {
        setIsLoadingFiles(true);
        try {
          // Passa o slug do bot selecionado para buscar apenas os arquivos dele
          const pdfs = await fetchBotPdfs(selectedBot.id);
          setUploadedPdfs(pdfs);
        } catch (error) {
          console.error("Erro ao carregar lista de PDFs:", error);
        } finally {
          setIsLoadingFiles(false);
        }
      };

      loadPdfs();
      // =========================================================
      const loadQA = async () => {
        try {
          const { data, error } = await supabase
            .from('bot_qa')
            .select('*')
            .eq('bot_id', selectedBot.id)
            .order('created_at', { ascending: true });

          if (error) throw error;
          setQaList(data || []); // Se não houver nada, fica []
        } catch (error: any) {
          console.error("Erro ao carregar Q&A:", error.message);
        }
      };

      loadQA();
    }
    // --- LÓGICA DE VERIFICAÇÃO AUTOMÁTICA (POLLING) ---
    let intervalId: NodeJS.Timeout;

    const checkConnection = async () => {
      // Só verifica se tiver a instância cadastrada no Supabase
      if (!selectedBot?.zapInstance || !selectedBot?.zapToken) return;

      try {
        const status = await getWhatsAppStatus(selectedBot.zapInstance, selectedBot.zapToken);

        setWhatsappConnected(status.connected);
        if (status.phone) setWhatsappPhone(status.phone);

        // Se a resposta for "Conectado", limpa o QR Code da tela automaticamente
        if (status.connected) {
          setQrCode(null);
          setIsGeneratingQR(false);
        }
      } catch (error) {
        console.error("Erro ao verificar status na Z-API");
      }
    };

    // Verifica o status na hora que abre a tela
    checkConnection();

    // Fica verificando a cada 5 segundos
    intervalId = setInterval(checkConnection, 5000);

    // Limpa o timer se você fechar a página ou mudar de bot
    return () => clearInterval(intervalId);
  }, [selectedBot]);


  const handleSaveTraining = async () => {
    if (!selectedBot || !user) return;
    setIsSaving(true);
    try {
      // Como você definiu que tudo será inserido nas instructions,
      // passamos o estado 'instructions' do componente
      await saveBotTraining(selectedBot.slug, {
        instructions,
        user_id: user.id
      });

      await refreshBots();

      toast({
        title: 'Treinamento salvo!',
        description: 'As instruções de personalidade foram sincronizadas com o banco.',
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
        setLinksInclusos(data.totalLinks);
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

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Treinamento - Bot {selectedBot?.name || ''}</h1>
        <p className="text-muted-foreground">Configure o comportamento, fontes de dados e integrações do seu bot</p>
      </div>

      <Tabs defaultValue="treinamento" className="w-full">
        {/* Alterado para 3 colunas para acomodar a nova aba */}
        <TabsList className="grid w-full grid-cols-3 max-w-2xl bg-secondary/50 p-1 rounded-xl">
          <TabsTrigger value="treinamento" className="flex items-center gap-2 rounded-lg">
            <MessageCircle className="w-4 h-4" /> Configurações
          </TabsTrigger>
          <TabsTrigger value="fontes" className="flex items-center gap-2 rounded-lg">
            <Database className="w-4 h-4" /> Fontes
          </TabsTrigger>
          <TabsTrigger value="integracoes" className="flex items-center gap-2 rounded-lg">
            <Wifi className="w-4 h-4" /> Integrações
          </TabsTrigger>
        </TabsList>

        {/* --- ABA 1: CONFIGURAÇÕES --- */}
        {/* Training Tab */}
        <TabsContent value="treinamento" className="space-y-6 mt-6">
          {/* Bot Mode Selection */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Modo do Bot</CardTitle>
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
                      onClick={() => setSelectedMode(mode.id)}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50 bg-secondary/50'
                        }`}
                    >
                      <mode.icon className={`w-8 h-8 mb-3 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <p className={`font-semibold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                        {mode.label} </p>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bot-name">Nome do Bot</Label>
                  <Input
                    id="bot-name"
                    value={botName}
                    onChange={(e) => setBotName(e.target.value)}
                    placeholder="Ex: Marvin"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tom de Voz</Label>
                  <div className="flex gap-2">
                    {toneOptions.map((option) => (
                      <Button
                        key={option.id}
                        variant={tone === option.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTone(option.id)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
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
                      <p className="text-xs text-right text-muted-foreground">
                        {linksInclusos > 0
                          ? `Última extração de ${linksInclusos} endereços finalizada hoje`
                          : 'Nenhuma extração recente'}
                      </p>
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
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Sub-Aba: Texto */}
              <TabsContent value="texto" className="pt-6">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-lg">Texto</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="Cole ou digite seu texto de treinamento aqui..."
                      value={sourceText}
                      onChange={(e) => setSourceText(e.target.value)}
                      className="min-h-[300px] bg-secondary/50 font-mono text-sm"
                    />
                    <Button>Salvar Texto</Button>
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
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handlePdfSelection}
                    />

                    <div
                      onClick={() => !isUploadingPdf && fileInputRef.current?.click()}
                      className={`border-2 border-dashed border-border rounded-xl p-8 text-center flex flex-col items-center justify-center bg-secondary/20 transition-colors ${isUploadingPdf ? 'opacity-50 cursor-not-allowed' : 'hover:bg-secondary/40 cursor-pointer'}`}
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
                              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={() => window.open(pdf.url, '_blank')}>
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
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Telegram</p>
                  <p className="text-sm text-muted-foreground">Em breve</p>
                </div>
                <Badge variant="outline">Em breve</Badge>
              </CardContent>
            </Card>
          </div>

        </TabsContent>
      </Tabs>
    </div>
  );
}