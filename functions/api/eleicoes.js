// functions/api/eleicoes.js - Parser Oficial Compatível com o Schema do TSE 2026
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
  { shortName: "LULA", nome: "Lula", partido: "PT", fotoArquivo: "PT", numero: "13", color: "#dc2626" },
  { shortName: "FLAVIO", nome: "Flávio Bolsonaro", partido: "PL", fotoArquivo: "PL", numero: "22", color: "#2563eb" },
  { shortName: "CAIADO", nome: "Caiado", partido: "PSD", fotoArquivo: "PSD", numero: "55", color: "#0284c7" },
  { shortName: "ZEMA", nome: "Zema", partido: "Novo", fotoArquivo: "Novo", numero: "30", color: "#ea580c" },
  { shortName: "RENAN", nome: "Renan Santos", partido: "Missão", fotoArquivo: "Missao", numero: "14", color: "#d97706" },
  { shortName: "CURY", nome: "Cury", partido: "Avante", fotoArquivo: "Avante", numero: "70", color: "#059669" },
  { shortName: "SAMARA", nome: "Samara Martins", partido: "UP", fotoArquivo: "UP", numero: "80", color: "#e11d48" },
  { shortName: "HERTZ", nome: "Hertz Dias", partido: "PSTU", fotoArquivo: "PSTU", numero: "16", color: "#b91c1c" },
  { shortName: "EDMILSON", nome: "Edmilson Costa", partido: "PCB", fotoArquivo: "PCB", numero: "21", color: "#991b1b" },
  { shortName: "RUI PIMENTA", nome: "Rui Costa Pimenta", partido: "PCO", fotoArquivo: "PCO", numero: "29", color: "#7f1d1d" },
  { shortName: "AVALANCHE", nome: "Leonardo Avalanche", partido: "PRTB", fotoArquivo: "PRTB", numero: "28", color: "#ca8a04" },
  { shortName: "GRASSI", nome: "Grassi", partido: "Democrata", fotoArquivo: "Democrata", numero: "35", color: "#1d4ed8" },
  { shortName: "CLARIANA", nome: "Clariana Barão", partido: "DC", fotoArquivo: "DC", numero: "27", color: "#0891b2" }
];

// Extrator universal: extrai candidatos tanto da estrutura aninhada (carg -> agr -> par -> cand) quanto da plana (cand[])
function extractCandidatesUniversal(tseData) {
  const candidates = [];
  if (!tseData) return candidates;

  // 1. Formato Unificado Oficial (-u.json)
  if (tseData.carg && Array.isArray(tseData.carg) && tseData.carg.length > 0) {
    const cargo = tseData.carg[0];
    if (cargo.agr && Array.isArray(cargo.agr)) {
      for (const agr of cargo.agr) {
        const com = agr.com || '';
        if (agr.par && Array.isArray(agr.par)) {
          for (const par of agr.par) {
            const sg = par.sg || '';
            if (par.cand && Array.isArray(par.cand)) {
              for (const c of par.cand) {
                candidates.push({
                  n: String(c.n || '').trim(),
                  nm: c.nm || '',
                  nmu: c.nmu || c.nm || '',
                  sg: sg,
                  cc: com,
                  vap: String(c.vap || '0'),
                  pvap: String(c.pvap || '0,00'),
                  st: c.st || ''
                });
              }
            }
          }
        }
      }
    }
  } 
  // 2. Formato Simplificado (-r.json)
  else if (tseData.cand && Array.isArray(tseData.cand)) {
    for (const c of tseData.cand) {
      candidates.push({
        n: String(c.n || '').trim(),
        nm: c.nm || '',
        nmu: c.nmu || c.nm || '',
        sg: (c.cc || '').split(' ')[0] || '',
        cc: c.cc || '',
        vap: String(c.vap || '0'),
        pvap: String(c.pvap || '0,00'),
        st: c.st || ''
      });
    }
  }

  return candidates;
}

