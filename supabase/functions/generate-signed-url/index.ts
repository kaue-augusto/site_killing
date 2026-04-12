import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { filePath } = await req.json();

    if (!filePath) throw new Error('Caminho do arquivo não fornecido.');

    const bucketName = 'n8n-flow'; // O seu bucket do GCP
    
    // Pega o JSON inteiro que guardámos no painel!
    const gcpServiceAccountStr = Deno.env.get('GCP_CREDENTIALS');
    
    if (!gcpServiceAccountStr) {
       throw new Error('Segredo GCP_CREDENTIALS não encontrado no Supabase.');
    }

    // Lê o e-mail e a chave sozinhos, sem risco de formatação errada
    const gcpCreds = JSON.parse(gcpServiceAccountStr);
    const clientEmail = gcpCreds.client_email;
    const privateKey = gcpCreds.private_key;

    // 1. Criar JWT para autenticar no GCP (AGORA COM O SCOPE!)
    const jwtHeader = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const jwtClaimSet = btoa(JSON.stringify({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/devstorage.read_only', // O que faltava!
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600
    }));
    
    const unsignedJwt = `${jwtHeader}.${jwtClaimSet}`;

    // Extrai apenas a base da chave para máxima segurança de formatação
    const pemHeader = "-----BEGIN PRIVATE KEY-----";
    const pemFooter = "-----END PRIVATE KEY-----";
    const pemContents = privateKey.substring(
      privateKey.indexOf(pemHeader) + pemHeader.length,
      privateKey.indexOf(pemFooter)
    ).replace(/\s/g, ''); // Remove qualquer espaço ou quebra de linha indevida

    const keyData = await crypto.subtle.importKey(
        "pkcs8",
        str2ab(atob(pemContents)),
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
    );
    
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keyData, new TextEncoder().encode(unsignedJwt));
    const signedJwt = `${unsignedJwt}.${btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;

    // 2. Pedir o Token de Acesso ao Google
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${signedJwt}`
    });
    
    const tokenData = await tokenResponse.json();
    const access_token = tokenData.access_token;
    
    if (!access_token) {
        console.error("Resposta de Erro do Google:", tokenData);
        throw new Error("Falha ao obter access token do GCP. Verifique as credenciais.");
    }

    // 3. Buscar o PDF do Bucket
    let relativePath = filePath;
    if (filePath.startsWith('https://storage.googleapis.com/')) {
        const urlParts = new URL(filePath);
        // Descodificamos primeiro para remover os %20 (espaços), etc.
        const decodedPath = decodeURIComponent(urlParts.pathname);
        // Retiramos o nome do bucket do caminho
        relativePath = decodedPath.replace(`/${bucketName}/`, '');
        
        // Remove uma possível barra (/) no início, se tiver ficado
        if (relativePath.startsWith('/')) {
            relativePath = relativePath.substring(1);
        }
    }

    const fileUrl = `https://storage.googleapis.com/storage/v1/b/${bucketName}/o/${encodeURIComponent(relativePath)}?alt=media`;

    const fileResponse = await fetch(fileUrl, {
        headers: { 'Authorization': `Bearer ${access_token}` }
    });

    if (!fileResponse.ok) {
         throw new Error(`Erro ao buscar arquivo do GCP: ${fileResponse.statusText}`);
    }

    const arrayBuffer = await fileResponse.arrayBuffer();
    const base64Content = encode(arrayBuffer);

    return new Response(JSON.stringify({ fileData: base64Content, contentType: 'application/pdf' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

function str2ab(str: string) {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return buf;
}