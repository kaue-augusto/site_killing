import { useState, useEffect } from 'react';
import { useBot } from '@/contexts/BotContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  UserPlus, 
  Mail, 
  MoreHorizontal, 
  Shield, 
  Users, 
  Clock,
  Trash2,
  RefreshCw,
  XCircle,
  CheckCircle,
  Copy,
  Loader2
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface UserWithRoles {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  is_online: boolean;
  last_seen: string | null;
  created_at: string;
  roles: {
    id: string;
    role: AppRole;
    bot_id: string | null;
  }[];
}

interface PendingInvite {
  id: string;
  email: string;
  role: AppRole;
  bot_ids: string[];
  token: string;
  created_at: string;
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

const roleDescriptions: Record<AppRole, string> = {
  admin: 'Acesso total ao sistema. Pode gerenciar bots, usuários, configurações e visualizar todos os relatórios.',
  supervisor: 'Pode visualizar dashboard, gerenciar atendimentos e supervisionar equipe.',
  atendente: 'Acesso aos atendimentos e contatos. Pode realizar atendimentos e ver histórico.',
  visualizador: 'Acesso somente leitura. Pode visualizar atendimentos e relatórios.',
};

export default function Configuracoes() {
  const { selectedBot, bots } = useBot();
  const { user, isAdmin } = useAuth();
  
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AppRole>('atendente');
  const [selectedBotIds, setSelectedBotIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);

  // Edit Permissions State
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<AppRole>('atendente');
  const [editSelectedBotIds, setEditSelectedBotIds] = useState<string[]>([]);
  const [isSavingRole, setIsSavingRole] = useState(false);

  // Fetch users and invites on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchUsers(), fetchInvites()]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      toast.error('Erro ao carregar usuários');
      return;
    }

