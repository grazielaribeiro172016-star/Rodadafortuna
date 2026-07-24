import { useState, useRef } from "react";
import { activateAudio, sWin, sLoss, sCard } from "../../game/audio";
import { rnd } from "../../game/rng";
import { fmt, BETS, GAMES } from "../../game/constants";
import { supabase, hasSupabase } from "../../lib/supabase";
import { GameLayout } from "../shared/GameLayout";
import { WinMsg } from "../shared/WinMsg";
import { BetRow } from "../shared/BetControls";

// Ordem dos setores na roda (visual) — cada um mapeado ao seu multiplicador real
const SETORES=[
  {mult:0,   cor:"#2a1520"},
  {mult:0.3, cor:"#3a2a10"},
  {mult:0.8, cor:"#2a1520"},
  {mult:1.2, cor:"#1a3a2a"},
  {mult:0,   cor:"#2a1520"},
  {mult:2.5, cor:"#3a2a10"},
  {mult:0.3, cor:"#2a1520"},
  {mult:6,   cor:"#1a3a2a"},
  {mult:0,   cor:"#2a1520"},
  {mult:0.8, cor:"#3a2a10"},
  {mult:1.2, cor:"#2a1520"},
  {mult:25,  cor:"#f5c842"},
];
const SLICE=360/SETORES.length;
const gradient=SETORES.map((s,i)=>`${s.cor} ${i*SLICE}deg ${(i+1)*SLICE}deg`).join(",");

function pickIndexForMult(m){
  const idxs=SETORES.map((s,i)=>s.mult===m?i:-1).filter(i=>i>=0);
  return idxs[Math.floor(rnd()*idxs.length)];
}

// ═══ RODA DA SORTE — RTP ~92% ═════════════════════════════════
export function RodaGame({G,setG,history,addHistory,user,demoMode}){
  const[busy,setBusy]=useState(false);
  const busyR=useRef(false);
  const[rotation,setRotation]=useState(0);
  const[mult,setMult]=useState(null);
  const[msg,setMsg]=useState("");const[mT,setMT]=useState("");
  const[lastResult,setLastResult]=useState({prize:0,bet:0});

  async function play(){
    if(busyR.current)return;
    busyR.current=true;
    try{
    activateAudio();const bet=BETS[G.betIdx];if(G.saldo<bet){setMsg("❌ Saldo insuficiente!");setMT("loss");busyR.current=false;return;}
    setBusy(true);setMult(null);setMsg("");setMT("");sCard();
    const useServer = hasSupabase && user && !demoMode;

    let resultMult,win,prize=0,newBalance=null;

    if(useServer){
      const { data, error } = await supabase.rpc('play_roda', { p_user_id: user.id, p_bet: bet });
      if(error || !data || !data[0]){
        console.error('[play_roda]', error);
        setMsg("⚠️ Erro ao processar. Tente novamente.");setMT("loss");setBusy(false);busyR.current=false;return;
      }
      const res=data[0];
      resultMult=Number(res.multiplicador); win=res.won; prize=Number(res.prize); newBalance=Number(res.new_balance);
    }else{
      setG(p=>({...p,saldo:p.saldo-bet}));
      const roll=rnd();
      resultMult = roll<0.40?0 : roll<0.62?0.3 : roll<0.78?0.8 : roll<0.90?1.2 : roll<0.96?2.5 : roll<0.99?6 : 25;
      win=resultMult>0;
      if(win)prize=+(bet*resultMult).toFixed(2);
    }

    // gira a roda visualmente até um setor que tenha o multiplicador sorteado
    const idx=pickIndexForMult(resultMult);
    const targetAngle=360*4 + (360 - (idx*SLICE + SLICE/2)); // várias voltas + para o setor certo
    setRotation(r=>r - (r%360) + targetAngle);

    await new Promise(r=>setTimeout(r,2200)); // tempo do giro
    setMult(resultMult);

    if(useServer) setG(p=>({...p,saldo:newBalance}));
    if(win){
      setLastResult({prize,bet});sWin();
      if(!useServer) setG(p=>({...p,saldo:p.saldo+prize,wins:p.wins+1,totalWon:p.totalWon+prize,rounds:p.rounds+1,best:Math.max(p.best,prize)}));
      setMsg(`🎡 Caiu em ×${resultMult}! +${fmt(prize)}`);setMT("win");
      if(!useServer) addHistory({txt:`🎡 Roda ×${resultMult} +${fmt(prize)}`,type:"win"},{gameId:'roda',bet,result:prize,won:true});
    }else{
      sLoss();
      if(!useServer) setG(p=>({...p,losses:p.losses+1,rounds:p.rounds+1}));
      setMsg(`😔 Caiu em ×0. −${fmt(bet)}`);setMT("loss");
      if(!useServer) addHistory({txt:`🎡 Roda ×0 −${fmt(bet)}`,type:""},{gameId:'roda',bet,result:0,won:false});
    }
    setBusy(false);

    }finally{busyR.current=false;}
  }

  return <GameLayout game={GAMES.find(g=>g.id==='roda')} G={G} setG={setG} history={history}>
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14,padding:"14px 0",position:"relative"}}>
      <div style={{position:"absolute",top:-2,fontSize:26,zIndex:2,filter:"drop-shadow(0 2px 4px rgba(0,0,0,.5))"}}>🔻</div>
      <div style={{width:220,height:220,borderRadius:"50%",background:`conic-gradient(${gradient})`,border:"5px solid #f5c842",boxShadow:"0 6px 30px rgba(245,200,66,.3)",transition:"transform 2.2s cubic-bezier(.17,.67,.2,1)",transform:`rotate(${rotation}deg)`}}/>
      {mult!==null&&<div className="cn" style={{fontSize:24,fontWeight:800,color:mult>0?"#00e5b0":"#ff3d5a"}}>×{mult}</div>}
    </div>
    <WinMsg msg={msg} type={mT} prize={lastResult.prize} bet={lastResult.bet}/>
    <BetRow G={G} setG={setG} onAction={play} label="🎡 GIRAR A RODA" disabled={busy}/>
  </GameLayout>;
}