function matchCandidate(tseCand) {
  const numStr = String(tseCand.n || '').trim();
  const sgUpper = String(tseCand.sg || '').toUpperCase().trim();
  const coligacao = String(tseCand.cc || '').toUpperCase();

  // 1. Casamento direto por número oficial
  const porNumero = CANDIDATOS_CONFIG.find(c => c.numero === numStr);
  if (porNumero) return porNumero;

  // 2. Casamento por sigla do partido
  const porPartido = CANDIDATOS_CONFIG.find(c => c.partido.toUpperCase() === sgUpper);
  if (porPartido) return porPartido;

  // 3. Casamento pela coligação
  const porColigacao = CANDIDATOS_CONFIG.find(c => coligacao.includes(c.partido.toUpperCase()));
  if (porColigacao) return porColigacao;

  return {
    shortName: (tseCand.nmu || tseCand.nm || 'CANDIDATO').split(' ')[0].toUpperCase(),
    nome: tseCand.nmu || tseCand.nm || 'Candidato',
    partido: tseCand.sg || 'OUTRO',
    fotoArquivo: tseCand.sg || 'OUTRO',
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
    const rawCandidates = extractCandidatesUniversal(brasilData);

    // Extração robusta dos metadados de seções (objeto 's')
    const secoes = brasilData && typeof brasilData.s === 'object' ? brasilData.s : {};
    const pst = secoes.pst || (brasilData && brasilData.pst) || '0,00';
    const totalSecoes = secoes.ts || (brasilData && brasilData.s) || '499248';
    const secoesTotalizadas = secoes.st || (brasilData && brasilData.st) || '0';

    // Determina a hora de exibição
    let horaExibicao = (brasilData && brasilData.hg ? brasilData.hg.substring(0, 5) : '');
    if (!horaExibicao) {
      horaExibicao = new Date().toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    // Se o arquivo ainda não existe ou não possui candidatos
    if (!brasilData || rawCandidates.length === 0) {
      const prePayload = {
        source: "TSE_PRODUCAO_AGUARDANDO",
        hora: horaExibicao,
        pst: "0,00",
        secoesTotalizadas: "0",
        totalSecoes: totalSecoes,
        candidatos: CANDIDATOS_CONFIG.map(c => ({
          shortName: c.shortName,
          nome: c.nome,
          partido: c.partido,
          fotoArquivo: c.fotoArquivo,
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

    // Consulta paralela das 27 Unidades Federativas para o mapa do IBGE
    const ufPromises = ESTADOS.map(async (uf) => {
      const data = await fetchTseScope(uf);
      return { uf: uf.toUpperCase(), data };
    });

    const ufResponses = await Promise.all(ufPromises);
    const estadosMap = {};

    ufResponses.forEach(({ uf, data }) => {
      if (data) {
        const uCands = extractCandidatesUniversal(data);
        if (uCands.length > 0) {
          uCands.sort((a, b) => parseInt(b.vap || '0', 10) - parseInt(a.vap || '0', 10));
          const leaderRaw = uCands[0];
          const leaderConf = matchCandidate(leaderRaw);

          const uSec = typeof data.s === 'object' ? data.s : {};
          estadosMap[uf] = {
            uf: uf,
            pst: uSec.pst || data.pst || "0,00",
            leader: {
              shortName: leaderConf.shortName,
              partido: leaderConf.partido,
              percentual: leaderRaw.pvap || "0,00",
              color: leaderConf.color
            }
          };
        }
      }
    });

    // Mapeamento dos candidatos nacionais
    let candidatosProcessados = rawCandidates.map(tseCand => {
      const conf = matchCandidate(tseCand);
      return {
        shortName: conf.shortName,
        nome: conf.nome,
        partido: conf.partido,
        fotoArquivo: conf.fotoArquivo,
        vap: tseCand.vap || '0',
        pvap: tseCand.pvap || '0,00',
        color: conf.color,
        st: tseCand.st || 'Em apuração'
      };
    });

    // Ordenação decrescente:
    // Se ainda estiver com 0 votos em tudo (antes das 17h), preserva a ordem de exibição inicial do slide (Lula na esquerda, Flávio na direita)
    const algumVoto = candidatosProcessados.some(c => parseInt(c.vap, 10) > 0);
    if (algumVoto) {
      candidatosProcessados.sort((a, b) => parseInt(b.vap, 10) - parseInt(a.vap, 10));
    } else {
      // Ordenação padrão para tela de espera com os dois primeiros definidos no slide
      const ordemDesejada = ["LULA", "FLAVIO", "CAIADO", "ZEMA", "RENAN", "CURY", "SAMARA", "HERTZ", "EDMILSON", "RUI PIMENTA", "AVALANCHE", "GRASSI", "CLARIANA"];
      candidatosProcessados.sort((a, b) => {
        const idxA = ordemDesejada.indexOf(a.shortName);
        const idxB = ordemDesejada.indexOf(b.shortName);
        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
      });
    }

    const payload = {
      source: "TSE_PRODUCAO_OFICIAL",
      hora: horaExibicao,
      pst: pst,
      secoesTotalizadas: secoesTotalizadas,
      totalSecoes: totalSecoes,
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