    // Fetch roles separately
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('*');

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
    }

    // Combine profiles with their roles
    const usersWithRoles: UserWithRoles[] = (profiles || []).map(profile => ({
      id: profile.id,
      name: profile.name,
      email: profile.email,
      avatar_url: profile.avatar_url,
      is_online: profile.is_online || false,
      last_seen: profile.last_seen,
      created_at: profile.created_at || '',
      roles: (roles || [])
        .filter(r => r.user_id === profile.id)
        .map(r => ({
          id: r.id,
          role: r.role,
          bot_id: r.bot_id,
        })),
    }));

    setUsers(usersWithRoles);
  };

  const fetchInvites = async () => {
    const { data, error } = await supabase
      .from('invites')
      .select('*')
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invites:', error);
      return;
    }

    setPendingInvites((data || []).map(inv => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      bot_ids: inv.bot_ids || [],
      token: inv.token,
      created_at: inv.created_at || '',
      expires_at: inv.expires_at,
    })));
  };

  const handleInviteUser = async () => {
    if (!inviteEmail) {
      toast.error('Por favor, insira um email válido');
      return;
    }

    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    // For non-admin roles, require at least one bot
    if (inviteRole !== 'admin' && selectedBotIds.length === 0) {
      toast.error('Selecione pelo menos um bot para este usuário');
      return;
    }

    setIsSending(true);
    try {
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const { error } = await supabase.from('invites').insert({
        email: inviteEmail,
        role: inviteRole,
        bot_ids: inviteRole === 'admin' ? [] : selectedBotIds,
        token,
        expires_at: expiresAt.toISOString(),
        invited_by: user.id,
      });

      if (error) {
        console.error('Error creating invite:', error);
        toast.error('Erro ao criar convite');
        return;
      }

      const inviteLink = `${window.location.origin}/aceitar-convite?token=${token}`;
      setGeneratedInviteLink(inviteLink);
      
      await fetchInvites();
      toast.success(`Convite criado para ${inviteEmail}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyLink = () => {
    if (generatedInviteLink) {
      navigator.clipboard.writeText(generatedInviteLink);
      toast.success('Link copiado para a área de transferência');
    }
  };

  const handleCloseInviteDialog = () => {
    setIsInviteDialogOpen(false);
    setInviteEmail('');
    setInviteRole('atendente');
    setSelectedBotIds([]);
    setGeneratedInviteLink(null);
  };

  const handleResendInvite = async (invite: PendingInvite) => {
    const inviteLink = `${window.location.origin}/aceitar-convite?token=${invite.token}`;
    await navigator.clipboard.writeText(inviteLink);
    toast.success(`Link do convite copiado para ${invite.email}`);
  };

  const handleCancelInvite = async (inviteId: string) => {
    const { error } = await supabase
      .from('invites')
      .delete()
      .eq('id', inviteId);

    if (error) {
      console.error('Error canceling invite:', error);
      toast.error('Erro ao cancelar convite');
      return;
    }

    setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
    toast.success('Convite cancelado');
  };

  const handleOpenEditDialog = (userItem: UserWithRoles) => {
    setEditingUserId(userItem.id);
    const primaryRole = getPrimaryRole(userItem.roles) || 'atendente';
    setEditRole(primaryRole);
    setEditSelectedBotIds(userItem.roles.map(r => r.bot_id).filter(Boolean) as string[]);
    setIsEditDialogOpen(true);
  };

  const handleSavePermissions = async () => {
    if (!editingUserId) return;
    
    if (editRole !== 'admin' && editSelectedBotIds.length === 0) {
      toast.error('Selecione pelo menos um bot para este usuário');
      return;
    }

    setIsSavingRole(true);
    try {
      // 1. Delete all existing roles for this user
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', editingUserId);

      if (deleteError) {
        toast.error('Erro ao limpar permissões antigas');
        return;
      }

      // 2. Insert new roles
      if (editRole === 'admin') {
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({
            user_id: editingUserId,
            role: editRole,
            bot_id: null,
            assigned_by: user?.id
          });
          
        if (insertError) {
          toast.error('Erro ao salvar nova permissão');
          return;
        }
      } else {
        const roleInserts = editSelectedBotIds.map(botId => ({
          user_id: editingUserId,
          role: editRole,
          bot_id: botId,
          assigned_by: user?.id
        }));

        const { error: insertError } = await supabase
          .from('user_roles')
          .insert(roleInserts);

        if (insertError) {
          toast.error('Erro ao salvar novas permissões');
          return;
        }
      }

      await fetchUsers();
      toast.success('Permissões atualizadas com sucesso');
      setIsEditDialogOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Ocorreu um erro ao atualizar');
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleRevokeAccess = async (userId: string) => {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Error revoking access:', error);
      toast.error('Erro ao revogar acesso');
      return;
    }

    await fetchUsers();
    toast.success('Acesso revogado');
  };

  const getPrimaryRole = (userRoles: UserWithRoles['roles']): AppRole | null => {
    // Priority: admin > supervisor > atendente > visualizador
    const priority: AppRole[] = ['admin', 'supervisor', 'atendente', 'visualizador'];
    for (const role of priority) {
      if (userRoles.some(r => r.role === role)) {
        return role;
      }
    }
    return null;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleBotSelection = (botId: string) => {
    setSelectedBotIds(prev => 
      prev.includes(botId) 
        ? prev.filter(id => id !== botId)
        : [...prev, botId]
    );
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie usuários e permissões do painel
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="usuarios" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="usuarios" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="convites" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Convites Pendentes
            {pendingInvites.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingInvites.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="permissoes" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Permissões
          </TabsTrigger>
        </TabsList>

        {/* Tab: Usuários */}
        <TabsContent value="usuarios" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle>Usuários com Acesso (Editável)</CardTitle>
                <CardDescription>
                  Gerencie quem tem acesso ao painel administrativo
                </CardDescription>
              </div>
                {isAdmin && (
                  <Dialog open={isInviteDialogOpen} onOpenChange={(open) => {
                    if (!open) handleCloseInviteDialog();
                    else setIsInviteDialogOpen(true);
                  }}>
                    <DialogTrigger asChild>
                      <Button className="gap-2">
                        <UserPlus className="w-4 h-4" />
                        Convidar Usuário
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-background sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Convidar Novo Usuário</DialogTitle>
                        <DialogDescription>
                          {generatedInviteLink 
                            ? 'Compartilhe o link abaixo com o usuário'
                            : 'Envie um convite para um novo usuário acessar o painel'
                          }
                        </DialogDescription>
                      </DialogHeader>
                      
                      {generatedInviteLink ? (
                        <div className="space-y-4 py-4">
                          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                            <Input 
                              value={generatedInviteLink} 
                              readOnly 
                              className="flex-1 text-sm"
                            />
                            <Button size="icon" onClick={handleCopyLink}>
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            O convite expira em 7 dias. O usuário receberá a role de{' '}
                            <Badge variant="outline" className={roleColors[inviteRole]}>
                              {roleLabels[inviteRole]}
                            </Badge>
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                              id="email"
                              type="email"
                              placeholder="usuario@empresa.com"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="role">Permissão</Label>
                            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                              <SelectTrigger className="bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-background">
                                <SelectItem value="admin">Administrador</SelectItem>
                                <SelectItem value="supervisor">Supervisor</SelectItem>
                                <SelectItem value="atendente">Atendente</SelectItem>
                                <SelectItem value="visualizador">Visualizador</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {inviteRole !== 'admin' && (
                            <div className="space-y-2">
                              <Label>Acesso aos Bots</Label>
                              <div className="space-y-2 p-3 border rounded-lg">
                                {bots.map(bot => (
                                  <div key={bot.id} className="flex items-center space-x-2">
                                    <Checkbox 
                                      id={`bot-${bot.id}`}
                                      checked={selectedBotIds.includes(bot.id)}
                                      onCheckedChange={() => toggleBotSelection(bot.id)}
                                    />
                                    <label 
                                      htmlFor={`bot-${bot.id}`}
                                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                    >
                                      {bot.name}
                                    </label>
                                  </div>
                                ))}
                                {bots.length === 0 && (
                                  <p className="text-sm text-muted-foreground">
                                    Nenhum bot disponível
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <DialogFooter>
                        <Button variant="outline" onClick={handleCloseInviteDialog}>
                          {generatedInviteLink ? 'Fechar' : 'Cancelar'}
                        </Button>
                        {!generatedInviteLink && (
                          <Button onClick={handleInviteUser} disabled={isSending}>
                            {isSending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Criar Convite
                          </Button>
                        )}
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
                {isAdmin && (
                  <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
                    if (!open) setIsEditDialogOpen(false);
                    else setIsEditDialogOpen(true);
                  }}>
                    <DialogContent className="bg-background sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Editar Permissões</DialogTitle>
                        <DialogDescription>
                          Altere o nível de acesso e os bots permitidos para o usuário.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="edit-role">Permissão</Label>
                            <Select value={editRole} onValueChange={(v) => setEditRole(v as AppRole)}>
                              <SelectTrigger className="bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-background">
                                <SelectItem value="admin">Administrador</SelectItem>
                                <SelectItem value="supervisor">Supervisor</SelectItem>
                                <SelectItem value="atendente">Atendente</SelectItem>
                                <SelectItem value="visualizador">Visualizador</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {editRole !== 'admin' && (
                            <div className="space-y-2">
                              <Label>Acesso aos Bots</Label>
                              <div className="space-y-2 p-3 border rounded-lg max-h-[200px] overflow-y-auto">
                                {bots.map(bot => (
                                  <div key={bot.id} className="flex items-center space-x-2">
                                    <Checkbox 
                                      id={`edit-bot-${bot.id}`}
                                      checked={editSelectedBotIds.includes(bot.id)}
                                      onCheckedChange={() => {
                                        setEditSelectedBotIds(prev => 
                                          prev.includes(bot.id) 
                                            ? prev.filter(id => id !== bot.id)
                                            : [...prev, bot.id]
                                        )
                                      }}
                                    />
                                    <label 
                                      htmlFor={`edit-bot-${bot.id}`}
                                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                    >
                                      {bot.name}
                                    </label>
                                  </div>
                                ))}
                                {bots.length === 0 && (
                                  <p className="text-sm text-muted-foreground">
                                    Nenhum bot disponível
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleSavePermissions} disabled={isSavingRole}>
                          {isSavingRole && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Salvar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Input
                  placeholder="Buscar usuário por nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Permissão</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Último Acesso</TableHead>
                      {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum usuário encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((userItem) => {
                        const primaryRole = getPrimaryRole(userItem.roles);
                        const hasAccess = userItem.roles.length > 0;
                        
                        return (
                          <TableRow key={userItem.id}>
                            <TableCell className="font-medium">{userItem.name}</TableCell>
                            <TableCell>{userItem.email}</TableCell>
                            <TableCell>
                              {primaryRole ? (
                                <Badge 
                                  variant="outline" 
                                  className={roleColors[primaryRole]}
                                >
                                  {roleLabels[primaryRole]}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">Sem permissão</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={hasAccess ? 'default' : 'secondary'}
                                className={hasAccess 
                                  ? 'bg-online/10 text-online border-online/20' 
                                  : ''
                                }
                              >
                                {hasAccess ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(userItem.last_seen)}
                              </div>
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-right">
                                {userItem.id !== user?.id && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                        <MoreHorizontal className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-background">
                                      <DropdownMenuItem 
                                        onClick={() => handleOpenEditDialog(userItem)}
                                      >
                                        {hasAccess ? 'Editar Permissões' : 'Conceder Acesso'}
                                      </DropdownMenuItem>
                                      
                                      {hasAccess && (
                                        <>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem 
                                            className="text-destructive"
                                            onClick={() => handleRevokeAccess(userItem.id)}
                                          >
                                            <XCircle className="w-4 h-4 mr-2" />
                                            Revogar Acesso
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Mostrando {filteredUsers.length} de {users.length} usuários
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Convites Pendentes */}
        <TabsContent value="convites" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Convites Pendentes</CardTitle>
              <CardDescription>
                Convites enviados aguardando aceitação
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingInvites.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum convite pendente</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingInvites.map((invite) => (
                    <div 
                      key={invite.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{invite.email}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                          <Badge variant="outline" className={roleColors[invite.role]}>
                            {roleLabels[invite.role]}
                          </Badge>
                          <span>•</span>
                          <span>Criado em {formatDate(invite.created_at)}</span>
                          <span>•</span>
                          <span>Expira em {formatDate(invite.expires_at)}</span>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="gap-2"
                            onClick={() => handleResendInvite(invite)}
                          >
                            <Copy className="w-4 h-4" />
                            Copiar Link
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="gap-2 text-destructive hover:text-destructive"
                            onClick={() => handleCancelInvite(invite.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                            Cancelar
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Permissões */}
        <TabsContent value="permissoes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Níveis de Acesso</CardTitle>
              <CardDescription>
                Entenda as permissões de cada nível de acesso no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(Object.keys(roleLabels) as AppRole[]).map((role) => (
                  <div 
                    key={role}
                    className="flex items-start gap-4 p-4 rounded-lg border bg-card"
                  >
                    <Badge 
                      variant="outline" 
                      className={`${roleColors[role]} mt-0.5`}
                    >
                      {roleLabels[role]}
                    </Badge>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">
                        {roleDescriptions[role]}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {users.filter(u => getPrimaryRole(u.roles) === role).length} usuário(s)
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
