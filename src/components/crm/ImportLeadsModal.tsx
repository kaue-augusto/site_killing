import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// Mapeamento de cabeçalhos do arquivo para colunas do banco
const COLUMN_MAP: Record<string, string> = {
  'Rank': 'rank_score',
  'Tier': 'tier',
  'Score': 'score',
  'CNPJ': 'cnpj',
  'Razão Social': 'razao_social',
  'Razao Social': 'razao_social',
  'Nome Fantasia': 'nome_fantasia',
  'Decisor': 'decisor',
  'Faturamento': 'faturamento',
  'Funcionários': 'num_funcionarios',
  'Funcionarios': 'num_funcionarios',
  'Capital Social (R$)': 'capital_social',
  'Porte': 'porte',
  'Regime': 'regime',
  'UF': 'uf',
  'Município': 'municipio',
  'Municipio': 'municipio',
  'Bairro': 'bairro',
  'Endereço': 'endereco',
  'Endereco': 'endereco',
  'CEP': 'cep',
  'WhatsApp': 'whatsapp',
  'Telefone': 'telefone',
  'E-mail': 'email',
  'Email': 'email',
  'Site': 'site',
  'Instagram': 'instagram',
  'LinkedIn': 'linkedin',
  'CNAE Principal': 'cnae',
  'Tipo (Fab/Atac+Prod)': 'tipo_empresa',
  'Idade (anos)': 'idade_empresa',
  'Chance Contato': 'chance_contato',
  'Tem WPP': 'tem_wpp',
  'Tem Email': 'tem_email',
  'Tem Site': 'tem_site',
};

const BOOLEAN_COLS = new Set(['tem_wpp', 'tem_email', 'tem_site']);
const NUMBER_COLS = new Set(['rank_score', 'score']);
const DECIMAL_COLS = new Set(['capital_social']);

function mapRow(row: Record<string, any>, botId: string, origem: string): Record<string, any> {
  const record: Record<string, any> = {
    bot_id: botId,
    status: 'triagem',
    origem: origem || 'importação',
    tags: [],
  };

  for (const [header, dbCol] of Object.entries(COLUMN_MAP)) {
    const val = row[header];
    if (val === null || val === undefined || val === '') continue;

    if (BOOLEAN_COLS.has(dbCol)) {
      record[dbCol] = val === 'Sim' || val === true || val === 1 || val === '1';
    } else if (NUMBER_COLS.has(dbCol)) {
      const parsed = parseInt(String(val));
      if (!isNaN(parsed)) record[dbCol] = parsed;
    } else if (DECIMAL_COLS.has(dbCol)) {
      const parsed = typeof val === 'number'
        ? val
        : parseFloat(String(val).replace(/[^\d,]/g, '').replace(',', '.'));
      if (!isNaN(parsed)) record[dbCol] = parsed;
    } else {
      const str = String(val).trim();
      if (str) record[dbCol] = str;
    }
  }

  // contact_name e contact_phone para compatibilidade com o CRM atual
  record.contact_name = record.decisor || record.razao_social || null;
  record.contact_phone = record.whatsapp || record.telefone || null;

  return record;
}

interface ImportLeadsModalProps {
  open: boolean;
  onClose: () => void;
  botId: string;
  onImported: () => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

export function ImportLeadsModal({ open, onClose, botId, onImported }: ImportLeadsModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [origem, setOrigem] = useState('');
  const [deduplicar, setDeduplicar] = useState(true);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; skipped: number; error?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('upload');
    setFileName('');
    setRows([]);
    setHeaders([]);
    setOrigem('');
    setDeduplicar(true);
    setProgress(0);
    setResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const parseFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const wb = XLSX.read(data, { type: 'array' });

      // Escolhe a aba com mais linhas (ignora abas de resumo/capa)
      let bestSheet = wb.SheetNames[0];
      let maxRows = 0;
      for (const name of wb.SheetNames) {
        const ref = wb.Sheets[name]['!ref'];
        if (!ref) continue;
        const range = XLSX.utils.decode_range(ref);
        if (range.e.r > maxRows) { maxRows = range.e.r; bestSheet = name; }
      }

      const ws = wb.Sheets[bestSheet];
      // Lê como array bruto para detectar onde está o cabeçalho real
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][];

      // Encontra a linha que tem pelo menos 3 colunas reconhecidas
      const knownCols = new Set(Object.keys(COLUMN_MAP));
      let headerIdx = 0;
      for (let i = 0; i < Math.min(raw.length, 15); i++) {
        const matches = (raw[i] as any[]).filter(c => knownCols.has(String(c ?? ''))).length;
        if (matches >= 3) { headerIdx = i; break; }
      }

      const hdrs = (raw[headerIdx] as any[]).map(c => String(c ?? ''));
      const dataRows = raw.slice(headerIdx + 1).filter(r =>
        r.some(c => c !== null && c !== undefined && c !== '')
      );

      const json: Record<string, any>[] = dataRows.map(row =>
        Object.fromEntries(hdrs.map((h, i) => [h, row[i] ?? null]))
      );

