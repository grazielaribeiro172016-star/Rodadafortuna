import { useState, useRef } from "react";
import { activateAudio, sWin, sLoss, sCard } from "../../game/audio";
import { rnd } from "../../game/rng";
import { fmt, BETS, GAMES } from "../../game/constants";
import { supabase, hasSupabase } from "../../lib/supabase";
import { GameLayout } from "../shared/GameLayout";
import { WinMsg } from "../shared/WinMsg";
import { BetRow } from "../shared/BetControls";

const CAVALOS = [
  { emoji: "🐎", nome: "Relâmpago", mult: 2.66 },
  { emoji: "🐴", nome: "Trovão",    mult: 3.72 },
  { emoji: "🐎", nome: "Sombra",    mult: 4.65 },
  { emoji: "🐴", nome: "Fantasma",  mult: 7.75 },
  { emoji: "🐎", nome: "Zebra",     mult: 11.63 },
];

// ═══ TURFE RELÂMPAGO — RTP ~93% ══════════════════════════════
// Resultado 100% decidido no servidor antes da corrida começar.
// A animação é só visual — não é possível cancelar/sacar no meio.
export function TurfeGame({G,setG,history,addHistory,user,demoMode}){
  const[pk,setPk]=useState(0);const[running,setRunning]=useState(false);const[busy,setBusy]=useState(false);
  const busyR=useRef(false);
  const[vencedor,setVencedor]=useState(null);
  const[msg,setMsg]=useState("");const[mT,setMT]=useState("");
  const[lastResult,setLastResult]=useState({prize:0,bet:0});
  const streakBonus=G.streak>=5;

  async function play(){
    if(busyR.current)return;
    busyR.current=true;
    try{
    activateAudio();const bet=BETS[G.betIdx];if(G.saldo<bet){setMsg("❌ Saldo insuficiente!");setMT("loss");busyR.current=false;return;}
    setBusy(true);setRunning(true);setMsg("");setMT("");setVencedor(null);sCard();
    const useServer = hasSupabase && user && !demoMode;

    let winnerIdx,win,prize=0,newBalance=null;

    if(useServer){
      const { data, error } = await supabase.rpc('play_turfe', { p_user_id: user.id, p_bet: bet, p_cavalo: pk });
      if(error || !data || !data[0]){
        console.error('[play_turfe]', error);
        setMsg("⚠️ Erro ao processar. Tente novamente.");setMT("loss");setBusy(false);setRunning(false);busyR.current=false;return;
      }
      const res=data[0];
      winnerIdx=res.vencedor; win=res.won; prize=Number(res.prize); newBalance=Number(res.new_balance);
    }else{
      setG(p=>({...p,saldo:p.saldo-bet}));
      const roll=rnd();
      winnerIdx = roll<0.35?0 : roll<0.60?1 : roll<0.80?2 : roll<0.92?3 : 4;
      win = winnerIdx===pk;
      if(win){const sb=streakBonus?.1:0;prize=+(bet*CAVALOS[pk].mult*(1+sb)).toFixed(2);}
    }

    await new Promise(r=>setTimeout(r,1400)); // tempo da animação da corrida
    setVencedor(winnerIdx);setRunning(false);

    if(useServer) setG(p=>({...p,saldo:newBalance}));
    if(win){
      setLastResult({prize,bet});sWin();
      if(!useServer) setG(p=>({...p,saldo:p.saldo+prize,wins:p.wins+1,totalWon:p.totalWon+prize,streak:p.streak+1,rounds:p.rounds+1,best:Math.max(p.best,prize)}));
      setMsg(`🏆 ${CAVALOS[winnerIdx].nome} venceu! +${fmt(prize)} (×${CAVALOS[winnerIdx].mult})`);setMT("win");
      if(!useServer) addHistory({txt:`🐎 Turfe ${CAVALOS[winnerIdx].nome} +${fmt(prize)}`,type:"win"},{gameId:'turfe',bet,result:prize,won:true});
    }else{
      sLoss();
      if(!useServer) setG(p=>({...p,losses:p.losses+1,streak:0,rounds:p.rounds+1}));
      setMsg(`😔 ${CAVALOS[winnerIdx].nome} venceu. Você apostou em ${CAVALOS[pk].nome}. −${fmt(bet)}`);setMT("loss");
      if(!useServer) addHistory({txt:`🐎 Turfe ${CAVALOS[winnerIdx].nome} −${fmt(bet)}`,type:""},{gameId:'turfe',bet,result:0,won:false});
    }
    setBusy(false);

    }finally{busyR.current=false;}
  }

  return <GameLayout game={GAMES.find(g=>g.id==='turfe')} G={G} setG={setG} history={history}>
    <div style={{display:"flex",flexDirection:"column",gap:8,padding:"12px 0"}}>
      {CAVALOS.map((c,i)=>
        <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 10px",borderRadius:10,border:`1px solid ${vencedor===i?"rgba(245,200,66,.5)":"rgba(255,200,80,.08)"}`,background:vencedor===i?"rgba(245,200,66,.08)":"transparent",transition:"all .3s"}}>
          <div style={{width:30,fontSize:22,transform:running?`translateX(${Math.sin(Date.now()/150+i)*4}px)`:"none"}}>{c.emoji}</div>
          <div style={{flex:1,fontSize:15,color:vencedor===i?"#f5c842":"#8a96aa",fontWeight:vencedor===i?700:500}}>{c.nome}</div>
          <div className="cn" style={{fontSize:14,color:"#00e5b0",fontWeight:700}}>×{c.mult}</div>
        </div>
      )}
    </div>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center"}}>
      {CAVALOS.map((c,i)=><button key={i} onClick={()=>setPk(i)} disabled={busy} className="btn-press" style={{padding:"8px 14px",borderRadius:10,border:`2px solid ${pk===i?"#f5c842":"rgba(255,200,80,.2)"}`,background:pk===i?"rgba(245,200,66,.12)":"transparent",color:pk===i?"#f5c842":"#6a7a9a",fontFamily:"'Rajdhani',sans-serif",fontSize:15,fontWeight:700,cursor:busy?"not-allowed":"pointer"}}>{c.emoji} {c.nome}</button>)}
    </div>
    {G.streak>0 && <div style={{textAlign:"center",fontSize:14,color:"#f5c842"}}>🔥 Sequência: {G.streak}{streakBonus?" — bônus ativo!":""}</div>}
    <WinMsg msg={msg} type={mT} prize={lastResult.prize} bet={lastResult.bet}/>
    <BetRow G={G} setG={setG} onAction={play} label="🐎 APOSTAR NA CORRIDA" disabled={busy}/>
  </GameLayout>;
}
