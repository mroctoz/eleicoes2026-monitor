// functions/api/senadores.js - Backend Oficial para Senado Federal 2026
const TSE_BASE_URL = 'https://resultados.tse.jus.br/oficial';
const ELEICAO_ESTADUAL_ID = '6259';
const ELEICAO_CODE = 'e006259';
const CARGO_SENADOR = '0005';

const ESTADOS_TOP8 = [
  { uf: 'sp', nome: 'São Paulo', regiao: 'Sudeste' },
  { uf: 'mg', nome: 'Minas Gerais', regiao: 'Sudeste' },
  { uf: 'ba', nome: 'Bahia', regiao: 'Nordeste' },
  { uf: 'rj', nome: 'Rio de Janeiro', regiao: 'Sudeste' },
  { uf: 'pr', nome: 'Paraná', regiao: 'Sul' },
  { uf: 'rs', nome: 'Rio Grande do Sul', regiao: 'Sul' },
  { uf: 'ce', nome: 'Ceará', regiao: 'Nordeste' },
  { uf: 'pe', nome: 'Pernambuco', regiao: 'Nordeste' }
];

const CORES_PARTIDOS = {
  '10': '#0d9488', // REPUBLICANOS
  '11': '#0284c7', // PP
  '13': '#dc2626', // PT
  '14': '#d97706', // MISSÃO
  '15': '#16a34a', // MDB
  '16': '#b91c1c', // PSTU
  '18': '#059669', // REDE
  '20': '#10b981', // PODEMOS
  '21': '#991b1b', // PCB
  '22': '#2563eb', // PL
  '23': '#ec4899', // CIDADANIA
  '27': '#0891b2', // DC
  '28': '#ca8a04', // PRTB
  '29': '#7f1d1d', // PCO
  '30': '#ea580c', // NOVO
  '35': '#1d4ed8', // DEMOCRATA
  '36': '#0284c7', // AGIR
  '40': '#d97706', // PSB
  '44': '#4338ca', // UNIÃO BRASIL
  '45': '#0284c7', // PSDB
  '50': '#9333ea', // PSOL
  '55': '#0284c7', // PSD
  '70': '#059669', // AVANTE
  '80': '#e11d48', // UP
  'DEFAULT': '#475569'
};

function getPartyColor(partyNumber, sigla) {
  const numStr = String(partyNumber || '').trim();
  const prefix = numStr.substring(0, 2);
  if (CORES_PARTIDOS[prefix]) return CORES_PARTIDOS[prefix];

  const sg = String(sigla || '').toUpperCase();
  if (sg.includes('PL')) return '#2563eb';
  if (sg.includes('PT')) return '#dc2626';
  if (sg.includes('PP')) return '#0284c7';
  if (sg.includes('PSB')) return '#d97706';
  if (sg.includes('REDE')) return '#059669';
  if (sg.includes('MISSÃO') || sg.includes('MISSAO')) return '#d97706';
  if (sg.includes('PSD')) return '#0284c7';
  if (sg.includes('MDB')) return '#16a34a';
  if (sg.includes('REPUBLICANOS')) return '#0d9488';
  if (sg.includes('UNIÃO') || sg.includes('UNIAO')) return '#4338ca';

  return CORES_PARTIDOS['DEFAULT'];
}

function extractCandidatesSenado(tseData) {
  const candidates = [];
  if (!tseData) return candidates;

  if (tseData.carg && Array.isArray(tseData.carg) && tseData.carg.length > 0) {
    const cargo = tseData.carg.find(c => String(c.cd) === '5') || tseData.carg[0];

    if (cargo && cargo.agr && Array.isArray(cargo.agr)) {
      for (const agr of cargo.agr) {
        const coligacao = agr.com || agr.nm || '';
        const coligacaoNome = agr.nm || '';

        if (agr.par && Array.isArray(agr.par)) {
          for (const par of agr.par) {
            const sg = par.sg || '';
            const partidoNome = par.nm || '';

            if (par.cand && Array.isArray(par.cand)) {
              for (const c of par.cand) {
                const suplentes = [];
                if (c.vs && Array.isArray(c.vs)) {
                  for (const v of c.vs) {
                    suplentes.push({
                      tipo: v.tp === 's1' ? '1º Suplente' : '2º Suplente',
                      nomeCivil: v.nm || '',
                      nomeUrna: v.nmu || v.nm || '',
                      partido: v.sgp || ''
                    });
                  }
                }

                candidates.push({
                  numero: String(c.n || '').trim(),
                  sqcand: c.sqcand || '',
                  nomeCivil: c.nm || '',
                  nomeUrna: c.nmu || c.nm || 'CANDIDATO',
                  partido: sg,
                  partidoNome: partidoNome,
                  coligacao: coligacao,
                  coligacaoNome: coligacaoNome,
                  dtNasc: c.dt || '',
                  seq: c.seq || '',
                  vap: String(c.vap || '0'),
                  pvap: String(c.pvap || '0,00'),
                  st: c.st || '',
                  color: getPartyColor(c.n, sg),
                  suplentes: suplentes
                });
              }
            }
          }
        }
      }
    }
  }

  return candidates;
}

