import { ArrowUpToLine, Settings2, FlaskConical, Link } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function CentralSucesso() {
  return (
    <div className="flex-1 p-8 space-y-8 overflow-auto max-w-5xl mx-auto h-full">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Suporte e Treinamento</h1>
        <p className="text-muted-foreground mt-2">
          Passo a passo completo para você configurar e aproveitar ao máximo o seu Agente
        </p>
      </div>

      <Accordion type="single" collapsible className="w-full space-y-4">
        {/* Step 1 */}
        <AccordionItem value="item-1" className="border rounded-lg bg-card px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-4 text-left">
              <div className="p-2 bg-secondary rounded-md">
                <ArrowUpToLine className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="font-semibold text-lg">Como adicionar fontes de dados (Sites, PDF ou Texto Livre)?</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground leading-relaxed pt-2 pb-6 space-y-4">
            <p>
              O primeiro passo para treinar seu agente é fornecer as informações e conteúdos que ele utilizará de base.
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><strong>Para adicionar links de sites:</strong> Acesse o menu <strong>Treinamento</strong> &gt; Aba <strong>Fontes</strong> &gt; Aba <strong>Websites</strong>.</li>
              <li><strong>Para adicionar arquivos PDF:</strong> Acesse o menu <strong>Treinamento</strong> &gt; Aba <strong>Fontes</strong> &gt; Aba <strong>PDFs</strong>.</li>
              <li><strong>Para adicionar Texto Livre (sem formatações):</strong> Acesse o menu <strong>Treinamento</strong> &gt; Aba <strong>Fontes</strong> &gt; Aba <strong>Textos</strong>.</li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        {/* Step 2 */}
        <AccordionItem value="item-2" className="border rounded-lg bg-card px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-4 text-left">
              <div className="p-2 bg-secondary rounded-md">
                <Settings2 className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="font-semibold text-lg">Como definir o comportamento e a personalidade do robô?</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground leading-relaxed pt-2 pb-6 space-y-4">
            <p>
              Você precisa dizer ao Agente qual papel ele vai desempenhar na sua empresa (ex: focado em vendas, suporte técnico ou algo totalmente personalizado).
            </p>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Acesse o menu <strong>Treinamento</strong> e vá para a aba <strong>Configurações</strong>.</li>
              <li>Na sessão <strong>Modo do Bot</strong>, selecione o tipo do atendimento que o bot realizará (Vendas, Suporte, Ensino ou Personalizado).</li>
              <li>Na sessão <strong>Instruções do Bot</strong>, descreva de forma detalhada como o bot deve agir e conversar com os usuários.</li>
            </ol>
             <p>
              Salve as instruções e elas já estarão valendo para as próximas conversas.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* Step 3 */}
        <AccordionItem value="item-3" className="border rounded-lg bg-card px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-4 text-left">
              <div className="p-2 bg-secondary rounded-md">
                <FlaskConical className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="font-semibold text-lg">Como inserir Q&A (Perguntas e Respostas)?</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground leading-relaxed pt-2 pb-6 flex flex-col gap-4">
            <p>
              Para garantir que seu Bot sempre acerte a resposta daquelas principais dúvidas dos seus clientes, configure o Q&A.
            </p>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Acesse o menu <strong>Treinamento</strong> e clique na guia principal <strong>Fontes</strong>.</li>
              <li>Logo abaixo, clique na aba <strong>Q&A</strong>.</li>
              <li>Cadastre cada pergunta frequente juntamente com a resposta ideal que você quer que o Bot forneça.</li>
             </ol>
          </AccordionContent>
        </AccordionItem>

        {/* Step 4 */}
        <AccordionItem value="item-4" className="border rounded-lg bg-card px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-4 text-left">
              <div className="p-2 bg-secondary rounded-md">
                <Link className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="font-semibold text-lg">Como conectar o QR Code do WhatsApp?</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground leading-relaxed pt-2 pb-6 flex flex-col gap-4">
            <p>
              Para que seus clientes comecem a usar o Bot, é preciso conectar o WhatsApp da sua empresa à plataforma.
            </p>
             <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Acesse o menu <strong>Treinamento</strong> e clique na guia principal <strong>Integrações</strong>.</li>
              <li>Clique na opção do WhatsApp para gerar o <strong>QR Code</strong> de conexão.</li>
              <li>No seu celular, abra o WhatsApp que será usado para atendimento (WhatsApp Web / Aparelhos Conectados).</li>
              <li>Aponte a câmera do celular para o QR Code na tela. A conexão será feita e confirmada imediatamente.</li>
             </ol>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

    </div>
  );
}
