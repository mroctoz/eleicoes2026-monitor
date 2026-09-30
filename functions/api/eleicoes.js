// functions/api/eleicoes.js - API Oficial Completa para Slide e Painel Detalhado
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
                  nm: c.nm || '',
                  nmu: c.nmu || c.nm || '',
                  sg: sg,
                  partidoNome: partidoNome,
                  cc: com,
                  coligacaoNome: coligacaoNome,
                  dtNasc: c.dt || '',
                  seq: c.seq || '',
                  sqcand: c.sqcand || '',
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
        nm: c.nm || '',
        nmu: c.nmu || c.nm || '',
        sg: (c.cc || '').split(' ')[0] || '',
        partidoNome: '',
        cc: c.cc || '',
        coligacaoNome: '',
        dtNasc: '',
        seq: '',
        sqcand: '',
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

  const porNumero = CANDIDATOS_CONFIG.find(c => c.numero === numStr);
  if (porNumero) return porNumero;

  const porPartido = CANDIDATOS_CONFIG.find(c => c.partido.toUpperCase() === sgUpper);
  if (porPartido) return porPartido;

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
        'User-Agent': 'CentralApuracao2026/EdgeDetailed',
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

    let horaExibicao = (brasilData && brasilData.hg ? brasilData.hg.substring(0, 5) : '');
    const dataGeracao = (brasilData && brasilData.dg ? brasilData.dg : '');
    if (!horaExibicao) {
      horaExibicao = new Date().toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    if (!brasilData || rawCandidates.length === 0) {
      const prePayload = {
        source: "TSE_PRODUCAO_AGUARDANDO",
        hora: horaExibicao,
        dataGeracao: dataGeracao || new Date().toLocaleDateString('pt-BR'),
        statusTotalizacao: "Aguardando Fechamento das Urnas (17h00)",
        pst: "0,00",
        secoesTotalizadas: "0",
        totalSecoes: totalSecoes,
        secoesNaoTotalizadas: totalSecoes,
        totalEleitores: totalEleitores,
        comparecimento: "0",
        comparecimentoPerc: "0,00",
        abstencao: "0",
        abstencaoPerc: "0,00",
        votosValidos: "0",
        votosValidosPerc: "0,00",
        votosBrancos: "0",
        votosBrancosPerc: "0,00",
        votosNulos: "0",
        votosNulosPerc: "0,00",
        votosTotal: "0",
        candidatos: CANDIDATOS_CONFIG.map((c, idx) => ({
          rank: idx + 1,
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

    // Consulta paralela das 27 UFs para o mapa e tabela detalhada
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

        let leaderObj = { shortName: "---", partido: "", percentual: "0,00", vap: "0", color: "#334155" };
        let secondObj = { shortName: "---", partido: "", percentual: "0,00", vap: "0" };
        let sortedUfCands = [];

        if (uCands.length > 0) {
          sortedUfCands = uCands.map(c => {
            const conf = matchCandidate(c);
            return {
              shortName: conf.shortName,
              nomeUrna: c.nmu,
              partido: conf.partido,
              numero: conf.numero,
              vap: c.vap,
              pvap: c.pvap,
              color: conf.color,
              st: c.st
            };
          }).sort((a, b) => parseInt(b.vap || '0', 10) - parseInt(a.vap || '0', 10));

          const lRaw = sortedUfCands[0];
          leaderObj = {
            shortName: lRaw.shortName,
            partido: lRaw.partido,
            percentual: lRaw.pvap || "0,00",
            vap: lRaw.vap,
            color: lRaw.color
          };

          if (sortedUfCands.length > 1) {
            const sRaw = sortedUfCands[1];
            secondObj = {
              shortName: sRaw.shortName,
              partido: sRaw.partido,
              percentual: sRaw.pvap || "0,00",
              vap: sRaw.vap
            };
          }
        }

        estadosMap[uf] = {
          uf: uf,
          pst: uSec.pst || data.pst || "0,00",
          secoesTotalizadas: uSec.st || "0",
          totalSecoes: uSec.ts || "0",
          eleitorado: uEle.te || "0",
          comparecimento: uEle.c || "0",
          abstencao: uEle.a || "0",
          votosValidos: uVot.vvc || "0",
          votosBrancos: uVot.vb || "0",
          votosNulos: uVot.vn || "0",
          leader: leaderObj,
          second: secondObj,
          candidatos: sortedUfCands
        };
      }
    });

    let candidatosProcessados = rawCandidates.map(tseCand => {
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

    const algumVoto = candidatosProcessados.some(c => parseInt(c.vap, 10) > 0);
    if (algumVoto) {
      candidatosProcessados.sort((a, b) => parseInt(b.vap, 10) - parseInt(a.vap, 10));
    } else {
      const ordemDesejada = ["LULA", "FLAVIO", "CAIADO", "ZEMA", "RENAN", "CURY", "SAMARA", "HERTZ", "EDMILSON", "RUI PIMENTA", "AVALANCHE", "GRASSI", "CLARIANA"];
      candidatosProcessados.sort((a, b) => {
        const idxA = ordemDesejada.indexOf(a.shortName);
        const idxB = ordemDesejada.indexOf(b.shortName);
        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
      });
    }

    candidatosProcessados = candidatosProcessados.map((c, i) => ({ ...c, rank: i + 1 }));

    let statusTexto = "Em andamento";
    if (brasilData.ea === 'M') {
      statusTexto = "Matematicamente Definido";
    } else if (pst === '100,00') {
      statusTexto = "Totalização Concluída";
    }

    const payload = {
      source: "TSE_PRODUCAO_OFICIAL",
      hora: horaExibicao,
      dataGeracao: dataGeracao,
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
    return new Response(JSON.stringify({ error: "Erro de processamento no Edge." }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
