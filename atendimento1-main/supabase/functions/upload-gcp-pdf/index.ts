import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Storage } from "npm:@google-cloud/storage";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const botId = formData.get('botId') as string;

    if (!file) throw new Error("Nenhum arquivo enviado.");

    // Pega a credencial do GCP guardada nos Secrets do Supabase
    const gcpCredentials = JSON.parse(Deno.env.get('GCP_CREDENTIALS') ?? '{}');

    // Inicia o cliente do Google Cloud
    const storage = new Storage({
      credentials: {
        client_email: gcpCredentials.client_email,
        private_key: gcpCredentials.private_key,
      },
      projectId: gcpCredentials.project_id,
    });

    const bucket = storage.bucket('n8n-flow');
    const fileName = `${botId}/${file.name}`;

    const fileBuffer = await file.arrayBuffer();
    const fileRef = bucket.file(fileName);

    await fileRef.save(new Uint8Array(fileBuffer), {
      contentType: file.type,
    });

    return new Response(JSON.stringify({ success: true, fileName }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});