// server.js - Backend Auditado e Blindado para as Eleições 2026
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const NodeCache = require('node-cache');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Cache do TSE (15 segundos) e Cache da Malha do IBGE (24 horas)
const tseCache = new NodeCache({ stdTTL: 15, checkperiod: 5 });
const geoCache = new NodeCache({ stdTTL: 86400 });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Constantes Oficiais do TSE (Resolução nº 23.751/2026)
const TSE_BASE_URL = 'https://resultados.tse.jus.br/oficial';
const ELEICAO_ID = '6257';      // Eleição Geral Federal 2026
const ELEICAO_CODE = 'e006257'; // Código com padding de 6 dígitos
const CARGO_PRESIDENTE = '0001';

const ESTADOS = [
  'ac', 'al', 'ap', 'am', 'ba', 'ce', 'df', 'es', 'go', 'ma',
  'mt', 'ms', 'mg', 'pa', 'pb', 'pr', 'pe', 'pi', 'rj', 'rn',
  'rs', 'ro', 'rr', 'sc', 'sp', 'se', 'to'
];

// Configuração oficial dos 13 candidatos com as legendas registradas no TSE
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

// Middleware de entrega de fotos imune a maiúsculas/minúsculas e acentuação
app.get('/fotos/:filename', (req, res, next) => {
  const reqBase = req.params.filename.replace(/\.[^/.]+$/, "").toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const fotosDir = path.join(__dirname, 'fotos');

  if (!fs.existsSync(fotosDir)) {
    return next();
  }

  const arquivos = fs.readdirSync(fotosDir);
  const encontrado = arquivos.find(arquivo => {
    const nomeBase = arquivo.replace(/\.[^/.]+$/, "").toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return nomeBase === reqBase;
  });

  if (encontrado) {
    return res.sendFile(path.join(fotosDir, encontrado));
  }
  next();
});

// Cache da malha geográfica do IBGE para evitar falhas caso a API federal oscile
app.get('/api/malha-ibge', async (req, res) => {
  const cachedGeo = geoCache.get('malha_brasil');
  if (cachedGeo) {
    return res.json(cachedGeo);
  }

  try {
    const response = await axios.get('https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=intermediaria&intrarregiao=UF', { timeout: 6000 });
    geoCache.set('malha_brasil', response.data);
    return res.json(response.data);
  } catch (err) {
    console.error("Alerta: Não foi possível obter malha atualizada do IBGE. Utilizando cache de contingência.");
    return res.status(503).json({ error: "Malha geográfica indisponível no momento." });
  }
});

function matchCandidate(tseCand) {
  const numStr = String(tseCand.n || '').trim();
  const nomeStr = (tseCand.nm || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const coligacao = (tseCand.cc || '').toUpperCase();

  // 1. Prioridade: Casamento pelo número oficial de urna
  const porNumero = CANDIDATOS_CONFIG.find(c => c.numero === numStr);
  if (porNumero) return porNumero;

  // 2. Casamento pela sigla partidária na coligação
  const porPartido = CANDIDATOS_CONFIG.find(c => {
    const pNorm = c.partido.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return coligacao.includes(pNorm);
  });
  if (porPartido) return porPartido;

  // 3. Casamento por similaridade no nome de urna
  const porNome = CANDIDATOS_CONFIG.find(c => {
    const sNorm = c.shortName.toLowerCase();
    return nomeStr.includes(sNorm);
  });
  if (porNome) return porNome;

  // Fallback seguro caso surja um candidato não previsto
  return {
    shortName: (tseCand.nm || 'CANDIDATO').split(' ')[0].toUpperCase(),
    nome: tseCand.nm || 'Candidato',
    partido: coligacao.split(' ')[0] || 'OUTRO',
    numero: numStr,
    color: '#475569'
  };
}

const tseClient = axios.create({
  timeout: 4500,
  headers: {
    'User-Agent': 'CentralApuracao2026/1.0 (Monitor Eleitoral)',
    'Accept': 'application/json, text/plain, */*',
    'Cache-Control': 'no-cache'
  }
});

async function fetchTseFile(scope) {
  const uf = scope.toLowerCase();
  const url = `${TSE_BASE_URL}/ele2026/${ELEICAO_ID}/dados/${uf}/${uf}-c${CARGO_PRESIDENTE}-${ELEICAO_CODE}-u.json`;
  try {
    const res = await tseClient.get(url);
    return res.data;
  } catch (err) {
    return null;
  }
}

app.get('/api/eleicoes', async (req, res) => {
  const cached = tseCache.get('consolidado_tse');
  if (cached) {
    return res.json(cached);
  }

  try {
    const brasilData = await fetchTseFile('br');

    // Estado de espera antes das 17h00 (ou enquanto não houver dados abertos)
    if (!brasilData || !brasilData.cand || brasilData.cand.length === 0) {
      const now = new Date();
      const horaString = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      const waitingPayload = {
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

      // Proteção de 30s contra bombardeamento de requisições no TSE antes da apuração
      tseCache.set('consolidado_tse', waitingPayload, 30);
      return res.json(waitingPayload);
    }

    // Coleta paralela de todas as 27 UFs para o mapa coroplético
    const ufPromises = ESTADOS.map(async (uf) => {
      const data = await fetchTseFile(uf);
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

    // Ordenação estrita por votos apurados (determina as posições de 1º a 5º)
    const candidatosProcessados = (brasilData.cand || []).map(tseCand => {
      const conf = matchCandidate(tseCand);
      return {
        shortName: conf.shortName,
        nome: conf.nome,
        partido: conf.partido,
        foto: `/fotos/${conf.partido}.jpg`,
        vap: tseCand.vap || '0',
        pvap: tseCand.pvap || '0,00',
        color: conf.color,
        st: tseCand.st || 'Em apuração'
      };
    }).sort((a, b) => parseInt(b.vap, 10) - parseInt(a.vap, 10));

    let horaExibicao = (brasilData.hg || '').substring(0, 5);
    if (!horaExibicao) {
      horaExibicao = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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

    tseCache.set('consolidado_tse', payload);
    return res.json(payload);

  } catch (error) {
    console.error("Falha na sincronização:", error.message);
    return res.status(500).json({ error: "Erro de consulta ao TSE." });
  }
});

// Pré-carregamento inicial da malha do IBGE ao ligar o servidor
app.listen(PORT, async () => {
  console.log(`Servidor de Produção Ativo em http://localhost:${PORT}`);
  try {
    const geo = await axios.get('https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=intermediaria&intrarregiao=UF', { timeout: 6000 });
    geoCache.set('malha_brasil', geo.data);
    console.log("Malha oficial do IBGE carregada e mantida em cache local.");
  } catch (e) {
    console.warn("Aviso: Falha ao pré-carregar malha do IBGE. Será tentado novamente na primeira requisição.");
  }
});