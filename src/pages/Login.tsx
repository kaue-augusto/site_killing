import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Sun, Moon } from 'lucide-react';

interface ChatMessage {
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
}

const simulatedMessages: ChatMessage[] = [
  { sender: 'user', text: 'Olá! Preciso de ajuda para configurar minha integração com o CRM.', timestamp: '14:32' },
  { sender: 'agent', text: 'Olá! Com certeza. Vou te guiar no processo. Você já possui a chave API do seu CRM em mãos?', timestamp: '14:32' },
  { sender: 'user', text: 'Sim, já tenho a chave gerada aqui.', timestamp: '14:33' },
  { sender: 'agent', text: 'Perfeito! Basta acessar Configurações > Integrações no painel, selecionar seu CRM e colar a chave. Deseja que eu envie o link direto?', timestamp: '14:33' },
  { sender: 'user', text: 'Quero sim, por favor!', timestamp: '14:33' },
  { sender: 'agent', text: 'Aqui está: kisabot.tech/configuracoes. Se precisar de mais alguma coisa, estarei por aqui! 🚀', timestamp: '14:34' }
];

const AgentLogo = () => (
  <div className="relative flex items-center justify-center w-20 h-20">
    <div className="absolute inset-0 bg-primary/10 rounded-full animate-ping opacity-75" />
    <div className="absolute inset-2 bg-primary/20 rounded-full animate-pulse" />
    <div className="relative w-14 h-14 bg-gradient-to-tr from-primary to-emerald-400 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 border border-primary/20">
      <svg
        className="w-8 h-8 text-primary-foreground animate-pulse"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Square Robot Head with Rounded Corners */}
        <rect x="4" y="8" width="16" height="11" rx="2.5" />
        {/* Eyes */}
        <circle cx="9" cy="13" r="1.5" fill="currentColor" />
        <circle cx="15" cy="13" r="1.5" fill="currentColor" />
        {/* Mouth */}
        <path d="M9 16.5h6" strokeWidth="2.5" />
        {/* Antenna */}
        <path d="M12 8V4" />
        <circle cx="12" cy="3" r="1" className="text-emerald-300 fill-current" />
        {/* Ears */}
        <path d="M4 12.5H2M20 12.5h2" />
      </svg>
    </div>
  </div>
);

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp } = useAuth();
  const { theme, setTheme } = useTheme();

  const [isLoading, setIsLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');

  // Live Chat Simulation State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    const runSimulation = () => {
      if (currentMessageIndex < simulatedMessages.length) {
        setIsTyping(true);
        timer = setTimeout(() => {
          setChatMessages(prev => [...prev, simulatedMessages[currentMessageIndex]]);
          setIsTyping(false);
          setCurrentMessageIndex(prev => prev + 1);
        }, 1800); // realistic delay
      } else {
        // Reset simulation after a pause
        timer = setTimeout(() => {
          setChatMessages([]);
          setCurrentMessageIndex(0);
        }, 5000);
      }
    };

    runSimulation();

    return () => clearTimeout(timer);
  }, [currentMessageIndex]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(loginEmail, loginPassword);

    if (error) {
      toast.error('Erro ao fazer login', {
        description: error.message,
      });
    } else {
      toast.success('Login realizado com sucesso!');
      navigate(from, { replace: true });
    }

    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (signupPassword !== signupConfirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (signupPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setIsLoading(true);

    const { error } = await signUp(signupEmail, signupPassword, signupName);

    if (error) {
      toast.error('Erro ao criar conta', {
        description: error.message,
      });
    } else {
      toast.success('Conta criada com sucesso!', {
        description: 'Você já pode fazer login.',
      });
      navigate(from, { replace: true });
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex w-full bg-background overflow-hidden relative">
      {/* Left Column: Brand Showcase (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-12 bg-slate-950 text-white overflow-hidden">
        {/* Decorative background grid and glowing orbs */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40" />
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/25 rounded-full filter blur-[80px] animate-pulse" />
        <div className="absolute -bottom-40 right-10 w-96 h-96 bg-emerald-500/15 rounded-full filter blur-[100px] animate-pulse" />

        {/* Header with Kisabot Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-emerald-400 flex items-center justify-center shadow-md">
            <svg
              className="w-6 h-6 text-primary-foreground"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="4" y="8" width="16" height="11" rx="2.5" />
              <circle cx="9" cy="13" r="1.5" fill="currentColor" />
              <circle cx="15" cy="13" r="1.5" fill="currentColor" />
              <path d="M9 16.5h6" strokeWidth="2.5" />
              <path d="M12 8V4" />
              <circle cx="12" cy="3" r="1" className="text-emerald-300 fill-current" />
              <path d="M4 12.5H2M20 12.5h2" />
            </svg>
          </div>
          <div>
            <span className="text-xl font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
              KISABOT
            </span>
          </div>
        </div>

        {/* Center content: Tagline + Chat Simulation */}
        <div className="relative z-10 my-auto py-10 max-w-xl">
          <h2 className="text-4xl font-extrabold tracking-tight leading-tight lg:text-5xl text-white">
            Agentes Inteligentes.
            <span className="block mt-2 bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent py-2 mb-4">
              Inteligência que conecta.
            </span>
          </h2>
          <p className="mt-6 text-slate-400 text-lg leading-relaxed max-w-lg">
            Conecte seus atendimentos, treine agentes personalizados com seus próprios dados e otimize a comunicação da sua empresa 24 horas por dia.
          </p>

          {/* Simulated Live Chat Container */}
          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl p-6 shadow-2xl relative overflow-hidden">
            {/* Header of Simulated Chat */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-primary"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="4" y="8" width="16" height="11" rx="2.5" />
                      <circle cx="9" cy="13" r="1.5" fill="currentColor" />
                      <circle cx="15" cy="13" r="1.5" fill="currentColor" />
                      <path d="M9 16.5h6" />
                      <path d="M12 8V4" />
                      <path d="M4 12.5H2M20 12.5h2" />
                    </svg>
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Kisabot Agent</p>
                  <p className="text-[10px] text-emerald-400">Online e digitando...</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-0.5 rounded text-[10px] text-slate-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                SIMULAÇÃO EM TEMPO REAL
              </div>
            </div>

            {/* Chat Message Thread */}
            <div className="space-y-3 min-h-[180px] max-h-[180px] overflow-y-auto pr-1 flex flex-col justify-end">
              {chatMessages.length === 0 && !isTyping && (
                <div className="text-center text-slate-500 text-xs my-auto py-8">
                  Aguardando nova simulação...
                </div>
              )}
              
              {chatMessages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex flex-col max-w-[85%] ${
                    msg.sender === 'user' ? 'self-end items-end' : 'self-start items-start'
                  }`}
                >
                  <div
                    className={`px-3.5 py-2 rounded-2xl text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-primary text-primary-foreground rounded-tr-none'
                        : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700/50'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[9px] text-slate-500 mt-1 px-1">{msg.timestamp}</span>
                </div>
              ))}

              {isTyping && (
                <div className="self-start flex flex-col items-start max-w-[85%]">
                  <div className="bg-slate-800 border border-slate-700/50 px-3.5 py-2 flex gap-1 items-center rounded-2xl rounded-tl-none">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer of brand panel: stats & badges */}
        <div className="relative z-10 flex items-center justify-between border-t border-slate-800/80 pt-6">
          <div className="flex gap-8">
            <div>
              <p className="text-lg font-bold text-white">99.8%</p>
              <p className="text-xs text-slate-500">Precisão da IA</p>
            </div>
            <div>
              <p className="text-lg font-bold text-white">+1M</p>
              <p className="text-xs text-slate-500">Conversas/mês</p>
            </div>
            <div>
              <p className="text-lg font-bold text-white">&lt; 2s</p>
              <p className="text-xs text-slate-500">Tempo de resposta</p>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            © {new Date().getFullYear()} Kisabot.tech
          </div>
        </div>
      </div>

      {/* Right Column: Authentication Card */}
      <div className="w-full lg:w-[45%] flex flex-col justify-center items-center p-6 sm:p-12 relative bg-background">
        {/* Theme Switcher Button */}
        <div className="absolute top-6 right-6 z-20">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="rounded-full w-10 h-10 hover:bg-muted"
            title="Alternar Tema"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5 text-yellow-500 transition-all" />
            ) : (
              <Moon className="h-5 w-5 text-slate-700 transition-all" />
            )}
          </Button>
        </div>

        {/* Decorative background grid on mobile */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-70 lg:hidden" />

        <div className="w-full max-w-md relative z-10 flex flex-col items-center">
          {/* Brand Header for Mobile (Hidden on Desktop) */}
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-md">
              <svg
                className="w-5 h-5 text-primary-foreground"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="4" y="8" width="16" height="11" rx="2.5" />
                <circle cx="9" cy="13" r="1.5" fill="currentColor" />
                <circle cx="15" cy="13" r="1.5" fill="currentColor" />
                <path d="M9 16.5h6" />
                <path d="M12 8V4" />
                <path d="M4 12.5H2M20 12.5h2" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-wider text-foreground">
              KISABOT
            </span>
          </div>

          <Card className="w-full border border-border/80 shadow-xl bg-card/40 backdrop-blur-md">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <AgentLogo />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">Agentes Inteligentes</CardTitle>
              <CardDescription className="text-sm">
                Entre na sua central de atendimentos inteligente
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 p-1 bg-muted/65 rounded-lg">
                  <TabsTrigger value="login" className="rounded-md transition-all duration-200">
                    Acessar
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="rounded-md transition-all duration-200">
                    Criar Conta
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="login" className="mt-4">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="login-email">Email corporativo</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="exemplo@empresa.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                        disabled={isLoading}
                        className="h-10 border-border/80 focus-visible:ring-primary/45"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="login-password">Senha de acesso</Label>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        className="h-10 border-border/80 focus-visible:ring-primary/45"
                      />
                    </div>
                    <Button type="submit" className="w-full h-10 font-medium tracking-wide bg-primary hover:bg-primary/95 text-primary-foreground shadow-sm transition-all duration-200" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Autenticando...
                        </>
                      ) : (
                        'Entrar na Central'
                      )}
                    </Button>
                  </form>
                </TabsContent>
                
                <TabsContent value="signup" className="mt-4">
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-name">Nome Completo</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Seu nome completo"
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        required
                        disabled={isLoading}
                        className="h-10 border-border/80 focus-visible:ring-primary/45"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-email">Email corporativo</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="exemplo@empresa.com"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        required
                        disabled={isLoading}
                        className="h-10 border-border/80 focus-visible:ring-primary/45"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-password">Senha</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        className="h-10 border-border/80 focus-visible:ring-primary/45"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-confirm-password">Confirmar Senha</Label>
                      <Input
                        id="signup-confirm-password"
                        type="password"
                        placeholder="Repita sua senha"
                        value={signupConfirmPassword}
                        onChange={(e) => setSignupConfirmPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        className="h-10 border-border/80 focus-visible:ring-primary/45"
                      />
                    </div>
                    <Button type="submit" className="w-full h-10 font-medium tracking-wide bg-primary hover:bg-primary/95 text-primary-foreground shadow-sm transition-all duration-200" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Criando credenciais...
                        </>
                      ) : (
                        'Criar Minha Central'
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter className="text-center text-xs text-muted-foreground pt-0 pb-6">
              <p className="w-full">
                Ao continuar, você concorda com nossos termos de serviço e privacidade.
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
