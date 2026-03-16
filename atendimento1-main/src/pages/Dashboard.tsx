import { useState, useEffect } from 'react';
import { useBot } from '@/contexts/BotContext';
import { fetchDashboard, DashboardData } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  MessageSquare, 
  Users, 
  Clock, 
  CheckCircle,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['hsl(152, 60%, 45%)', 'hsl(220, 70%, 50%)', 'hsl(38, 92%, 50%)', 'hsl(0, 70%, 50%)'];

export default function Dashboard() {
  const { selectedBot } = useBot();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      setIsLoading(true);
      try {
        const dashboardData = await fetchDashboard();
        setData(dashboardData);
      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, [selectedBot]);

  if (isLoading || !data) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const statsCards = [
    {
      title: 'Total de Conversas',
      value: data.totalConversations,
      icon: MessageSquare,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Conversas Ativas',
      value: data.activeConversations,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Encerradas Hoje',
      value: data.closedToday,
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Tempo Médio Resposta',
      value: data.avgResponseTime,
      icon: Clock,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral do bot {selectedBot?.name || ''}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat, index) => (
          <Card key={index} className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversations by Bot */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <BarChart3 className="w-5 h-5 text-primary" />
              Conversas por Bot
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.conversationsByBot}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="bot"
                  label={({ bot, count }) => `${bot}: ${count}`}
                >
                  {data.conversationsByBot.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(220, 18%, 13%)',
                    border: '1px solid hsl(220, 15%, 22%)',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Conversations by Agent */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Users className="w-5 h-5 text-primary" />
              Conversas por Agente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.conversationsByAgent}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 22%)" />
                <XAxis 
                  dataKey="agent" 
                  stroke="hsl(215, 15%, 55%)"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(215, 15%, 55%)"
                  fontSize={12}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(220, 18%, 13%)',
                    border: '1px solid hsl(220, 15%, 22%)',
                    borderRadius: '8px',
                  }}
                />
                <Bar 
                  dataKey="count" 
                  fill="hsl(152, 60%, 45%)" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* SLA Chart */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <TrendingUp className="w-5 h-5 text-primary" />
            SLA - Tempo de Primeira Resposta (minutos)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.slaMetrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 22%)" />
              <XAxis 
                dataKey="period" 
                stroke="hsl(215, 15%, 55%)"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(215, 15%, 55%)"
                fontSize={12}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(220, 18%, 13%)',
                  border: '1px solid hsl(220, 15%, 22%)',
                  borderRadius: '8px',
                }}
              />
              <Line
                type="monotone"
                dataKey="avgResponseTime"
                stroke="hsl(152, 60%, 45%)"
                strokeWidth={2}
                dot={{ fill: 'hsl(152, 60%, 45%)', strokeWidth: 2 }}
                name="Tempo Real"
              />
              <Line
                type="monotone"
                dataKey="target"
                stroke="hsl(0, 70%, 50%)"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="Meta"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
