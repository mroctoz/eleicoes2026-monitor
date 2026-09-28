// functions/api/eleicoes.js - Cloudflare Pages Function Oficial
const TSE_BASE_URL = 'https://resultados.tse.jus.br/oficial';
const ELEICAO_ID = '6257';
const ELEICAO_CODE = 'e006257';
const CARGO_PRESIDENTE = '0001';

const ESTADOS = [
  'ac', 'al', 'ap', 'am', 'ba', 'ce', 'df', 'es', 'go', 'ma',
  'mt', 'ms', 'mg', 'pa', 'pb', 'pr', 'pe', 'pi', 'rj', 'rn',
  'rs', 'ro', 'rr', 'sc', 'sp', 'se', 'to'
];

const CANDIDATOS_CONFIG = [
  { shortName: "LULA", nome: "Lula", partido: "PT", numero: "13", color: "#dc2626" },
  { shortName: "FLAVIO", nome: "Flávio Bolsonaro", partido: "PL", numero: "22", color: "#2563eb" },
  { shortName: "CAIADO", nome: "Caiado", partido: "PSD", numero: "55", color: "#0284c7" },
  { shortName: "ZEMA", nome: "Zema", partido: "Novo", numero: "30", color: "#ea580c" },
  { shortName: "RENAN", nome: "Renan Santos", partido: "Missão", numero: "14", color: "#d97706" },
  { shortName: "CURY", nome: "Cury", partido: "Avante", numero: "70", color: "#059669" },
  { shortName: "SAMARA", nome: "Samara Martins", partido: "UP", numero: "80", color: "#e11d48" },
  { shortName: "HERTZ", nome: "Hertz Dias", partido: "PSTU", numero: "16", color: "#b91c1c" },
  { shortName: "EDMILSON", nome: "Edmilson Costa", partido: "PCB", numero: "21", color: "#991b1b" },
  { shortName: "RUI PIMENTA", nome: "Rui Costa Pimenta", partido: "PCO", numero: "29", color: "#7f1d1d" },
  { shortName: "AVALANCHE", nome: "Leonardo Avalanche", partido: "PRTB", numero: "28", color: "#ca8a04" },
  { shortName: "GRASSI", nome: "Grassi", partido: "Democrata", numero: "35", color: "#1d4ed8" },
  { shortName: "CLARIANA", nome: "Clariana Barão", partido: "DC", numero: "27", color: "#0891b2" }
];

function matchCandidate(tseCand) {
  const numStr = String(tseCand.n || '').trim();
  const nomeStr = (tseCand.nm || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const coligacao = (tseCand.cc || '').toUpperCase();

  const porNumero = CANDIDATOS_CONFIG.find(c => c.numero === numStr);
  if (porNumero) return porNumero;

  const porPartido = CANDIDATOS_CONFIG.find(c => {
    const pNorm = c.partido.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return coligacao.includes(pNorm);
  });
  if (porPartido) return porPartido;

  const porNome = CANDIDATOS_CONFIG.find(c => nomeStr.includes(c.shortName.toLowerCase()));
  if (porNome) return porNome;

  return {
    shortName: (tseCand.nm || 'CANDIDATO').split(' ')[0].toUpperCase(),
    nome: tseCand.nm || 'Candidato',
    partido: coligacao.split(' ')[0] || 'OUTRO',
    numero: numStr,
    color: '#475569'
  };
}

async function fetchTseScope(scope) {
  const uf = scope.toLowerCase();
  const url = `${TSE_BASE_URL}/ele2026/${ELEICAO_ID}/dados/${uf}/${uf}-c${CARGO_PRESIDENTE}-${ELEICAO_CODE}-u.json`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'CentralApuracao2026/CloudflareEdge',
        'Accept': 'application/json, text/plain, */*'
      },
      cf: {
        // Cache na borda da Cloudflare por 15 segundos
        cacheTtl: 15,
        cacheEverything: true
      }
    });

    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function onRequestGet() {
  try {
    const brasilData = await fetchTseScope('br');

    // Estado antes das 17h00 (espera de apuração)
    if (!brasilData || !brasilData.cand || brasilData.cand.length === 0) {
      const now = new Date();
      const horaString = now.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit'
      });

      const prePayload = {
        source: "TSE_PRODUCAO_AGUARDANDO",
        hora: horaString,
        pst: "0,00",
        secoesTotalizadas: "0",
        totalSecoes: brasilData && brasilData.s ? brasilData.s : "498960",
        candidatos: CANDIDATOS_CONFIG.map(c => ({
          shortName: c.shortName,
          nome: c.nome,
          partido: c.partido,
          foto: `/fotos/${c.partido}.jpg`,
          vap: "0",
          pvap: "0,00",
          color: c.color,
          st: "Aguardando início"
        })),
        estados: {}
      };

      return new Response(JSON.stringify(prePayload), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=15, s-maxage=15'
        }
      });
    }

    // Consulta aos 27 estados
    const ufPromises = ESTADOS.map(async (uf) => {
      const data = await fetchTseScope(uf);
      return { uf: uf.toUpperCase(), data };
    });

    const ufResponses = await Promise.all(ufPromises);
    const estadosMap = {};

    ufResponses.forEach(({ uf, data }) => {
      if (data && data.cand && data.cand.length > 0) {
        const sorted = [...data.cand].sort((a, b) => parseInt(b.vap || '0', 10) - parseInt(a.vap || '0', 10));
        const leaderRaw = sorted[0];
        const leaderConf = matchCandidate(leaderRaw);

        estadosMap[uf] = {
          uf: uf,
          pst: data.pst || "0,00",
          leader: {
            shortName: leaderConf.shortName,
            partido: leaderConf.partido,
            percentual: leaderRaw.pvap || "0,00",
            color: leaderConf.color
          }
        };
      }
    });

    // Ordenação decrescente rigorosa por votos apurados nacionais
    const candidatosProcessados = (brasilData.cand || []).map(tseCand => {
      const conf = matchCandidate(tseCand);
      return {
        shortName: conf.shortName,
        nome: conf.nome,
        partido: conf.partido,
        foto: `/fotos/${c.partido}.jpg`,
        vap: tseCand.vap || '0',
        pvap: tseCand.pvap || '0,00',
        color: conf.color,
        st: tseCand.st || 'Em apuração'
      };
    }).sort((a, b) => parseInt(b.vap, 10) - parseInt(a.vap, 10));

    let horaExibicao = (brasilData.hg || '').substring(0, 5);
    if (!horaExibicao) {
      horaExibicao = new Date().toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    const payload = {
      source: "TSE_PRODUCAO_OFICIAL",
      hora: horaExibicao,
      pst: brasilData.pst || "0,00",
      secoesTotalizadas: brasilData.st || "0",
      totalSecoes: brasilData.s || "0",
      candidatos: candidatosProcessados,
      estados: estadosMap
    };

    return new Response(JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=15, s-maxage=15'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: "Erro de processamento no Edge." }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
