// functions/api/eleicoes.js - Backend Oficial de Produção TSE (Cloudflare Pages)
const TSE_BASE_URL = 'https://resultados.tse.jus.br/oficial';
const ELEICAO_ID = '6257';      // Eleição Geral Federal 2026
const ELEICAO_CODE = 'e006257'; // Código com padding oficial de 6 dígitos
const CARGO_PRESIDENTE = '0001';

const ESTADOS = [
  'ac', 'al', 'ap', 'am', 'ba', 'ce', 'df', 'es', 'go', 'ma',
  'mt', 'ms', 'mg', 'pa', 'pb', 'pr', 'pe', 'pi', 'rj', 'rn',
  'rs', 'ro', 'rr', 'sc', 'sp', 'se', 'to'
];

// Configuração oficial dos 13 candidatos homologados pelo TSE
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

// Extrator universal: extrai candidatos e vices da árvore aninhada carg -> agr -> par -> cand
function extractCandidatesUniversal(tseData) {
  const candidates = [];
  if (!tseData) return candidates;

  if (tseData.carg && Array.isArray(tseData.carg) && tseData.carg.length > 0) {
    const cargo = tseData.carg[0];
    if (cargo.agr && Array.isArray(cargo.agr)) {
      for (const agr of cargo.agr) {
        const com = agr.com || '';
        const coligacaoNome = agr.nm || '';
        if (agr.par && Array.isArray(agr.par)) {
          for (const par of agr.par) {
            const sg = par.sg || '';
            const partidoNome = par.nm || '';
            if (par.cand && Array.isArray(par.cand)) {
              for (const c of par.cand) {
                const vices = [];
                if (c.vs && Array.isArray(c.vs)) {
                  for (const v of c.vs) {
                    vices.push({
                      nomeCivil: v.nm || '',
                      nomeUrna: v.nmu || v.nm || '',
                      partido: v.sgp || ''
                    });
                  }
                }
                const viceInfo = vices[0] || { nomeCivil: 'Não informado', nomeUrna: 'Não informado', partido: '' };

                candidates.push({
                  n: String(c.n || '').trim(),
                  sqcand: c.sqcand || '',
                  nm: c.nm || '',
                  nmu: c.nmu || c.nm || '',
                  sg: sg,
                  partidoNome: partidoNome,
                  cc: com,
                  coligacaoNome: coligacaoNome,
                  dtNasc: c.dt || '',
                  seq: c.seq || '',
                  vap: String(c.vap || '0'),
                  pvap: String(c.pvap || '0,00'),
                  st: c.st || '',
                  vice: viceInfo
                });
              }
            }
          }
        }
      }
    }
  } else if (tseData.cand && Array.isArray(tseData.cand)) {
    for (const c of tseData.cand) {
      candidates.push({
        n: String(c.n || '').trim(),
        sqcand: '',
        nm: c.nm || '',
        nmu: c.nmu || c.nm || '',
        sg: (c.cc || '').split(' ')[0] || '',
        partidoNome: '',
        cc: c.cc || '',
        coligacaoNome: '',
        dtNasc: '',
        seq: '',
        vap: String(c.vap || '0'),
        pvap: String(c.pvap || '0,00'),
        st: c.st || '',
        vice: { nomeCivil: 'Não informado', nomeUrna: 'Não informado', partido: '' }
      });
    }
  }

  return candidates;
}

