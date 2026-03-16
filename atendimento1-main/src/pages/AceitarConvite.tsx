import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, UserPlus } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface InviteData {
  id: string;
  email: string;
  role: AppRole;
  bot_ids: string[];
  expires_at: string;
}

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  atendente: 'Atendente',
  visualizador: 'Visualizador',
};

const roleColors: Record<AppRole, string> = {
  admin: 'bg-destructive/10 text-destructive border-destructive/20',
  supervisor: 'bg-primary/10 text-primary border-primary/20',
  atendente: 'bg-accent text-accent-foreground border-accent',
  visualizador: 'bg-muted text-muted-foreground border-border',
};

export default function AceitarConvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Token de convite não fornecido');
      setIsLoading(false);
      return;
    }

    fetchInvite();
  }, [token]);

  const fetchInvite = async () => {
    try {
      // Use the secure function to get invite by token
      const { data, error: fetchError } = await supabase
        .rpc('get_invite_by_token', { _token: token });

      if (fetchError) {
        console.error('Error fetching invite:', fetchError);
        setError('Erro ao buscar convite');
        return;
      }

      if (!data || data.length === 0) {
        setError('Convite não encontrado ou já foi utilizado');
        return;
      }

      const inviteData = data[0];

      setInvite({
        id: inviteData.id,
        email: inviteData.email,
        role: inviteData.role,
        bot_ids: inviteData.bot_ids || [],
        expires_at: inviteData.expires_at,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!invite) return;

    if (!name.trim()) {
      toast.error('Por favor, insira seu nome');
      return;
    }

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create user account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: {
          data: {
            name,
          },
          emailRedirectTo: window.location.origin,
        },
      });

      if (signUpError) {
        console.error('Sign up error:', signUpError);
        
        if (signUpError.message.includes('already registered')) {
          toast.error('Este email já está cadastrado. Faça login na sua conta.');
          navigate('/login');
          return;
        }
        
        toast.error('Erro ao criar conta: ' + signUpError.message);
        return;
      }

      if (!authData.user) {
        toast.error('Erro ao criar conta');
        return;
      }

      // Wait a moment for the profile trigger to run
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 2. Assign roles based on invite
      // For admin role, we insert a single global role (bot_id = null)
      // For other roles, we insert one role per bot_id
      if (invite.role === 'admin') {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: authData.user.id,
            role: invite.role,
            bot_id: null,
          });

        if (roleError) {
          console.error('Error assigning role:', roleError);
          // Don't fail the whole process, the admin can fix this later
        }
      } else {
        // Insert role for each bot
        const roleInserts = invite.bot_ids.length > 0 
          ? invite.bot_ids.map(botId => ({
              user_id: authData.user!.id,
              role: invite.role,
              bot_id: botId,
            }))
          : [{
              user_id: authData.user!.id,
              role: invite.role,
              bot_id: null,
            }];

        const { error: roleError } = await supabase
          .from('user_roles')
          .insert(roleInserts);

        if (roleError) {
          console.error('Error assigning roles:', roleError);
        }
      }

      // 3. Mark invite as accepted
      await supabase
        .from('invites')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invite.id);

      toast.success('Conta criada com sucesso!');
      navigate('/dashboard');
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('Erro inesperado ao criar conta');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <CardTitle>Convite Inválido</CardTitle>
            <CardDescription>
              {error || 'Este convite não é válido'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate('/login')} variant="outline">
              Ir para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <UserPlus className="w-12 h-12 text-primary mx-auto mb-4" />
          <CardTitle>Aceitar Convite</CardTitle>
          <CardDescription>
            Você foi convidado para acessar o sistema como{' '}
            <Badge variant="outline" className={roleColors[invite.role]}>
              {roleLabels[invite.role]}
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={invite.email}
                disabled
                className="bg-muted"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                type="text"
                placeholder="Seu nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Digite a senha novamente"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Criando conta...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Criar Minha Conta
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-4">
            Já tem uma conta?{' '}
            <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/login')}>
              Fazer login
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
