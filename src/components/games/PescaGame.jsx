import { useState, useRef } from "react";
import { activateAudio, sWin, sLoss, sCard } from "../../game/audio";
import { rnd } from "../../game/rng";
import { fmt, BETS, GAMES } from "../../game/constants";
import { supabase, hasSupabase } from "../../lib/supabase";
import { GameLayout } from "../shared/GameLayout";
import { WinMsg } from "../shared/WinMsg";
import { BetRow } from "../shared/BetControls";

const PEIXES=["🐟","🐠","🐡","🦐","🐙","🦑"];

function sortMult(){
  const roll=rnd();
  return roll<0.50?0 : roll<0.72?0.4 : roll<0.86?1 : roll<0.94?2 : roll<0.985?5 : 20;
}

// ═══ PESCA DA FORTUNA — RTP ~91% ═════════════════════════════
// Resultado decidido no servidor antes de qualquer resposta.
export function PescaGame({G,setG,history,addHistory,user,demoMode}){
  const[busy,setBusy]=useState(false);
  const busyR=useRef(false);
  const[peixe,setPeixe]=useState("🎣");
  const[mult,setMult]=useState(null);
  const[msg,setMsg]=useState("");const[mT,setMT]=useState("");
  const[lastResult,setLastResult]=useState({prize:0,bet:0});

  async function play(){
    if(busyR.current)return;
    busyR.current=true;
    try{
    activateAudio();const bet=BETS[G.betIdx];if(G.saldo<bet){setMsg("❌ Saldo insuficiente!");setMT("loss");busyR.current=false;return;}
    setBusy(true);setMult(null);setMsg("");setMT("");setPeixe("〰️");sCard();
    const useServer = hasSupabase && user && !demoMode;

    let resultMult,win,prize=0,newBalance=null;

    if(useServer){
      const { data, error } = await supabase.rpc('play_pesca', { p_user_id: user.id, p_bet: bet });
      if(error || !data || !data[0]){
        console.error('[play_pesca]', error);
        setMsg("⚠️ Erro ao processar. Tente novamente.");setMT("loss");setBusy(false);busyR.current=false;return;
      }
      const res=data[0];
      resultMult=Number(res.multiplicador); win=res.won; prize=Number(res.prize); newBalance=Number(res.new_balance);
    }else{
      setG(p=>({...p,saldo:p.saldo-bet}));
      resultMult=sortMult(); win=resultMult>0;
      if(win)prize=+(bet*resultMult).toFixed(2);
    }

    await new Promise(r=>setTimeout(r,700)); // tempo da animação de puxar a linha
    setMult(resultMult);
    setPeixe(win?PEIXES[Math.floor(rnd()*PEIXES.length)]:"🥾"); // bota velha na derrota

    if(useServer) setG(p=>({...p,saldo:newBalance}));
    if(win){
      setLastResult({prize,bet});sWin();
      if(!useServer) setG(p=>({...p,saldo:p.saldo+prize,wins:p.wins+1,totalWon:p.totalWon+prize,rounds:p.rounds+1,best:Math.max(p.best,prize)}));
      setMsg(`🎣 Pescou! ×${resultMult} — +${fmt(prize)}`);setMT("win");
      if(!useServer) addHistory({txt:`🎣 Pesca ×${resultMult} +${fmt(prize)}`,type:"win"},{gameId:'pesca',bet,result:prize,won:true});
    }else{
      sLoss();
      if(!useServer) setG(p=>({...p,losses:p.losses+1,rounds:p.rounds+1}));
      setMsg(`😔 Só pescou uma bota velha. −${fmt(bet)}`);setMT("loss");
      if(!useServer) addHistory({txt:`🎣 Pesca vazia −${fmt(bet)}`,type:""},{gameId:'pesca',bet,result:0,won:false});
    }
    setBusy(false);

    }finally{busyR.current=false;}
  }

  return <GameLayout game={GAMES.find(g=>g.id==='pesca')} G={G} setG={setG} history={history}>
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12,padding:"20px 0"}}>
      <div style={{width:120,height:120,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:56,background:"radial-gradient(circle at 35% 30%,#4da6ff,#2277dd 70%)",boxShadow:"0 6px 24px rgba(77,166,255,.4)",border:"3px solid #2277dd"}}>
        {peixe}
      </div>
      {mult!==null&&<div className="cn" style={{fontSize:20,fontWeight:800,color:mult>0?"#00e5b0":"#ff3d5a"}}>×{mult}</div>}
    </div>
    <WinMsg msg={msg} type={mT} prize={lastResult.prize} bet={lastResult.bet}/>
    <BetRow G={G} setG={setG} onAction={play} label="🎣 LANÇAR A LINHA" disabled={busy}/>
  </GameLayout>;
}
