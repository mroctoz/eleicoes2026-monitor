// simulator.js - Motor autônomo para teste de estresse funcional da interface
const fs = require('fs');

class ElectionSimulator {
  constructor() {
    this.step = 0;
    this.maxSteps = 60; // 60 passos de 3 segundos = 180 segundos (3 minutos)
    this.estadosList = [
      'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
      'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
      'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
    ];
    this.init();
  }

  init() {
    setInterval(() => {
      this.step = (this.step + 1) % (this.maxSteps + 1);
    }, 3000);
  }

  getSnapshot() {
    const progressRatio = this.step / this.maxSteps; // 0.0 a 1.0
    const totalSecoes = 498000;
    const secoesTotalizadas = Math.floor(totalSecoes * progressRatio);
    const pst = (progressRatio * 100).toFixed(2).replace('.', ',');

    // Simulação de virada dinâmica: Candidato B lidera no início, Candidato A vira após 50%
    const totalValidosBase = Math.floor(105000000 * progressRatio);
    let percA, percB;

    if (progressRatio < 0.45) {
      percB = 49.5 - (progressRatio * 4);
      percA = 44.0 + (progressRatio * 6);
    } else {
      percA = 46.7 + ((progressRatio - 0.45) * 5.2);
      percB = 47.7 - ((progressRatio - 0.45) * 6.5);
    }

    const candA_votos = Math.floor((totalValidosBase * percA) / 100);
    const candB_votos = Math.floor((totalValidosBase * percB) / 100);
    const outrosVotos = Math.max(0, totalValidosBase - candA_votos - candB_votos);

    // Definição de situação eleitoral dinâmica
    let statusGeral = "Em andamento";
    let stCandA = "Em apuração";
    let stCandB = "Em apuração";

    if (progressRatio >= 1.0) {
      statusGeral = "Totalização Concluída";
      if (percA > 50.0) {
        stCandA = "Eleito";
        stCandB = "Não eleito";
      } else {
        stCandA = "2º turno";
        stCandB = "2º turno";
      }
    } else if (progressRatio > 0.95 && percA > 50.0) {
      statusGeral = "Matematicamente Definido";
      stCandA = "Eleito";
    }

    // Geração do mapa por UF com alternância real de liderança
    const estadosMap = {};
    this.estadosList.forEach((uf, index) => {
      // Norte e Nordeste tendem a um candidato; Sul e Centro-Oeste a outro
      const isNorthEast = ['BA', 'PE', 'CE', 'MA', 'PI', 'RN', 'PB', 'AL', 'SE', 'PA', 'AP', 'AM'].includes(uf);
      
      // Simula variação de velocidade de apuração por estado (DF apura mais rápido, interior mais lento)
      const speedModifier = (index % 3 === 0) ? 1.2 : 0.85;
      const ufProgress = Math.min(100, Math.floor(progressRatio * 100 * speedModifier));

      let ufLeader, ufSecond;
      if (isNorthEast) {
        ufLeader = {
          numero: "13",
          nome: "LUIZ INÁCIO LULA DA SILVA",
          partido: "PT",
          percentual: (54 + (index % 12)).toFixed(2),
          color: "#b91c1c"
        };
        ufSecond = {
          numero: "22",
          nome: "TARCÍSIO DE FREITAS",
          percentual: (40 - (index % 8)).toFixed(2)
        };
      } else {
        ufLeader = {
          numero: "22",
          nome: "TARCÍSIO DE FREITAS",
          partido: "PL",
          percentual: (52 + (index % 10)).toFixed(2),
          color: "#1d4ed8"
        };
        ufSecond = {
          numero: "13",
          nome: "LUIZ INÁCIO LULA DA SILVA",
          percentual: (42 - (index % 6)).toFixed(2)
        };
      }

      estadosMap[uf] = {
        uf: uf,
        pst: ufProgress.toFixed(2).replace('.', ','),
        leader: ufLeader,
        second: ufSecond,
        totalVotosApurados: Math.floor(totalValidosBase / 27).toString()
      };
    });

    return {
      source: "MOTOR_REPLAY_TESTE_LOCAL",
      statusTotalizacao: statusGeral,
      stepAtual: `${this.step}/${this.maxSteps}`,
      ultimaAtualizacao: new Date().toLocaleTimeString('pt-BR'),
      secoesTotalizadas: secoesTotalizadas.toString(),
      totalSecoes: totalSecoes.toString(),
      pst: pst,
      eleitoradoApto: "156453000",
      comparecimento: Math.floor(124000000 * progressRatio).toString(),
      votosValidos: totalValidosBase.toString(),
      votosBrancos: Math.floor(2100000 * progressRatio).toString(),
      votosNulos: Math.floor(3400000 * progressRatio).toString(),
      candidatos: [
        {
          n: "13",
          nm: "LUIZ INÁCIO LULA DA SILVA",
          cc: "PT - BRASIL DA ESPERANÇA",
          vap: candA_votos.toString(),
          pvap: percA.toFixed(2).replace('.', ','),
          st: stCandA,
          color: "#b91c1c"
        },
        {
          n: "22",
          nm: "TARCÍSIO DE FREITAS",
          cc: "PL - PELO BEM DO BRASIL",
          vap: candB_votos.toString(),
          pvap: percB.toFixed(2).replace('.', ','),
          st: stCandB,
          color: "#1d4ed8"
        },
        {
          n: "12",
          nm: "CIRO GOMES",
          cc: "PDT",
          vap: Math.floor(outrosVotos * 0.6).toString(),
          pvap: (3.15).toFixed(2).replace('.', ','),
          st: "Não eleito",
          color: "#ca8a04"
        },
        {
          n: "30",
          nm: "ROMEU ZEMA",
          cc: "NOVO",
          vap: Math.floor(outrosVotos * 0.4).toString(),
          pvap: (2.42).toFixed(2).replace('.', ','),
          st: "Não eleito",
          color: "#ea580c"
        }
      ].sort((a, b) => parseInt(b.vap) - parseInt(a.vap)),
      estados: estadosMap
    };
  }
}

module.exports = new ElectionSimulator();