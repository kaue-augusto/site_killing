import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  MessageSquare, 
  LayoutDashboard, 
  Users, 
  User, 
  GraduationCap,
  LifeBuoy,
  Headphones,
  LineChart,
  Bot
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
  const { profile } = useAuth();
  const { toggleSidebar } = useSidebar();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border flex flex-row items-center justify-between p-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2">
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleSidebar}
            className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0 cursor-pointer hover:bg-primary/90 transition-colors group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8"
          >
            <Bot className="w-5 h-5 text-primary-foreground group-data-[collapsible=icon]:w-4 group-data-[collapsible=icon]:h-4" />
          </button>
          <div className="group-data-[collapsible=icon]:hidden">
            <h1 className="font-semibold text-sidebar-accent-foreground tracking-tight">KISA TECH</h1>
            <p className="text-xs text-sidebar-foreground">Painel de Atendimento</p>
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
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink
                        to={item.url}
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

      <SidebarFooter className="p-4 border-t border-sidebar-border group-data-[collapsible=icon]:p-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-medium text-sidebar-accent-foreground truncate">
              {profile?.name || 'Carregando...'}
            </p>
            <p className="text-xs text-sidebar-foreground flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-online"></span>
              Online
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
