import { useState, useRef } from "react";
import { activateAudio, sBomb, sCash, sFloor } from "../../game/audio";
import { rnd } from "../../game/rng";
import { fmt, BETS, GAMES } from "../../game/constants";
import { GameLayout } from "../shared/GameLayout";
import { WinMsg } from "../shared/WinMsg";
import { supabase, hasSupabase } from "../../lib/supabase";
import { BetRow } from "../shared/BetControls";

const NOMES=["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
function label(n){return NOMES[n-1];}
function localStepMult(card,guess){
  const prob = guess==="sobe" ? (13-card)/13 : (card-1)/13;
  if(prob<=0)return null;
  return Math.min(+(0.92/prob).toFixed(4),8);
}

// ═══ SOBE OU DESCE CONTÍNUO — RTP-alvo 92% por passo ═════════
// Cada jogada é uma chamada isolada e fechada ao servidor — sem
// relógio, sem "sacar no meio do tick". Pode sacar depois de
// qualquer acerto, ou perder tudo se errar a próxima carta.
export function SobeDesceGame({G,setG,history,addHistory,user,demoMode}){
  const busyR=useRef(false);
  const[busy,setBusy]=useState(false);
  const[stuck,setStuck]=useState(false);
  const[round,setRound]=useState({active:false,card:1,mult:1,streak:0,bet:0,roundId:null});
  const[msg,setMsg]=useState("");const[mT,setMT]=useState("");
  const[lastResult,setLastResult]=useState({prize:0,bet:0});

  async function begin(){
    if(busyR.current)return;
    busyR.current=true;
    try{
    activateAudio();const bet=BETS[G.betIdx];if(G.saldo<bet){setMsg("❌ Saldo insuficiente!");setMT("loss");return;}
    const useServer = hasSupabase && user && !demoMode;
    setMsg("");setMT("");
    if(useServer){
      const { data, error } = await supabase.rpc('sobedesce_start', { p_user_id: user.id, p_bet: bet });
      if(error || !data || !data[0]){
        console.error('[sobedesce_start]',error);
        if(error?.message?.includes('em andamento')){setStuck(true);setMsg("⚠️ Rodada anterior travada detectada.");}
        else{setMsg("⚠️ Erro ao iniciar. Tente novamente.");}
        setMT("loss");return;
      }
      const r=data[0];
      setG(p=>({...p,saldo:p.saldo-bet}));
      setRound({active:true,card:r.card,mult:1,streak:0,bet,roundId:r.round_id});
      setMsg("🎴 Rodada iniciada — escolha Sobe ou Desce!");setMT("teal");
    }else{
      setG(p=>({...p,saldo:p.saldo-bet}));
      const c=Math.floor(rnd()*13)+1;
      setRound({active:true,card:c,mult:1,streak:0,bet,roundId:null});
      setMsg("🎴 Rodada iniciada — escolha Sobe ou Desce!");setMT("teal");
    }
    }finally{busyR.current=false;}
  }

  async function guess(dir){
    if(busyR.current||!round.active)return;
    busyR.current=true;
    try{
    const useServer = hasSupabase && user && !demoMode;

    if(useServer){
      const { data, error } = await supabase.rpc('sobedesce_step', { p_user_id: user.id, p_round_id: round.roundId, p_guess: dir });
      if(error || !data || !data[0]){console.error('[sobedesce_step]',error);setMsg("⚠️ Erro ao processar. Tente novamente.");setMT("loss");return;}
      const r=data[0];
      if(!r.correct){
        sBomb();
        setRound(p=>({...p,active:false,card:r.card}));
        setMsg(`❌ Saiu ${label(r.card)}. Errou! −${fmt(round.bet)}`);setMT("loss");
      }else{
        sFloor();
        if(r.finished){
          setLastResult({prize:r.prize,bet:round.bet});sCash();
          setG(p=>({...p,saldo:r.new_balance}));
          setRound(p=>({...p,active:false,card:r.card,mult:r.multiplier}));
          setMsg(`🏆 Limite de 10 acertos! Saque automático: +${fmt(r.prize)} (×${r.multiplier})`);setMT("win");
        }else{
          setRound(p=>({...p,card:r.card,mult:r.multiplier,streak:p.streak+1}));
          setMsg(`✅ Saiu ${label(r.card)}! ×${Number(r.multiplier).toFixed(2)} acumulado — suba ou saque!`);setMT("teal");
        }
      }
      return;
    }

    const stepMult=localStepMult(round.card,dir);
    const nextCard=Math.floor(rnd()*13)+1;
    const correct = dir==="sobe" ? nextCard>round.card : nextCard<round.card;
    if(!correct){
      sBomb();
      setRound(p=>({...p,active:false,card:nextCard}));
      setG(p=>({...p,losses:p.losses+1,streak:0,rounds:p.rounds+1}));
      setMsg(`❌ Saiu ${label(nextCard)}. Errou! −${fmt(round.bet)}`);setMT("loss");
      addHistory({txt:`🎴 Sobe/Desce errou −${fmt(round.bet)}`,type:""},{gameId:'sobedesce',bet:round.bet,result:0,won:false});
    }else{
      sFloor();
      const newMult=+(round.mult*stepMult).toFixed(4);
      setRound(p=>({...p,card:nextCard,mult:newMult,streak:p.streak+1}));
      setMsg(`✅ Saiu ${label(nextCard)}! ×${newMult.toFixed(2)} acumulado — suba ou saque!`);setMT("teal");
    }
    }finally{busyR.current=false;}
  }

  async function saque(){
    if(busyR.current||!round.active||round.streak===0)return;
    busyR.current=true;
    try{
    const useServer = hasSupabase && user && !demoMode;
    if(useServer){
      const { data, error } = await supabase.rpc('sobedesce_cashout', { p_user_id: user.id, p_round_id: round.roundId });
      if(error || !data || !data[0]){console.error('[sobedesce_cashout]',error);setMsg("⚠️ Erro ao sacar. Tente novamente.");setMT("loss");return;}
      const r=data[0];
      setLastResult({prize:r.prize,bet:round.bet});sCash();
      setG(p=>({...p,saldo:r.new_balance}));
      setRound(p=>({...p,active:false}));
      setMsg(`🏆 Sacou ×${round.mult.toFixed(2)} — +${fmt(r.prize)}!`);setMT("win");
      return;
    }
    const prize=+(round.bet*round.mult).toFixed(2);
    setLastResult({prize,bet:round.bet});sCash();
    setG(p=>({...p,saldo:p.saldo+prize,wins:p.wins+1,totalWon:p.totalWon+prize,streak:p.streak+1,rounds:p.rounds+1,best:Math.max(p.best,prize)}));
    setRound(p=>({...p,active:false}));
    setMsg(`🏆 Sacou ×${round.mult.toFixed(2)} — +${fmt(prize)}!`);setMT("win");
    addHistory({txt:`🎴 Sobe/Desce ×${round.mult.toFixed(2)} +${fmt(prize)}`,type:"win"},{gameId:'sobedesce',bet:round.bet,result:prize,won:true});
    }finally{busyR.current=false;}
  }

  async function unstick(){
    if(!user) return;
    setStuck(false);
    const { error } = await supabase.rpc('sobedesce_abandon', { p_user_id: user.id });
    if(error){console.error('[sobedesce_abandon]',error);setMsg("⚠️ Não consegui cancelar. Tente de novo em alguns segundos.");setMT("loss");return;}
    setMsg("🔓 Rodada travada cancelada — pode jogar de novo!");setMT("");
  }

  const cardDisplay = round.card ? label(round.card) : "🎴";

  return <GameLayout game={GAMES.find(g=>g.id==='sobedesce')} G={G} setG={setG} history={history}>
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12,padding:"14px 0"}}>
      <div style={{width:90,height:126,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,fontWeight:800,background:"linear-gradient(135deg,#fff8dc,#f5c842)",color:"#1a1408",boxShadow:"0 6px 24px rgba(245,200,66,.35)",border:"3px solid #e8a020"}}>
        {cardDisplay}
      </div>
      {round.active && round.streak>0 && <div className="cn" style={{fontSize:20,color:"#00e5b0",fontWeight:800}}>×{round.mult.toFixed(2)} acumulado</div>}
      {round.active && <div style={{display:"flex",gap:10}}>
        <button onClick={()=>guess("desce")} disabled={busy||round.card<=1} className="btn-press" style={{padding:"12px 22px",borderRadius:10,border:"1px solid rgba(255,61,90,.3)",background:"rgba(255,61,90,.1)",color:"#ff3d5a",fontFamily:"'Rajdhani',sans-serif",fontSize:17,fontWeight:700,cursor:"pointer",opacity:round.card<=1?.4:1}}>⬇ Desce</button>
        <button onClick={()=>guess("sobe")} disabled={busy||round.card>=13} className="btn-press" style={{padding:"12px 22px",borderRadius:10,border:"1px solid rgba(0,229,176,.3)",background:"rgba(0,229,176,.1)",color:"#00e5b0",fontFamily:"'Rajdhani',sans-serif",fontSize:17,fontWeight:700,cursor:"pointer",opacity:round.card>=13?.4:1}}>⬆ Sobe</button>
      </div>}
    </div>
    <WinMsg msg={msg} type={mT} prize={lastResult.prize} bet={lastResult.bet}/>
    {stuck&&<button onClick={unstick} className="btn-press" style={{width:"100%",padding:"9px 0",border:"1px solid rgba(255,200,80,.4)",borderRadius:10,background:"rgba(245,200,66,.1)",color:"#f5c842",fontSize:14,fontWeight:700,cursor:"pointer",marginTop:4}}>🔓 Cancelar rodada travada</button>}
    <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
      <div style={{flex:1}}><BetRow G={G} setG={setG} onAction={begin} label="🎴 COMEÇAR RODADA" disabled={round.active}/></div>
      <button onClick={saque} disabled={!round.active||round.streak===0} className="btn-press" style={{padding:"10px 14px",border:"none",borderRadius:10,background:"linear-gradient(135deg,#00e5b0,#00b88a)",color:"#000",fontFamily:"'Cinzel Decorative',serif",fontSize:15,fontWeight:700,cursor:"pointer",opacity:(!round.active||round.streak===0)?.4:1,whiteSpace:"nowrap",height:42}}>🏆 SACAR</button>
    </div>
  </GameLayout>;
}
