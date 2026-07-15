import { useState, useRef } from "react";
import { activateAudio, sWin, sLoss, sCard } from "../../game/audio";
import { rnd, shuffle } from "../../game/rng";
import { fmt, BETS, GAMES } from "../../game/constants";
import { supabase, hasSupabase } from "../../lib/supabase";
import { GameLayout } from "../shared/GameLayout";
import { WinMsg } from "../shared/WinMsg";
import { BetRow } from "../shared/BetControls";

const SYM=["🍒","🍋","💎","⭐","🍇"];

// Monta os 9 símbolos da grade combinando com o tier sorteado no servidor:
// tier 1 = nada bate, tier 2 = 2 iguais, tier 3 = 3 iguais (jackpot)
function buildGrid(tier){
  const main=SYM[Math.floor(rnd()*SYM.length)];
  const others=SYM.filter(s=>s!==main);
  const count = tier===3?3 : tier===2?2 : (rnd()<0.5?0:1); // tier 1: 0 ou 1 igual, nunca 2+
  const grid=[];
  for(let i=0;i<count;i++) grid.push(main);
  while(grid.length<9){
    const filler=others[Math.floor(rnd()*others.length)];
    grid.push(filler);
  }
  return shuffle(grid);
}

// ═══ RASPADINHA CLÁSSICA — RTP 90% (edge 10%) ═══════════════════
export function RaspadinhaGame({G,setG,history,addHistory,user,demoMode}){
  const[grid,setGrid]=useState(Array(9).fill(null));
  const[busy,setBusy]=useState(false);
  const busyR=useRef(false);
  const[msg,setMsg]=useState("");const[mT,setMT]=useState("");
  const[lastResult,setLastResult]=useState({prize:0,bet:0});

  async function play(){
    if(busyR.current)return;
    busyR.current=true;
    try{
    activateAudio();const bet=BETS[G.betIdx];if(G.saldo<bet){setMsg("❌ Saldo insuficiente!");setMT("loss");return;}
    setBusy(true);setMsg("");setMT("");
    const useServer = hasSupabase && user && !demoMode;

    let tier,mult,prize=0,win,newBalance=null;

    if(useServer){
      const { data, error } = await supabase.rpc('play_raspadinha', { p_user_id: user.id, p_bet: bet });
      if(error || !data || !data[0]){
        console.error('[play_raspadinha]', error);
        setMsg("⚠️ Erro ao processar. Tente novamente.");setMT("loss");setBusy(false);return;
      }
      const res=data[0];
      tier=res.tier; mult=Number(res.mult); prize=Number(res.prize); win=mult>0; newBalance=Number(res.new_balance);
    }else{
      setG(p=>({...p,saldo:p.saldo-bet}));
      const r=rnd()*1000;tier=r<880?1:r<980?2:3;
      const mults=[0,3,30];mult=mults[tier-1];win=mult>0;
      if(win) prize=+(bet*mult).toFixed(2);
    }

    const g=buildGrid(tier);
    setGrid(Array(9).fill(null));
    sCard();

    for(let i=0;i<9;i++){
      await new Promise(r=>setTimeout(r,140));
      setGrid(p=>{const n=[...p];n[i]=g[i];return n;});
    }
    await new Promise(r=>setTimeout(r,200));

    if(useServer) setG(p=>({...p,saldo:newBalance}));
    if(win){
      setLastResult({prize,bet});sWin();
      if(!useServer) setG(p=>({...p,saldo:p.saldo+prize,wins:p.wins+1,totalWon:p.totalWon+prize,streak:p.streak+1,rounds:p.rounds+1,best:Math.max(p.best,prize)}));
      setMsg(`🎉 Raspou e ganhou! +${fmt(prize)} (×${mult})`);setMT("win");
      if(!useServer) addHistory({txt:`🎫 Raspadinha ×${mult} +${fmt(prize)}`,type:"win"},{gameId:'raspadinha',bet,result:prize,won:true});
    }else{
      sLoss();
      if(!useServer) setG(p=>({...p,losses:p.losses+1,streak:0,rounds:p.rounds+1}));
      setMsg(`😔 Não dessa vez. −${fmt(bet)}`);setMT("loss");
      if(!useServer) addHistory({txt:`🎫 Raspadinha −${fmt(bet)}`,type:""},{gameId:'raspadinha',bet,result:0,won:false});
    }
    setBusy(false);
  
    }finally{busyR.current=false;}
  }

  return <GameLayout game={GAMES.find(g=>g.id==='raspadinha')} G={G} setG={setG} history={history}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,maxWidth:260,margin:"0 auto",padding:"16px 0"}}>
      {grid.map((s,i)=><div key={i} style={{aspectRatio:"1",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,background:s?"rgba(245,200,66,.1)":"rgba(12,18,38,.9)",border:`1px solid ${s?"rgba(245,200,66,.35)":"rgba(255,200,80,.1)"}`,transition:"background .2s"}}>{s||"❓"}</div>)}
    </div>
    <WinMsg msg={msg} type={mT} prize={lastResult.prize} bet={lastResult.bet}/>
    <BetRow G={G} setG={setG} onAction={play} label="🎫 RASPAR" disabled={busy}/>
  </GameLayout>;
}