async function fetchSenadoState(uf) {
  const ufLower = uf.toLowerCase();
  const url = `${TSE_BASE_URL}/ele2026/${ELEICAO_ESTADUAL_ID}/dados/${ufLower}/${ufLower}-c${CARGO_SENADOR}-${ELEICAO_CODE}-u.json`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'MonitorSenado2026/CloudflareEdge',
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
    const promises = ESTADOS_TOP8.map(async (item) => {
      const data = await fetchSenadoState(item.uf);
      return { item, data };
    });

    const responses = await Promise.all(promises);

    let horaGeral = '';
    let dataGeral = '';

    const baloes = responses.map(({ item, data }) => {
      const ufUpper = item.uf.toUpperCase();

      if (!data) {
        return {
          uf: ufUpper,
          nome: item.nome,
          regiao: item.regiao,
          pst: "0,00",
          secoesTotalizadas: "0",
          totalSecoes: "0",
          statusTotalizacao: "Aguardando Início",
          cand1: { nomeUrna: "AGUARDANDO DADOS", partido: "--", numero: "--", vap: "0", pvap: "0,00", color: "#334155", st: "Em apuração" },
          cand2: { nomeUrna: "AGUARDANDO DADOS", partido: "--", numero: "--", vap: "0", pvap: "0,00", color: "#334155", st: "Em apuração" },
          cand3: { nomeUrna: "AGUARDANDO DADOS", partido: "--", numero: "--", vap: "0", pvap: "0,00", color: "#334155", st: "Em apuração" }
        };
      }

      if (data.hg && !horaGeral) horaGeral = data.hg.substring(0, 5);
      if (data.dg && !dataGeral) dataGeral = data.dg;

      const secoes = typeof data.s === 'object' ? data.s : {};
      const pst = secoes.pst || data.pst || "0,00";
      const totalSecoes = secoes.ts || data.s || "0";
      const secoesTotalizadas = secoes.st || data.st || "0";

      const rawCandidates = extractCandidatesSenado(data);
      const temVotos = rawCandidates.some(c => parseInt(c.vap || '0', 10) > 0);

      if (temVotos) {
        rawCandidates.sort((a, b) => parseInt(b.vap || '0', 10) - parseInt(a.vap || '0', 10));
      }

      const cand1 = rawCandidates[0] || { nomeUrna: "SEM DADOS", partido: "--", numero: "--", vap: "0", pvap: "0,00", color: "#334155", st: "Aguardando" };
      const cand2 = rawCandidates[1] || { nomeUrna: "SEM DADOS", partido: "--", numero: "--", vap: "0", pvap: "0,00", color: "#334155", st: "Aguardando" };
      const cand3 = rawCandidates[2] || { nomeUrna: "SEM DADOS", partido: "--", numero: "--", vap: "0", pvap: "0,00", color: "#334155", st: "Aguardando" };

      let situacaoUf = "Em apuração";
      if (pst === '100,00') {
        situacaoUf = "2 Senadores Eleitos";
      } else if (cand1.st === 'Eleito' && cand2.st === 'Eleito') {
        situacaoUf = "Eleitos Matematicamente";
      }

      return {
        uf: ufUpper,
        nome: item.nome,
        regiao: item.regiao,
        pst: pst,
        secoesTotalizadas: secoesTotalizadas,
        totalSecoes: totalSecoes,
        statusTotalizacao: situacaoUf,
        cand1: cand1,
        cand2: cand2,
        cand3: cand3
      };
    });

    if (!horaGeral) {
      horaGeral = new Date().toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    const payload = {
      source: "TSE_PRODUCAO_SENADO",
      hora: horaGeral,
      dataGeracao: dataGeral || new Date().toLocaleDateString('pt-BR'),
      baloes: baloes
    };

    return new Response(JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=15, s-maxage=15'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: "Erro crítico no Edge para Senado." }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
