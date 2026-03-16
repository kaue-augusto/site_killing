import { useState, useEffect } from 'react';
import { useBot } from '@/contexts/BotContext';
import { fetchContacts, createContact, Contact, BotType } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  Calendar,
  MoreHorizontal,
  User
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';

export default function Contatos() {
  const { selectedBot } = useBot();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    const loadContacts = async () => {
      if (!selectedBot) return;
      
      setIsLoading(true);
      try {
        const data = await fetchContacts(selectedBot.slug as BotType);
        setContacts(data);
      } catch (error) {
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar os contatos',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadContacts();
  }, [selectedBot]);

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(search.toLowerCase()) ||
      contact.phone.includes(search) ||
      contact.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateContact = async () => {
    if (!newContact.name || !newContact.phone || !selectedBot) {
      toast({
        title: 'Erro',
        description: 'Nome e telefone são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    try {
      const contact = await createContact({
        ...newContact,
        botId: selectedBot.slug as BotType,
      });
      setContacts((prev) => [...prev, contact]);
      setIsDialogOpen(false);
      setNewContact({ name: '', phone: '', email: '' });
      toast({
        title: 'Sucesso',
        description: 'Contato criado com sucesso',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o contato',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contatos</h1>
          <p className="text-muted-foreground">
            Contatos do bot {selectedBot?.name || ''}
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Contato
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Contato</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  placeholder="Nome do contato"
                  value={newContact.name}
                  onChange={(e) =>
                    setNewContact((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone *</Label>
                <Input
                  id="phone"
                  placeholder="+55 11 99999-9999"
                  value={newContact.phone}
                  onChange={(e) =>
                    setNewContact((prev) => ({ ...prev, phone: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={newContact.email}
                  onChange={(e) =>
                    setNewContact((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
              </div>
              <Button className="w-full" onClick={handleCreateContact}>
                Criar Contato
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar contatos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Contacts Table */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/4" />
                    <div className="h-3 bg-muted rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="p-12 text-center">
              <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Nenhum contato encontrado
              </h3>
              <p className="text-muted-foreground">
                Crie um novo contato para começar
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">Contato</TableHead>
                  <TableHead className="text-muted-foreground">Telefone</TableHead>
                  <TableHead className="text-muted-foreground">E-mail</TableHead>
                  <TableHead className="text-muted-foreground">Criado em</TableHead>
                  <TableHead className="text-muted-foreground">Tags</TableHead>
                  <TableHead className="text-muted-foreground w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact) => (
                  <TableRow key={contact.id} className="border-border">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <span className="font-semibold text-muted-foreground">
                            {contact.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-foreground">
                          {contact.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {contact.phone}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {contact.email || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(contact.createdAt, "dd 'de' MMM, yyyy", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {contact.tags?.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
