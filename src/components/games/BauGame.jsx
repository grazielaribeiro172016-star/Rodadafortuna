import { useState, useRef } from "react";
import { activateAudio, sWin, sLoss, sCard } from "../../game/audio";
import { rnd } from "../../game/rng";
import { fmt, BETS, GAMES } from "../../game/constants";
import { supabase, hasSupabase } from "../../lib/supabase";
import { GameLayout } from "../shared/GameLayout";
import { WinMsg } from "../shared/WinMsg";
import { BetRow } from "../shared/BetControls";

const N_BAUS = 9;

function sortMult(){
  const roll=rnd();
  return roll<0.50?0 : roll<0.70?0.5 : roll<0.82?1 : roll<0.90?1.5 : roll<0.96?3 : roll<0.99?6 : 21;
}

// ═══ BAÚ MISTERIOSO — RTP 91% ════════════════════════════════
// Todos os baús têm a mesma distribuição de prêmio — qual baú o
// jogador clica é só estética. Resultado decidido no servidor
// antes de qualquer resposta voltar pro cliente.
export function BauGame({G,setG,history,addHistory,user,demoMode}){
  const[busy,setBusy]=useState(false);
  const busyR=useRef(false);
  const[aberto,setAberto]=useState(null); // índice do baú clicado
  const[mult,setMult]=useState(null);
  const[msg,setMsg]=useState("");const[mT,setMT]=useState("");
  const[lastResult,setLastResult]=useState({prize:0,bet:0});

  async function play(i){
    if(busyR.current||busy)return;
    busyR.current=true;
    try{
    activateAudio();const bet=BETS[G.betIdx];if(G.saldo<bet){setMsg("❌ Saldo insuficiente!");setMT("loss");busyR.current=false;return;}
    setBusy(true);setAberto(i);setMult(null);setMsg("");setMT("");sCard();
    const useServer = hasSupabase && user && !demoMode;

    let resultMult,win,prize=0,newBalance=null;

    if(useServer){
      const { data, error } = await supabase.rpc('play_bau', { p_user_id: user.id, p_bet: bet, p_bau_escolhido: i });
      if(error || !data || !data[0]){
        console.error('[play_bau]', error);
        setMsg("⚠️ Erro ao processar. Tente novamente.");setMT("loss");setBusy(false);setAberto(null);busyR.current=false;return;
      }
      const res=data[0];
      resultMult=Number(res.multiplicador); win=res.won; prize=Number(res.prize); newBalance=Number(res.new_balance);
    }else{
      setG(p=>({...p,saldo:p.saldo-bet}));
      resultMult=sortMult(); win=resultMult>0;
      if(win)prize=+(bet*resultMult).toFixed(2);
    }

    await new Promise(r=>setTimeout(r,600)); // tempo da animação de abrir o baú
    setMult(resultMult);

    if(useServer) setG(p=>({...p,saldo:newBalance}));
    if(win){
      setLastResult({prize,bet});sWin();
      if(!useServer) setG(p=>({...p,saldo:p.saldo+prize,wins:p.wins+1,totalWon:p.totalWon+prize,rounds:p.rounds+1,best:Math.max(p.best,prize)}));
      setMsg(`🎁 Baú ${i+1}: ×${resultMult}! +${fmt(prize)}`);setMT("win");
      if(!useServer) addHistory({txt:`🎁 Baú ×${resultMult} +${fmt(prize)}`,type:"win"},{gameId:'bau',bet,result:prize,won:true});
    }else{
      sLoss();
      if(!useServer) setG(p=>({...p,losses:p.losses+1,rounds:p.rounds+1}));
      setMsg(`😔 Baú ${i+1} veio vazio. −${fmt(bet)}`);setMT("loss");
      if(!useServer) addHistory({txt:`🎁 Baú vazio −${fmt(bet)}`,type:""},{gameId:'bau',bet,result:0,won:false});
    }
    setBusy(false);

    }finally{busyR.current=false;}
  }

  return <GameLayout game={GAMES.find(g=>g.id==='bau')} G={G} setG={setG} history={history}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,padding:"12px 0"}}>
      {Array.from({length:N_BAUS},(_,i)=>{
        const isThis=aberto===i;
        const revealed=isThis&&mult!==null;
        return <button key={i} onClick={()=>play(i)} disabled={busy} className="btn-press" style={{aspectRatio:"1",borderRadius:12,border:`2px solid ${revealed?(mult>0?"rgba(0,229,176,.5)":"rgba(255,61,90,.4)"):"rgba(255,200,80,.15)"}`,background:revealed?(mult>0?"rgba(0,229,176,.1)":"rgba(255,61,90,.08)"):"rgba(12,18,38,.8)",fontSize:32,cursor:busy?"not-allowed":"pointer",opacity:busy&&!isThis?.4:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
          {isThis&&busy&&mult===null?"✨":revealed?(mult>0?"💰":"📭"):"🎁"}
          {revealed&&<span style={{fontSize:13,fontWeight:700,color:mult>0?"#00e5b0":"#ff3d5a"}}>×{mult}</span>}
        </button>;
      })}
    </div>
    <WinMsg msg={msg} type={mT} prize={lastResult.prize} bet={lastResult.bet}/>
    <div style={{textAlign:"center",fontSize:13,color:"#6a7a9a"}}>Escolha um baú pra abrir</div>
    <BetRow G={G} setG={setG} disabled={busy}/>
  </GameLayout>;
}
