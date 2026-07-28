export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export const fmt=v=>"R$ "+Math.abs(+v).toFixed(2).replace(".",",");
export const INI=100;
export const BETS=[0.25,0.5,1,2,5,10,20];

// ═══════════════════════════════════════════════════════════════
// ⚠️ MODO TESTE — turbina o prêmio de TODOS os jogos por este
// número (1.3 = +30%, 1.6 = +60%, 1 = desligado/valor real).
// Mude só aqui — não precisa caçar em 15 arquivos.
//
// Os textos e paytables agora calculam o multiplicador EFETIVO
// (base × este boost) em vez de mostrar o número fixo do paytable.
// Então, com boost 1.3, o Dragão passa a exibir "×130" e pagar
// R$130,00 numa aposta de R$1 — informação sempre batendo com o
// valor pago, seja qual for o boost escolhido aqui.
// ═══════════════════════════════════════════════════════════════
export const TEST_MODE_PAYOUT_BOOST = 1.0;

export const GAMES=[
  {id:"slot",      emoji:"🐉🐉🐉",name:"Dragão da Sorte",        desc:"🔥 é Wild e substitui qualquer símbolo. 🐉 Dragão oculto vale ×100! Boa sorte!",                  rtp:"~94%",  tag:"CLÁSSICO",   color:"#f5c842",glow:"rgba(245,200,66,.4)",hasStreakBonus:true},
  {id:"crash",     emoji:"✈️", name:"Crash Avião",       desc:"O multiplicador sobe até crashar. ~52% crasham antes de 2×. Saque na hora certa!",               rtp:"95%",   tag:"AO VIVO",    color:"#00e5b0",glow:"rgba(0,229,176,.4)"},
  {id:"mina",      emoji:"💣",name:"Mina de Tesouro",   desc:"3 bombas em 25 blocos. Cada tesouro aumenta o multiplicador. Saque antes de explodir!",           rtp:"95%",   tag:"ESTRATÉGIA", color:"#ff8c42",glow:"rgba(255,140,66,.4)"},
  {id:"roleta",    emoji:"🎡",name:"Roleta Neon",        desc:"Vermelho e Preto: ×2 (18/37 cada). Dourado: ×6 (1/37). Ponteiro fixo à direita — gire e torça!",  rtp:"94.6%", tag:"SORTE",      color:"#ff3d5a",glow:"rgba(255,61,90,.4)"},
  {id:"dados",     emoji:"🎲",name:"Dados da Sorte",    desc:"Role 1 a 100. Fácil ≤50: ×1.90 | Médio ≤35: ×2.71 | Difícil ≤25: ×3.80. Escolha o risco!",       rtp:"95%",   tag:"RISCO",      color:"#4da6ff",glow:"rgba(77,166,255,.4)",hasStreakBonus:true},
  {id:"duelo",     emoji:"🃏",name:"Duelo Supremo",     desc:"Carta base aparece. Aposte Maior ou Menor. Acerto: ×1.92 | Empate: perde aposta.",                 rtp:"~92%",  tag:"CARTAS",     color:"#c264ff",glow:"rgba(194,100,255,.5)",hasStreakBonus:true},
  {id:"torre",     emoji:"🗼",name:"Torre dos Campeões", desc:"Suba andares escolhendo a célula segura (1 bomba por andar). Multiplicador cresce!",              rtp:"93%",   tag:"ESCALAR",    color:"#f5c842",glow:"rgba(245,200,66,.4)"},
  {id:"blackjack", emoji:"♠️",name:"Blackjack Elite",   desc:"Chegue a 21 sem estourar! Ás: 1 ou 11. Blackjack natural = ×2.15! Dobrar disponível.",             rtp:"<95%",tag:"FAVORITO",   color:"#2dde98",glow:"rgba(45,222,152,.4)"},
  {id:"keno",      emoji:"🌌",name:"Keno Galáctico",    desc:"Escolha 5 números de 1 a 40. 20 são sorteados. 3 acertos: ×0.8 | 4: ×1.5 | 5: ×4!",              rtp:"~80%",  tag:"LOTERIA",    color:"#4da6ff",glow:"rgba(77,166,255,.4)"},
  {id:"plinko",    emoji:"🔵",name:"Plinko Neon",       desc:"Solte a bola e deixe a física decidir! 8 fileiras de pinos, 9 buckets — prêmios maiores nas bordas.", rtp:"~96%",  tag:"FÍSICA",     color:"#00e5b0",glow:"rgba(0,229,176,.4)"},
  {id:"moeda",      emoji:"🪙",name:"Cara ou Coroa",       desc:"Escolha cara ou coroa. Acerto: ×1.82. O jogo mais rápido da casa!",                               rtp:"91%",   tag:"RÁPIDO",     color:"#f5c842",glow:"rgba(245,200,66,.4)",hasStreakBonus:true},
  {id:"raspadinha", emoji:"🎫",name:"Raspadinha Clássica",  desc:"Raspe os 9 quadrados. 2 iguais paga ×3, 3 iguais paga ×30!",                                      rtp:"90%",   tag:"CLÁSSICO",   color:"#c264ff",glow:"rgba(194,100,255,.4)"},
  {id:"numero",     emoji:"🔢",name:"Sorte Numérica",      desc:"1 a 100. Baixo/Alto (1-49 ou 52-100): ×1.85. Número exato: ×85! 50 e 51 ficam com a casa.",       rtp:"85-91%",tag:"NÚMEROS",    color:"#ff3d5a",glow:"rgba(255,61,90,.4)"},
  {id:"baccarat",   emoji:"♠️",name:"Baccarat Real",       desc:"Jogador vs Banca, quem chega mais perto de 9 ganha. Player/Banker: ×2.02 | Empate: ×9.",         rtp:"89-91%",tag:"CARTAS",     color:"#2dde98",glow:"rgba(45,222,152,.4)"},
  {id:"torremini",  emoji:"🗼",name:"Torre Mini",          desc:"Versão rápida da Torre — só 4 andares! Suba ou saque, multiplicador cresce a cada passo.",        rtp:"90%",   tag:"RÁPIDO",     color:"#4da6ff",glow:"rgba(77,166,255,.4)"},
  {id:"turfe",      emoji:"🐎",name:"Turfe Relâmpago",      desc:"Escolha 1 de 5 cavalos e torça na corrida! Zebra é azarão e paga até ×11,63. Ação rápida!",        rtp:"~93%",  tag:"CORRIDA",    color:"#ff8c42",glow:"rgba(255,140,66,.4)",hasStreakBonus:true},
  {id:"bau",        emoji:"🎁",name:"Baú Misterioso",       desc:"9 baús no tabuleiro — escolha um e descubra o prêmio! Pode pagar até ×21. Sorte pura!",           rtp:"91%",   tag:"MISTÉRIO",   color:"#c264ff",glow:"rgba(194,100,255,.4)"},
  {id:"sobedesce",  emoji:"🎴",name:"Sobe ou Desce Contínuo",desc:"Acerte se a próxima carta sobe ou desce e o multiplicador acumula. Saque quando quiser!",        rtp:"~92%",  tag:"SEQUÊNCIA",  color:"#00e5b0",glow:"rgba(0,229,176,.4)"},
  {id:"pesca",      emoji:"🎣",name:"Pesca da Fortuna",     desc:"Lance a linha e veja o que fisga! De uma bota velha a um prêmio de ×20. Sempre uma surpresa.",     rtp:"~91%",  tag:"PESCA",      color:"#4da6ff",glow:"rgba(77,166,255,.4)"},
  {id:"roda",       emoji:"🍀",name:"Roda da Sorte",        desc:"Gire a roda e torça pelo setor dourado! 12 setores, prêmios de ×0,3 até ×25. Vicia rápido!",       rtp:"~92%",  tag:"RODA",       color:"#f5c842",glow:"rgba(245,200,66,.4)"},
  {id:"bingo",      emoji:"🔴",name:"Bingo Relâmpago",      desc:"Escolha 5 números de 1 a 50, 20 são sorteados. 3 acertos paga ×1,5 | 4: ×3,75 | 5: ×40!",          rtp:"~90%",  tag:"BINGO",      color:"#2dde98",glow:"rgba(45,222,152,.4)"},
];

// Lista de jogos exibidos na tela inicial. Por padrão, todos os jogos de GAMES,
// exceto o Crash Avião, que foi desativado (conflito de arquitetura de segurança
// no servidor). Ele continua em GAMES pra não quebrar histórico/rotas antigas.
// O contador "X Jogos Exclusivos" no header/home é automático: sempre reflete
// o tamanho real de VISIBLE_GAMES — não precisa atualizar nenhum número à mão.
export const VISIBLE_GAMES = GAMES.filter(g => g.id !== "crash");

export function createState(){return{saldo:INI,betIdx:4,rounds:0,wins:0,losses:0,best:0,totalWon:0,dragons:0,streak:0};}

// Shared by DueloGame and BJGame (both are card games)
export const SU=["♠","♥","♦","♣"];export const RK=["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

