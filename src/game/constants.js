export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export const fmt=v=>"R$ "+Math.abs(+v).toFixed(2).replace(".",",");
export const INI=100;
export const BETS=[0.25,0.5,1,2,5,10,20];

export const GAMES=[
  {id:"slot",      emoji:"🎰",name:"Dragão da Sorte",        desc:"🔥 é Wild e substitui qualquer símbolo. 🐉 Dragão oculto vale ×100! Boa sorte!",                  rtp:"~94%",  tag:"CLÁSSICO",   color:"#f5c842",glow:"rgba(245,200,66,.4)",hasStreakBonus:true},
  {id:"crash",     emoji:"✈️", name:"Crash Avião",       desc:"O multiplicador sobe até crashar. ~52% crasham antes de 2×. Saque na hora certa!",               rtp:"95%",   tag:"AO VIVO",    color:"#00e5b0",glow:"rgba(0,229,176,.4)",hidden:true},
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
];

// Jogos visíveis na vitrine (lobby, grid "todos os jogos", contagem no header).
// Um jogo com hidden:true continua existindo no código e acessível por rota direta
// não é removido do array GAMES para não quebrar os índices usados internamente
// (GAMES[0], GAMES[1]...) — só some das listagens.
export const VISIBLE_GAMES = GAMES.filter(g => !g.hidden);

export function createState(){return{saldo:INI,betIdx:4,rounds:0,wins:0,losses:0,best:0,totalWon:0,dragons:0,streak:0};}

// Shared by DueloGame and BJGame (both are card games)
export const SU=["♠","♥","♦","♣"];export const RK=["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

