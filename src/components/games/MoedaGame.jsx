import { useState, useRef } from "react";
import { activateAudio, sWin, sLoss, sCard } from "../../game/audio";
import { rnd } from "../../game/rng";
import { fmt, BETS, GAMES } from "../../game/constants";
import { supabase, hasSupabase } from "../../lib/supabase";
import { GameLayout } from "../shared/GameLayout";
import { WinMsg } from "../shared/WinMsg";
import { BetRow } from "../shared/BetControls";

// ═══ CARA OU COROA — RTP 91% (edge 9%) ═══════════════════════
export function MoedaGame({G,setG,history,addHistory,user,demoMode}){
  const[pk,setPk]=useState("cara");const[flip,setFlip]=useState(false);const[busy,setBusy]=useState(false);
  const busyR=useRef(false);
  const[shown,setShown]=useState(null);
  const[msg,setMsg]=useState("");const[mT,setMT]=useState("");
  const[lastResult,setLastResult]=useState({prize:0,bet:0});
  const streakBonus=G.streak>=5;

  async function play(){
    if(busyR.current)return;
    busyR.current=true;
    try{
    activateAudio();const bet=BETS[G.betIdx];if(G.saldo<bet){setMsg("❌ Saldo insuficiente!");setMT("loss");return;}
    setBusy(true);setFlip(true);setMsg("");setMT("");sCard();
    const useServer = hasSupabase && user && !demoMode;

    let result,win,prize=0,newBalance=null;

    if(useServer){
      const { data, error } = await supabase.rpc('play_moeda', { p_user_id: user.id, p_bet: bet, p_pick: pk });
      if(error || !data || !data[0]){
        console.error('[play_moeda]', error);
        setMsg("⚠️ Erro ao processar. Tente novamente.");setMT("loss");setBusy(false);setFlip(false);return;
      }
      const res=data[0];
      result=res.result; win=res.won; prize=Number(res.prize); newBalance=Number(res.new_balance);
    }else{
      setG(p=>({...p,saldo:p.saldo-bet}));
      result=rnd()<0.5?"cara":"coroa"; win=result===pk;
      if(win){const sb=streakBonus?.1:0;prize=+(bet*1.82*(1+sb)).toFixed(2);}
    }

    await new Promise(r=>setTimeout(r,900)); // tempo da animação de giro
    setShown(result);setFlip(false);

    if(useServer) setG(p=>({...p,saldo:newBalance}));
    if(win){
      const multDisp=(prize/bet).toFixed(2);
      setLastResult({prize,bet});sWin();
      if(!useServer) setG(p=>({...p,saldo:p.saldo+prize,wins:p.wins+1,totalWon:p.totalWon+prize,streak:p.streak+1,rounds:p.rounds+1,best:Math.max(p.best,prize)}));
      setMsg(`🎉 Saiu ${result.toUpperCase()}! +${fmt(prize)} (×${multDisp})`);setMT("win");
      if(!useServer) addHistory({txt:`🪙 Moeda ${result} +${fmt(prize)}`,type:"win"},{gameId:'moeda',bet,result:prize,won:true});
    }else{
      sLoss();
      if(!useServer) setG(p=>({...p,losses:p.losses+1,streak:0,rounds:p.rounds+1}));
      setMsg(`😔 Saiu ${result.toUpperCase()}. Você apostou ${pk}. −${fmt(bet)}`);setMT("loss");
      if(!useServer) addHistory({txt:`🪙 Moeda ${result} −${fmt(bet)}`,type:""},{gameId:'moeda',bet,result:0,won:false});
    }
    setBusy(false);
  
    }finally{busyR.current=false;}
  }

  return <GameLayout game={GAMES.find(g=>g.id==='moeda')} G={G} setG={setG} history={history}>
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16,padding:"20px 0"}}>
      <div style={{width:120,height:120,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:56,background:"radial-gradient(circle at 35% 30%,#fff8dc,#f5c842 60%,#c9971f)",boxShadow:"0 6px 24px rgba(245,200,66,.4)",animation:flip?"coinFlip .3s linear infinite":"none",border:"3px solid #e8a020"}}>
        {flip?"🪙":shown==="cara"?"🦅":shown==="coroa"?"👑":"🪙"}
      </div>
      <style>{"@keyframes coinFlip{0%{transform:scaleX(1)}50%{transform:scaleX(.15)}100%{transform:scaleX(1)}}"}</style>
      <div style={{display:"flex",gap:8}}>
        {["cara","coroa"].map(p=><button key={p} onClick={()=>setPk(p)} disabled={busy} className="btn-press" style={{padding:"10px 24px",borderRadius:10,border:`2px solid ${pk===p?"#f5c842":"rgba(255,200,80,.2)"}`,background:pk===p?"rgba(245,200,66,.12)":"transparent",color:pk===p?"#f5c842":"#6a7a9a",fontFamily:"'Rajdhani',sans-serif",fontSize:17,fontWeight:700,cursor:busy?"not-allowed":"pointer"}}>{p==="cara"?"🦅 Cara":"👑 Coroa"}</button>)}
      </div>
      {G.streak>0 && <div style={{fontSize:14,color:"#f5c842"}}>🔥 Sequência: {G.streak}{streakBonus?" — bônus ativo!":""}</div>}
    </div>
    <WinMsg msg={msg} type={mT} prize={lastResult.prize} bet={lastResult.bet}/>
    <BetRow G={G} setG={setG} onAction={play} label="🪙 GIRAR MOEDA" disabled={busy}/>
  </GameLayout>;
}
