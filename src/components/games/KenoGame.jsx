import { useState } from "react";
import { activateAudio, sWin, sLoss, sKeno } from "../../game/audio";
import { shuffle } from "../../game/rng";
import { sleep, fmt, BETS, GAMES } from "../../game/constants";
import { supabase, hasSupabase } from "../../lib/supabase";
import { GameLayout } from "../shared/GameLayout";
import { WinMsg } from "../shared/WinMsg";
import { BetRow } from "../shared/BetControls";


// ═══ KENO GALÁCTICO — auditado, correto ══════════════════════
// CORRIGIDO: tabela anterior tinha RTP real de apenas 57.85% (calculado via
// distribuição hipergeométrica exata) vs ~80% declarado.
// Nova tabela validada matematicamente: RTP exato de 80.09%.
const KM=[0,0,0,1.1,2.1,5.5];
export function KenoGame({G,setG,history,addHistory,user,demoMode}){
  const[picks,setPicks]=useState(new Set());const[drawn,setDrawn]=useState([]);const[playing,setPlay]=useState(false);
  const[msg,setMsg]=useState("");const[mT,setMT]=useState("");
  const[lastResult,setLastResult]=useState({prize:0,bet:0});
  function pick(n){if(playing)return;setPicks(p=>{const ns=new Set(p);if(ns.has(n)){ns.delete(n);return ns;}if(ns.size>=5)return ns;ns.add(n);return ns;});}
  async function play(){
    activateAudio();if(picks.size<5){setMsg("⚠️ Escolha exatamente 5 números!");setMT("loss");return;}
    const bet=BETS[G.betIdx];if(G.saldo<bet){setMsg("❌ Saldo insuficiente!");setMT("loss");return;}
    setPlay(true);setDrawn([]);setMsg("🌌 Sorteando...");setMT("teal");
    const useServer = hasSupabase && user && !demoMode;
    if(useServer) setG(p=>({...p,saldo:p.saldo-bet}));

    let dn, hits, m, prize=0, newBalance=null;
    const pickArr=Array.from(picks);

    if(useServer){
      const { data, error } = await supabase.rpc('play_keno', { p_user_id: user.id, p_bet: bet, p_picks: pickArr });
      if(error || !data || !data[0]){
        console.error('[play_keno]', error);
        setMsg("⚠️ Erro ao processar. Tente novamente.");setMT("loss");
        setG(p=>({...p,saldo:p.saldo+bet}));setPlay(false);return;
      }
      const res=data[0];
      dn=res.drawn; hits=res.hits; m=Number(res.mult); prize=Number(res.prize); newBalance=Number(res.new_balance);
    }else{
      setG(p=>({...p,saldo:p.saldo-bet}));
      const pool=shuffle(Array.from({length:40},(_,i)=>i+1));
      dn=pool.slice(0,20);
      hits=dn.filter(n=>picks.has(n)).length;
      m=KM[hits]||0;
      if(m>0) prize=+(bet*m).toFixed(2);
    }

    for(let i=0;i<20;i++){await sleep(110);setDrawn(dn.slice(0,i+1));if(picks.has(dn[i]))sKeno();}

    if(useServer) setG(p=>({...p,saldo:newBalance}));
    if(m>0){
      setLastResult({prize,bet});sWin();
      if(!useServer) setG(p=>({...p,saldo:p.saldo+prize,wins:p.wins+1,totalWon:p.totalWon+prize,streak:p.streak+1,rounds:p.rounds+1,best:Math.max(p.best,prize)}));
      setMsg(`🌌 ${hits} acerto(s)! ×${m} — +${fmt(prize)}`);setMT("win");
      if(!useServer) addHistory({txt:`🌌 Keno ${hits} acertos +${fmt(prize)}`,type:"win"},{gameId:'keno',bet,result:prize,won:true});
    }else{
      sLoss();
      if(!useServer) setG(p=>({...p,losses:p.losses+1,streak:0,rounds:p.rounds+1}));
      setMsg(`😔 ${hits} acerto(s) — sem prêmio (precisa ≥3). −${fmt(bet)}`);setMT("loss");
      if(!useServer) addHistory({txt:`❌ Keno ${hits} acertos −${fmt(bet)}`,type:""},{gameId:'keno',bet,result:0,won:false});
    }
    setPlay(false);
  }
  return <GameLayout game={GAMES[8]} G={G} setG={setG} history={history}>
    <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:8,flexWrap:"wrap"}}>
      <div style={{padding:"4px 12px",borderRadius:8,fontSize:16,fontWeight:600,background:"rgba(245,200,66,.12)",border:"1px solid rgba(245,200,66,.25)",color:"#f5c842"}}>Selecionados: {picks.size}/5</div>
      <div style={{padding:"4px 12px",borderRadius:8,fontSize:16,fontWeight:600,background:"rgba(0,229,176,.12)",border:"1px solid rgba(0,229,176,.25)",color:"#00e5b0"}}>Acertos: {drawn.filter(n=>picks.has(n)).length}</div>
      <div style={{padding:"4px 12px",borderRadius:8,fontSize:15,fontWeight:600,background:"rgba(194,100,255,.08)",border:"1px solid rgba(194,100,255,.2)",color:"#c264ff"}}>3=×1.1 | 4=×2.1 | 5=×5.5</div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:4,maxWidth:340,margin:"0 auto"}}>
      {Array.from({length:40},(_,i)=>i+1).map(n=>{const ip=picks.has(n);const ih=ip&&drawn.includes(n);const im=drawn.includes(n)&&!ip;return <button key={n} onClick={()=>pick(n)} className={ih?"kH":""} style={{aspectRatio:"1",background:ih?"rgba(0,229,176,.15)":ip?"rgba(245,200,66,.15)":im?"rgba(100,100,100,.15)":"rgba(12,18,38,.9)",border:`1px solid ${ih?"rgba(0,229,176,.5)":ip?"rgba(245,200,66,.5)":im?"rgba(100,100,100,.3)":"rgba(255,200,80,.08)"}`,borderRadius:7,color:ih?"#00e5b0":ip?"#f5c842":im?"#555":"#6a7a9a",fontSize:15,fontFamily:"'Cinzel',serif",fontWeight:700,cursor:playing?"default":"pointer"}}>{n}</button>;})}
    </div>
    <WinMsg msg={msg} type={mT} prize={lastResult.prize} bet={lastResult.bet}/>
    <BetRow G={G} setG={setG} onAction={play} label="SORTEAR!" disabled={playing}/>
  </GameLayout>;
}