function matchCandidate(tseCand) {
  const numStr = String(tseCand.n || '').trim();
  const sgUpper = String(tseCand.sg || '').toUpperCase().trim();
  const coligacao = String(tseCand.cc || '').toUpperCase();

  // 1. Prioridade: Casamento pelo número oficial de urna
  const porNumero = CANDIDATOS_CONFIG.find(c => c.numero === numStr);
  if (porNumero) return porNumero;

  // 2. Casamento pela sigla partidária
  const porPartido = CANDIDATOS_CONFIG.find(c => c.partido.toUpperCase() === sgUpper);
  if (porPartido) return porPartido;

  // 3. Casamento pelo nome na coligação
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
  // Converte a sigla da UF obrigatoriamente para minúsculas
  const uf = scope.toLowerCase();
  const url = `${TSE_BASE_URL}/ele2026/${ELEICAO_ID}/dados/${uf}/${uf}-c${CARGO_PRESIDENTE}-${ELEICAO_CODE}-u.json`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'CentralApuracao2026/ProductionEdge',
        'Accept': 'application/json, text/plain, */*'
      },
      cf: {
        cacheTtl: 15, // Cache de borda na CDN Cloudflare por 15 segundos
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
    // 1. Busca consolidado nacional (BR)
    const brasilData = await fetchTseScope('br');
    const rawCandidates = extractCandidatesUniversal(brasilData);

    // Extração estruturada dos objetos de metadados
    const secoes = brasilData && typeof brasilData.s === 'object' ? brasilData.s : {};
    const eleitorado = brasilData && typeof brasilData.e === 'object' ? brasilData.e : {};
    const votos = brasilData && typeof brasilData.v === 'object' ? brasilData.v : {};

    const pst = secoes.pst || (brasilData && brasilData.pst) || '0,00';
    const totalSecoes = secoes.ts || (brasilData && brasilData.s) || '499248';
    const secoesTotalizadas = secoes.st || (brasilData && brasilData.st) || '0';
    const secoesNaoTotalizadas = secoes.snt || '499248';

    const totalEleitores = eleitorado.te || '158745502';
    const comparecimento = eleitorado.c || '0';
    const comparecimentoPerc = eleitorado.pc || '0,00';
    const abstencao = eleitorado.a || '0';
    const abstencaoPerc = eleitorado.pa || '0,00';

    const votosValidos = votos.vvc || '0';
    const votosValidosPerc = votos.pvvc || '0,00';
    const votosBrancos = votos.vb || '0';
    const votosBrancosPerc = votos.pvb || '0,00';
    const votosNulos = votos.vn || '0';
    const votosNulosPerc = votos.pvn || '0,00';
    const votosTotal = votos.tv || '0';

    const horaLoteTse = (brasilData && brasilData.hg ? brasilData.hg.substring(0, 5) : '--:--');
    const dataLoteTse = (brasilData && brasilData.dg ? brasilData.dg : '');

    // 2. Consulta paralela controlada para os 27 estados do Brasil
    const ufPromises = ESTADOS.map(async (uf) => {
      const data = await fetchTseScope(uf);
      return { uf: uf.toUpperCase(), data };
    });

    const ufResponses = await Promise.all(ufPromises);
    const estadosMap = {};

    ufResponses.forEach(({ uf, data }) => {
      if (data) {
        const uCands = extractCandidatesUniversal(data);
        const uSec = typeof data.s === 'object' ? data.s : {};
        const uEle = typeof data.e === 'object' ? data.e : {};
        const uVot = typeof data.v === 'object' ? data.v : {};

        // Checa se o estado já possui votos válidos computados
        const temVotos = uCands.some(c => parseInt(c.vap || '0', 10) > 0);

        if (uCands.length > 0 && temVotos) {
          uCands.sort((a, b) => parseInt(b.vap || '0', 10) - parseInt(a.vap || '0', 10));
          const leaderRaw = uCands[0];
          const secondRaw = uCands[1] || { nmu: "---", vap: "0", pvap: "0,00" };

          const leaderConf = matchCandidate(leaderRaw);
          const secondConf = matchCandidate(secondRaw);

          estadosMap[uf] = {
            uf: uf,
            pst: uSec.pst || data.pst || "0,00",
            secoesTotalizadas: uSec.st || "0",
            totalSecoes: uSec.ts || "0",
            eleitorado: uEle.te || "0",
            comparecimento: uEle.c || "0",
            votosValidos: uVot.vvc || "0",
            votosBrancos: uVot.vb || "0",
            votosNulos: uVot.vn || "0",
            leader: {
              shortName: leaderConf.shortName,
              partido: leaderConf.partido,
              percentual: leaderRaw.pvap || "0,00",
              vap: leaderRaw.vap || "0",
              color: leaderConf.color
            },
            second: {
              shortName: secondConf.shortName,
              partido: secondConf.partido,
              percentual: secondRaw.pvap || "0,00",
              vap: secondRaw.vap || "0"
            }
          };
        } else {
          // Estado neutro antes do início das urnas (evita apontar líder fictício)
          estadosMap[uf] = {
            uf: uf,
            pst: uSec.pst || (data && data.pst) || "0,00",
            secoesTotalizadas: uSec.st || "0",
            totalSecoes: uSec.ts || "0",
            eleitorado: uEle.te || "0",
            comparecimento: "0",
            votosValidos: "0",
            votosBrancos: "0",
            votosNulos: "0",
            leader: { shortName: "---", partido: "--", percentual: "0,00", vap: "0", color: "#253456" },
            second: { shortName: "---", partido: "--", percentual: "0,00", vap: "0" }
          };
        }
      }
    });

    // 3. Processamento dos 13 Candidatos Presidenciais Nacionais
    let candidatosProcessados = [];
    if (rawCandidates.length > 0) {
      candidatosProcessados = rawCandidates.map(tseCand => {
        const conf = matchCandidate(tseCand);
        return {
          shortName: conf.shortName,
          nomeUrna: tseCand.nmu,
          nomeCivil: tseCand.nm,
          partido: conf.partido,
          partidoNome: tseCand.partidoNome,
          coligacao: tseCand.cc,
          coligacaoNome: tseCand.coligacaoNome,
          dtNasc: tseCand.dtNasc,
          sqcand: tseCand.sqcand,
          fotoArquivo: conf.fotoArquivo,
          numero: conf.numero,
          vap: tseCand.vap || '0',
          pvap: tseCand.pvap || '0,00',
          color: conf.color,
          st: tseCand.st || 'Em apuração',
          vice: tseCand.vice
        };
      });
    } else {
      // Estado de espera antes da totalização
      candidatosProcessados = CANDIDATOS_CONFIG.map(c => ({
        shortName: c.shortName,
        nomeUrna: c.nome,
        nomeCivil: c.nome,
        partido: c.partido,
        partidoNome: c.partido,
        coligacao: c.partido,
        fotoArquivo: c.fotoArquivo,
        numero: c.numero,
        vap: "0",
        pvap: "0,00",
        color: c.color,
        st: "Aguardando início",
        vice: { nomeCivil: "Não informado", nomeUrna: "Não informado", partido: "" }
      }));
    }

    // 4. Regra de Ordenação
    // Se houver votos: ordena estritamente por votos apurados válidos (ordem decrescente)
    const algumVoto = candidatosProcessados.some(c => parseInt(c.vap, 10) > 0);
    if (algumVoto) {
      candidatosProcessados.sort((a, b) => parseInt(b.vap, 10) - parseInt(a.vap, 10));
    } else {
      // Pré-eleição (0 votos): preserva Lula na esquerda e Flávio na direita para a tela de espera
      const ordemDesejada = ["LULA", "FLAVIO", "CAIADO", "ZEMA", "RENAN", "CURY", "SAMARA", "HERTZ", "EDMILSON", "RUI PIMENTA", "AVALANCHE", "GRASSI", "CLARIANA"];
      candidatosProcessados.sort((a, b) => {
        const idxA = ordemDesejada.indexOf(a.shortName);
        const idxB = ordemDesejada.indexOf(b.shortName);
        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
      });
    }

    candidatosProcessados = candidatosProcessados.map((c, i) => ({ ...c, rank: i + 1 }));

    // Determina a situação geral do pleito
    let statusTexto = "Em andamento";
    if (brasilData && brasilData.ea === 'M') {
      statusTexto = "Matematicamente Definido";
    } else if (pst === '100,00') {
      statusTexto = "Totalização Concluída";
    }

    const payload = {
      source: "TSE_PRODUCAO_OFICIAL",
      horaLoteTse: horaLoteTse,
      dataLoteTse: dataLoteTse,
      statusTotalizacao: statusTexto,
      pst: pst,
      secoesTotalizadas: secoesTotalizadas,
      totalSecoes: totalSecoes,
      secoesNaoTotalizadas: secoesNaoTotalizadas,
      totalEleitores: totalEleitores,
      comparecimento: comparecimento,
      comparecimentoPerc: comparecimentoPerc,
      abstencao: abstencao,
      abstencaoPerc: abstencaoPerc,
      votosValidos: votosValidos,
      votosValidosPerc: votosValidosPerc,
      votosBrancos: votosBrancos,
      votosBrancosPerc: votosBrancosPerc,
      votosNulos: votosNulos,
      votosNulosPerc: votosNulosPerc,
      votosTotal: votosTotal,
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
    return new Response(JSON.stringify({ error: "Erro de consulta no Edge da Cloudflare." }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
