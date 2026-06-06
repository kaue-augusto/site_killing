import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MessageSquare,
  LayoutDashboard,
  Users,
  User,
  GraduationCap,
  LifeBuoy,
  Headphones,
  LineChart,
  Bot,
  ChevronDown,
  LogOut,
  Settings,
  Moon
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';

const menuItems = [
  { title: 'Atendimentos', url: '/', icon: MessageSquare },
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'CRM', url: '/crm', icon: LineChart },
  { title: 'Contatos', url: '/contatos', icon: Users },
  { title: 'Treinamento', url: '/treinamento', icon: GraduationCap },
  { title: 'Suporte', url: '/suporte', icon: LifeBuoy },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut, isAdmin, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toggleSidebar, isMobile, setOpenMobile, setOpen } = useSidebar();

  const handleItemClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    } else {
      setOpen(false);
    }
  };

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

  return (
    <Sidebar collapsible="icon" className="border-none">
      <SidebarHeader className="flex flex-row items-center justify-between p-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0 cursor-pointer hover:bg-primary/90 transition-colors group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8"
          >
            <Bot className="w-5 h-5 text-primary-foreground group-data-[collapsible=icon]:w-4 group-data-[collapsible=icon]:h-4" />
          </button>
          <div className="group-data-[collapsible=icon]:hidden">
            <h1 className="font-semibold text-sidebar-accent-foreground tracking-tight">KISABOT</h1>
            <p className="text-xs text-sidebar-foreground">Agentes inteligentes</p>
          </div>
        </div>
        <SidebarTrigger className="group-data-[collapsible=icon]:hidden text-muted-foreground hover:text-foreground" />
      </SidebarHeader>

      <SidebarContent className="py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        onClick={handleItemClick}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-accent text-sidebar-primary"
                      >
                        <item.icon className="w-5 h-5" />
                        <span className="font-medium">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 group-data-[collapsible=icon]:p-2">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 w-full text-left p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors focus-visible:outline-none cursor-pointer">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={profile?.avatarUrl || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {profile?.name ? getInitials(profile.name) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                  <p className="text-sm font-medium text-sidebar-accent-foreground truncate">
                    {profile?.name || 'Carregando...'}
                  </p>
                  <p className="text-xs text-sidebar-foreground flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-online"></span>
                    Online
                  </p>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground group-data-[collapsible=icon]:hidden shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align={isMobile ? "start" : "end"}
              side={isMobile ? "top" : "right"}
              className={`w-56 ${isMobile ? 'mb-2' : 'ml-2'}`}
            >
              <div className="flex items-center gap-2 p-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile?.avatarUrl || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {profile?.name ? getInitials(profile.name) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{profile?.name || 'Usuário'}</span>
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
              <div className="px-3 py-2 flex flex-col gap-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">SYSTEM</span>
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Moon className="h-4 w-4 text-muted-foreground" />
                    <span>Dark Mode</span>
                  </div>
                  <Switch
                    id="dark-mode-toggle"
                    checked={theme === 'dark'}
                    onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                  />
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-medium text-sidebar-accent-foreground truncate">
                Carregando...
              </p>
              <p className="text-xs text-sidebar-foreground flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-online"></span>
                Online
              </p>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
