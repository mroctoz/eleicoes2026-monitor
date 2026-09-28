// functions/api/malha-ibge.js - Cache Geográfico de Alta Performance
export async function onRequestGet() {
  const IBGE_URL = 'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=intermediaria&intrarregiao=UF';

  try {
    const res = await fetch(IBGE_URL, {
      headers: { 'User-Agent': 'CloudflareEdge/Geodata2026' },
      cf: {
        cacheTtl: 86400, // 24 horas de cache na CDN
        cacheEverything: true
      }
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Falha na malha do IBGE." }), { status: 502 });
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Erro de conexão com o IBGE." }), { status: 500 });
  }
}