      if (json.length === 0) return;
      setHeaders(hdrs.filter(Boolean));
      setRows(json);
      setStep('preview');
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const handleImport = async () => {
    if (!botId || rows.length === 0) return;
    setStep('importing');
    setProgress(0);

    const records = rows.map(row => mapRow(row, botId, origem));
    let imported = 0;
    let skipped = 0;

    try {
      let toInsert = records;

      if (deduplicar) {
        const cnpjs = records.map(r => r.cnpj).filter(Boolean);
        if (cnpjs.length > 0) {
          const { data: existing } = await (supabase as any)
            .from('crm_leads')
            .select('cnpj')
            .eq('bot_id', botId)
            .in('cnpj', cnpjs);
          const existingSet = new Set((existing || []).map((r: any) => r.cnpj));
          toInsert = records.filter(r => !r.cnpj || !existingSet.has(r.cnpj));
          skipped = records.length - toInsert.length;
        }
      }

      const CHUNK = 500;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const chunk = toInsert.slice(i, i + CHUNK);
        const { error } = await (supabase as any).from('crm_leads').insert(chunk);
        if (error) throw error;
        imported += chunk.length;
        setProgress(Math.round(((i + chunk.length) / toInsert.length) * 100));
      }

      setResult({ imported, skipped });
      setStep('done');
      onImported();
    } catch (err: any) {
      setResult({ imported, skipped, error: err?.message || 'Erro desconhecido' });
      setStep('done');
    }
  };

  // Colunas reconhecidas (para mostrar no preview)
  const recognizedHeaders = headers.filter(h => COLUMN_MAP[h]);
  const unknownHeaders = headers.filter(h => !COLUMN_MAP[h]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Importar Leads — CSV / XLSX
          </DialogTitle>
        </DialogHeader>

        {/* STEP: UPLOAD */}
        {step === 'upload' && (
          <div
            className={`border-2 border-dashed rounded-lg p-12 flex flex-col items-center gap-4 cursor-pointer transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-10 h-10 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">Arraste o arquivo aqui ou clique para selecionar</p>
              <p className="text-sm text-muted-foreground mt-1">Aceita .xlsx e .csv</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv,.xls"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        )}

        {/* STEP: PREVIEW */}
        {step === 'preview' && (
          <div className="space-y-5">
            {/* Arquivo + contagem */}
            <div className="flex items-center justify-between bg-muted/40 rounded-md px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileSpreadsheet className="w-4 h-4 text-primary" />
                {fileName}
              </div>
              <span className="text-sm text-muted-foreground">{rows.length.toLocaleString('pt-BR')} linhas detectadas</span>
            </div>

            {/* Colunas reconhecidas */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Colunas mapeadas ({recognizedHeaders.length}/{headers.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {recognizedHeaders.map(h => (
                  <span key={h} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{h}</span>
                ))}
                {unknownHeaders.map(h => (
                  <span key={h} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full line-through">{h}</span>
                ))}
              </div>
            </div>

            {/* Preview primeiras 5 linhas */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Prévia (primeiras 5 linhas)
              </p>
              <div className="overflow-x-auto rounded-md border border-border text-xs">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      {recognizedHeaders.slice(0, 8).map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        {recognizedHeaders.slice(0, 8).map(h => (
                          <td key={h} className="px-3 py-2 text-muted-foreground max-w-[160px] truncate">
                            {row[h] !== null && row[h] !== undefined ? String(row[h]) : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Opções */}
            <div className="grid grid-cols-1 gap-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="origem">Origem / Lote (opcional)</Label>
                <Input
                  id="origem"
                  placeholder="Ex: KED_Joalheria_Mai26"
                  value={origem}
                  onChange={e => setOrigem(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Identifica de onde vieram estes leads para filtragem posterior.</p>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="deduplicar"
                  checked={deduplicar}
                  onCheckedChange={v => setDeduplicar(Boolean(v))}
                />
                <div>
                  <Label htmlFor="deduplicar" className="cursor-pointer">Ignorar duplicatas por CNPJ</Label>
                  <p className="text-xs text-muted-foreground">Leads com CNPJ já cadastrado serão pulados.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP: IMPORTING */}
        {step === 'importing' && (
          <div className="py-8 flex flex-col items-center gap-4">
            <p className="text-sm font-medium">Importando {rows.length.toLocaleString('pt-BR')} leads...</p>
            <Progress value={progress} className="w-full" />
            <p className="text-xs text-muted-foreground">{progress}% concluído</p>
          </div>
        )}

        {/* STEP: DONE */}
        {step === 'done' && result && (
          <div className="py-8 flex flex-col items-center gap-4 text-center">
            {result.error ? (
              <>
                <AlertCircle className="w-12 h-12 text-red-500" />
                <p className="font-semibold text-red-500">Erro na importação</p>
                <p className="text-sm text-muted-foreground">{result.error}</p>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-12 h-12 text-green-500" />
                <p className="font-semibold text-lg">{result.imported.toLocaleString('pt-BR')} leads importados</p>
                {result.skipped > 0 && (
                  <p className="text-sm text-muted-foreground">{result.skipped.toLocaleString('pt-BR')} ignorados por duplicata de CNPJ</p>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 'upload' && (
            <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="ghost" onClick={reset} className="flex items-center gap-1">
                <X className="w-4 h-4" /> Trocar arquivo
              </Button>
              <Button onClick={handleImport}>
                Importar {rows.length.toLocaleString('pt-BR')} leads
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
