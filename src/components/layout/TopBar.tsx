import { useBot } from '@/contexts/BotContext';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronDown, LogOut, User } from 'lucide-react';
import { DynamicIcon } from '@/components/ui/DynamicIcon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Settings } from 'lucide-react';

const botColorClasses: Record<string, string> = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
  yellow: 'bg-yellow-500',
  pink: 'bg-pink-500',
  indigo: 'bg-indigo-500',
  teal: 'bg-teal-500',
  cyan: 'bg-cyan-500',
};

export function TopBar() {
  const { bots, selectedBot, setSelectedBot, isLoading: botsLoading } = useBot();
  const { profile, signOut, isAdmin, user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (botsLoading) {
    return (
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </header>
    );
  }

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="-ml-4 mr-2 hidden md:flex" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 bg-secondary border-border">
              {selectedBot && (
                <>
                  <div
                    className={`w-3 h-3 rounded-full ${
                      botColorClasses[selectedBot.color] || 'bg-primary'
                    }`}
                  />
                  <DynamicIcon name={selectedBot.icon} className="w-4 h-4" />
                  <span className="font-medium">{selectedBot.name}</span>
                </>
              )}
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {bots.map((bot) => (
              <DropdownMenuItem
                key={bot.id}
                onClick={() => setSelectedBot(bot)}
                className="gap-2 cursor-pointer"
              >
                <div
                  className={`w-3 h-3 rounded-full ${
                    botColorClasses[bot.color] || 'bg-primary'
                  }`}
                />
                <DynamicIcon name={bot.icon} className="w-4 h-4" />
                <span>{bot.name}</span>
                {selectedBot?.id === bot.id && (
                  <span className="ml-auto text-primary">✓</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-3">


        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile?.avatarUrl || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {profile?.name ? getInitials(profile.name) : 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center gap-2 p-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile?.avatarUrl || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {profile?.name ? getInitials(profile.name) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{profile?.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {isAdmin ? 'Administrador' : 'Usuário'}
                  </span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/conta')} className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                Minha Conta
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/configuracoes')} className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
