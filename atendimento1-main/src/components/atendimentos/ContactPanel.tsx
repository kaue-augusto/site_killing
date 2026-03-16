import { useState } from 'react';
import { Phone, Mail, Calendar, Tag, X, ArrowRightLeft, Clock, Trash2, ShieldBan, Flag } from 'lucide-react';
import { Conversation } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';

interface ContactPanelProps {
  conversation: Conversation | null;
  onClose: () => void;
  onTransfer: () => void;
  onDelete: () => void;
  onBlock: () => void;
  onReport: (reason: string) => void;
}

export function ContactPanel({ conversation, onClose, onTransfer, onDelete, onBlock, onReport }: ContactPanelProps) {
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('');

  if (!conversation) {
    return null;
  }

  const handleReport = () => {
    if (reportReason.trim()) {
      onReport(reportReason.trim());
      setReportReason('');
      setShowReportDialog(false);
    }
  };

  return (
    <>
      <div className="w-80 border-l border-border bg-card flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Informações do Contato</h3>
          <Button variant="ghost" size="icon" onClick={() => {}}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Profile */}
          <div className="p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl font-semibold text-muted-foreground">
                {conversation.contactName.charAt(0).toUpperCase()}
              </span>
            </div>
            <h4 className="font-semibold text-lg text-foreground">
              {conversation.contactName}
            </h4>
            <p className="text-sm text-muted-foreground mt-1">
              {conversation.contactPhone}
            </p>
          </div>

          <Separator />

          {/* Contact Info */}
          <div className="p-4 space-y-4">
            <h5 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Contato
            </h5>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{conversation.contactPhone}</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-foreground">contato@email.com</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Conversation Info */}
          <div className="p-4 space-y-4">
            <h5 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Conversa
            </h5>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-foreground">Início da conversa</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-foreground">Tempo de atendimento</p>
                  <p className="text-xs text-muted-foreground">15 minutos</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Tags */}
          <div className="p-4 space-y-3">
            <h5 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Tags
            </h5>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 bg-primary/20 text-primary text-xs rounded-full">
                VIP
              </span>
              <span className="px-2 py-1 bg-warning/20 text-warning text-xs rounded-full">
                Urgente
              </span>
            </div>
          </div>

          <Separator />

          {/* History Summary */}
          <div className="p-4 space-y-3">
            <h5 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Histórico Resumido
            </h5>
            <div className="space-y-2">
              <div className="p-3 bg-secondary rounded-lg">
                <p className="text-xs text-muted-foreground">Ontem às 14:30</p>
                <p className="text-sm text-foreground mt-1">
                  Solicitou informações sobre produto
                </p>
              </div>
              <div className="p-3 bg-secondary rounded-lg">
                <p className="text-xs text-muted-foreground">15/01 às 10:00</p>
                <p className="text-sm text-foreground mt-1">
                  Primeiro contato realizado
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-border space-y-2">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={onTransfer}
          >
            <ArrowRightLeft className="w-4 h-4" />
            Transferir Conversa
          </Button>
          <Button
            variant="destructive"
            className="w-full gap-2"
            onClick={() => setShowCloseDialog(true)}
          >
            <X className="w-4 h-4" />
            Encerrar Conversa
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="w-4 h-4" />
            Apagar Conversa
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => setShowBlockDialog(true)}
            >
              <ShieldBan className="w-4 h-4" />
              Bloquear
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2 text-orange-600 border-orange-300 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:hover:bg-orange-950"
              onClick={() => setShowReportDialog(true)}
            >
              <Flag className="w-4 h-4" />
              Denunciar
            </Button>
          </div>
        </div>
      </div>

      {/* Close Conversation Dialog */}
      <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar conversa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja encerrar a conversa com <strong>{conversation.contactName}</strong>? A conversa será marcada como finalizada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { onClose(); setShowCloseDialog(false); }}>
              Encerrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Conversation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar conversa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja apagar permanentemente a conversa com <strong>{conversation.contactName}</strong>? Esta ação não pode ser desfeita e todas as mensagens serão removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { onDelete(); setShowDeleteDialog(false); }}
            >
              Apagar permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Block Contact Dialog */}
      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bloquear usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja bloquear <strong>{conversation.contactName}</strong> ({conversation.contactPhone})? Este contato não poderá mais enviar mensagens. Você poderá desbloquear depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { onBlock(); setShowBlockDialog(false); }}
            >
              Bloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report Contact Dialog */}
      <AlertDialog open={showReportDialog} onOpenChange={(open) => { setShowReportDialog(open); if (!open) setReportReason(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Denunciar usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Descreva o motivo da denúncia de <strong>{conversation.contactName}</strong>. A equipe irá analisar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Descreva o motivo da denúncia..."
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            className="min-h-[100px]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!reportReason.trim()}
              onClick={handleReport}
            >
              Enviar denúncia
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
