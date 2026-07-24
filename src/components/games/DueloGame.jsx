import { useState } from "react";
import { activateAudio, sWin, sLoss, sCard } from "../../game/audio";
import { rnd } from "../../game/rng";
import { sleep, fmt, BETS, GAMES, SU, RK } from "../../game/constants";
import { supabase, hasSupabase } from "../../lib/supabase";
import { GameLayout } from "../shared/GameLayout";
import { WinMsg } from "../shared/WinMsg";
import { BetRow } from "../shared/BetControls";


// ═══ DUELO SUPREMO — auditado, correto ═══════════════════════
function cVal(r){if(r==="A")return 14;if(r==="K")return 13;if(r==="Q")return 12;if(r==="J")return 11;return parseInt(r);}
function rCard(){return{rank:RK[Math.floor(rnd()*13)],suit:SU[Math.floor(rnd()*4)]};}
function isR(c){return c.suit==="♥"||c.suit==="♦";}
export function DueloGame({G,setG,history,addHistory,user,demoMode}){
  const[pk,setPk]=useState("maior");const[bc,setBC]=useState(null);const[cc,setCC]=useState(null);const[busy,setBusy]=useState(false);
  const[msg,setMsg]=useState("");const[mT,setMT]=useState("");
  const[lastResult,setLastResult]=useState({prize:0,bet:0});
  function Card({c,label}){return <div style={{textAlign:"center"}}><div style={{fontSize:14,letterSpacing:2,color:"#6a7a9a",marginBottom:6}}>{label}</div><div style={{width:70,height:96,background:c?"linear-gradient(135deg,#fff,#eee)":"linear-gradient(135deg,#1a2a4a,#0c1226)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${c?"rgba(255,255,255,.3)":"rgba(245,200,66,.3)"}`,boxShadow:"0 4px 12px rgba(0,0,0,.5)",fontSize:c?20:22,fontWeight:900,color:c?isR(c)?"#cc1a35":"#111":"#f5c842",margin:"0 auto"}}>{c?`${c.rank}${c.suit}`:"?"}</div></div>;}
  async function reveal(){
    activateAudio();const bet=BETS[G.betIdx];if(G.saldo<bet){setMsg("❌ Saldo insuficiente!");setMT("loss");return;}
    setBusy(true);setMsg("");setMT("");
    const useServer = hasSupabase && user && !demoMode;
    if(useServer) setG(p=>({...p,saldo:p.saldo-bet}));
    sCard();

    let base, ch=null, draw, win, prize=0, newBalance=null;

    if(useServer){
      const { data, error } = await supabase.rpc('play_duelo', { p_user_id: user.id, p_bet: bet, p_pick: pk });
      if(error || !data || !data[0]){
        console.error('[play_duelo]', error);
        setMsg("⚠️ Erro ao processar. Tente novamente.");setMT("loss");
        setG(p=>({...p,saldo:p.saldo+bet}));setBusy(false);return;
      }
      const res=data[0];
      base={rank:res.base_rank,suit:res.base_suit}; ch={rank:res.challenge_rank,suit:res.challenge_suit};
      draw=res.is_draw; win=res.won; prize=Number(res.prize); newBalance=Number(res.new_balance);
      setBC(base);setCC(null);
    }else{
      setG(p=>({...p,saldo:p.saldo-bet})); // BUG CORRIGIDO: aposta nunca era descontada no modo demo/visitante
      base=rCard();setBC(base);setCC(null);
    }

    const bv=cVal(base.rank);const above=Math.max(0,13-RK.indexOf(base.rank)-1)*4;const below=RK.indexOf(base.rank)*4;const tot=52;
    setMsg(`Carta: ${base.rank}${base.suit} | Maior: ${(above/tot*100).toFixed(0)}% | Menor: ${(below/tot*100).toFixed(0)}%`);setMT("teal");
    await sleep(700);sCard();

    if(!useServer){
      ch=rCard();const cv=cVal(ch.rank);draw=bv===cv;win=!draw&&((pk==="maior"&&cv>bv)||(pk==="menor"&&cv<bv));
      const sb=G.streak>=5?.1:0; if(win) prize=+(bet*1.92*(1+sb)).toFixed(2);
    }
    setCC(ch);
    await sleep(200);

    if(useServer) setG(p=>({...p,saldo:newBalance}));
    if(draw){
      sLoss();
      if(!useServer) setG(p=>({...p,losses:p.losses+1,streak:0,rounds:p.rounds+1}));
      setMsg(`🤝 Empate! ${base.rank} vs ${ch.rank}. −${fmt(bet)}`);setMT("loss");
      if(!useServer) addHistory({txt:`🃏 Duelo empate −${fmt(bet)}`,type:""},{gameId:'duelo',bet,result:0,won:false});
    }else if(win){
      setLastResult({prize,bet});sWin();
      if(!useServer) setG(p=>({...p,saldo:p.saldo+prize,wins:p.wins+1,totalWon:p.totalWon+prize,streak:p.streak+1,rounds:p.rounds+1,best:Math.max(p.best,prize)}));
      setMsg(`🎉 ${ch.rank} vs ${base.rank} — +${fmt(prize)}! (×1.92)`);setMT("win");
      if(!useServer) addHistory({txt:`🃏 Duelo ×1.92 +${fmt(prize)}`,type:"win"},{gameId:'duelo',bet,result:prize,won:true});
    }else{
      sLoss();
      if(!useServer) setG(p=>({...p,losses:p.losses+1,streak:0,rounds:p.rounds+1}));
      setMsg(`😔 ${ch.rank} vs ${base.rank}. −${fmt(bet)}`);setMT("loss");
      if(!useServer) addHistory({txt:`❌ Duelo −${fmt(bet)}`,type:""},{gameId:'duelo',bet,result:0,won:false});
    }
    setTimeout(()=>setBusy(false),800);
  }
  return <GameLayout game={GAMES[5]} G={G} setG={setG} history={history}><div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:20,padding:12}}><Card c={bc} label="CARTA BASE"/><div className="cn" style={{fontSize:24,fontWeight:700,color:"#6a7a9a"}}>VS</div><Card c={cc} label="CARTA DESAFIO"/></div><div style={{display:"flex",gap:8,justifyContent:"center"}}>{["maior","menor"].map(p=><button key={p} onClick={()=>setPk(p)} className="btn-press" style={{padding:"9px 20px",borderRadius:10,border:`2px solid ${pk===p?"#f5c842":"rgba(255,200,80,.2)"}`,background:pk===p?"rgba(245,200,66,.12)":"transparent",color:pk===p?"#f5c842":"#6a7a9a",fontFamily:"'Rajdhani',sans-serif",fontSize:17,fontWeight:700,cursor:"pointer"}}>{p==="maior"?"📈 Maior":"📉 Menor"}</button>)}</div><WinMsg msg={msg} type={mT} prize={lastResult.prize} bet={lastResult.bet}/><BetRow G={G} setG={setG} onAction={reveal} label="REVELAR CARTA" disabled={busy}/></GameLayout>;
}
