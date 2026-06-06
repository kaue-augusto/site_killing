import { useBot } from '@/contexts/BotContext';
import { ChevronDown } from 'lucide-react';
import { DynamicIcon } from '@/components/ui/DynamicIcon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarTrigger } from '@/components/ui/sidebar';

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

  if (botsLoading) {
    return (
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6">
        <Skeleton className="h-9 w-32" />
      </header>
    );
  }

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-2 md:gap-4">
        <SidebarTrigger className="md:hidden" />
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
      </div>
    </header>
  );
}
