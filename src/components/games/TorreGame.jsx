import { useState, useRef } from "react";
import { activateAudio, sBomb, sCash, sFloor } from "../../game/audio";
import { rnd } from "../../game/rng";
import { fmt, BETS, GAMES } from "../../game/constants";
import { GameLayout } from "../shared/GameLayout";
import { WinMsg } from "../shared/WinMsg";
import { supabase, hasSupabase } from "../../lib/supabase";
import { BetRow } from "../shared/BetControls";


// ═══ TORRE DOS CAMPEÕES — auditado, correto ═══════════════════
const TF=8;const TC=3;const TM=[1.40,2.09,3.14,4.71,7.06,10.59,15.89,23.83];
export function TorreGame({G,setG,history,addHistory,user,demoMode}){
  const busyR=useRef(false);
  const[stuck,setStuck]=useState(false);
  const[tw,setTw]=useState({active:false,floor:0,bombs:[],bet:0,collected:0,roundId:null});
  const[rev,setRev]=useState({});const[msg,setMsg]=useState("");const[mT,setMT]=useState("");
  const[lastResult,setLastResult]=useState({prize:0,bet:0});
  async function begin(){
    if(busyR.current)return;
    busyR.current=true;
    try{
    activateAudio();const bet=BETS[G.betIdx];if(G.saldo<bet){setMsg("❌ Saldo insuficiente!");setMT("loss");return;}
    const useServer = hasSupabase && user && !demoMode;
    setRev({});setMsg("");setMT("");
    if(useServer){
      const { data, error } = await supabase.rpc('torre_start', { p_user_id: user.id, p_bet: bet });
      if(error || !data){console.error('[torre_start]',error);if(error?.message?.includes("em andamento")){setStuck(true);setMsg("⚠️ Rodada anterior travada detectada.");}else{setMsg("⚠️ Erro ao iniciar. Tente novamente.");}setMT("loss");return;}
      setG(p=>({...p,saldo:p.saldo-bet}));
      setTw({active:true,floor:0,bombs:[],bet,collected:0,roundId:data});
    }else{
      const b=Array(TF).fill(0).map(()=>Math.floor(rnd()*TC));
      setG(p=>({...p,saldo:p.saldo-bet}));
      setTw({active:true,floor:0,bombs:b,bet,collected:0,roundId:null});
    }
    setMsg("🗼 Escolha a célula segura para subir!");setMT("teal");
  
    }finally{busyR.current=false;}
  }
  async function step(f,c){
    if(busyR.current)return;
    busyR.current=true;
    try{
    if(!tw.active||f!==tw.floor)return;
    const useServer = hasSupabase && user && !demoMode;

    if(useServer){
      const { data, error } = await supabase.rpc('torre_step', { p_user_id: user.id, p_round_id: tw.roundId, p_cell: c });
      if(error || !data || !data[0]){console.error('[torre_step]',error);setMsg("⚠️ Erro ao processar. Tente novamente.");setMT("loss");return;}
      const r=data[0];
      if(r.is_bomb){
        sBomb();
        const nr={...rev,[`${f}_${c}`]:"bomb"};
        if(r.all_bombs){for(let ff=f;ff<TF;ff++)nr[`${ff}_${r.all_bombs[ff]}`]="bomb";}
        setRev(nr);setTw(p=>({...p,active:false}));setG(p=>({...p,saldo:r.new_balance}));
        setMsg(`💣 Bomba! −${fmt(tw.bet)}`);setMT("loss");
      }else{
        sFloor();
        setRev(p=>({...p,[`${f}_${c}`]:"safe"}));
        if(r.finished){
          setLastResult({prize:r.prize,bet:tw.bet});sCash();
          setG(p=>({...p,saldo:r.new_balance}));
          setTw(p=>({...p,active:false,collected:r.collected}));
          setMsg(`🏆 TOPO! +${fmt(r.prize)} (×${r.collected})`);setMT("win");
        }else{
          setTw(p=>({...p,floor:r.floor,collected:r.collected}));
          setMsg(`Andar ${TF-f} ✅ — ×${Number(r.collected).toFixed(1)} | Suba ou saque!`);setMT("teal");
        }
      }
      return;
    }

    // modo visitante (sem login) — local, sem dinheiro real
    if(c===tw.bombs[f]){sBomb();const nr={...rev,[`${f}_${c}`]:"bomb"};for(let ff=tw.floor;ff<TF;ff++)nr[`${ff}_${tw.bombs[ff]}`]="bomb";setRev(nr);setTw(p=>({...p,active:false}));setG(p=>({...p,losses:p.losses+1,streak:0,rounds:p.rounds+1}));setMsg(`💣 Bomba! −${fmt(tw.bet)}`);setMT("loss");addHistory({txt:`🗼 Bomba −${fmt(tw.bet)}`,type:""},{gameId:'torre',bet:tw.bet,result:0,won:false});}else{sFloor();const m=TM[f];const nf=tw.floor+1;setRev(p=>({...p,[`${f}_${c}`]:"safe"}));if(nf>=TF){const prize=+(tw.bet*m).toFixed(2);setLastResult({prize,bet:tw.bet});sCash();setG(p=>({...p,saldo:p.saldo+prize,wins:p.wins+1,totalWon:p.totalWon+prize,streak:p.streak+1,rounds:p.rounds+1,best:Math.max(p.best,prize)}));setTw(p=>({...p,active:false,collected:m}));setMsg(`🏆 TOPO! +${fmt(prize)} (×${m})`);setMT("win");addHistory({txt:`🗼 Torre ×${m} +${fmt(prize)}`,type:"win"},{gameId:'torre',bet:tw.bet,result:prize,won:true});}else{setTw(p=>({...p,floor:nf,collected:m}));setMsg(`Andar ${TF-f} ✅ — ×${m.toFixed(1)} | Suba ou saque!`);setMT("teal");}}
  
    }finally{busyR.current=false;}
  }
  async function saque(){
    if(busyR.current)return;
    busyR.current=true;
    try{
    if(!tw.active||tw.collected===0)return;
    const useServer = hasSupabase && user && !demoMode;
    if(useServer){
      const { data, error } = await supabase.rpc('torre_cashout', { p_user_id: user.id, p_round_id: tw.roundId });
      if(error || !data || !data[0]){console.error('[torre_cashout]',error);setMsg("⚠️ Erro ao sacar. Tente novamente.");setMT("loss");return;}
      const r=data[0];
      setLastResult({prize:r.prize,bet:tw.bet});sCash();
      setG(p=>({...p,saldo:r.new_balance}));
      setTw(p=>({...p,active:false}));
      setMsg(`🏆 Sacou ×${tw.collected.toFixed(1)} — +${fmt(r.prize)}!`);setMT("win");
      return;
    }
    const prize=+(tw.bet*tw.collected).toFixed(2);setLastResult({prize,bet:tw.bet});sCash();setG(p=>({...p,saldo:p.saldo+prize,wins:p.wins+1,totalWon:p.totalWon+prize,streak:p.streak+1,rounds:p.rounds+1,best:Math.max(p.best,prize)}));setTw(p=>({...p,active:false}));setMsg(`🏆 Sacou ×${tw.collected.toFixed(1)} — +${fmt(prize)}!`);setMT("win");addHistory({txt:`🗼 Torre ×${tw.collected.toFixed(1)} +${fmt(prize)}`,type:"win"},{gameId:'torre',bet:tw.bet,result:prize,won:true});
  
    }finally{busyR.current=false;}
  }
  async function unstick(){
    if(!user) return;
    setStuck(false);
    const { error } = await supabase.rpc('abandon_round', { p_user_id: user.id, p_game: 'torre' });
    if(error){console.error('[abandon_round]',error);setMsg("⚠️ Não consegui cancelar. Tente de novo em alguns segundos.");setMT("loss");return;}
    setMsg("🔓 Rodada travada cancelada — pode jogar de novo!");setMT("");
  }

  return <GameLayout game={GAMES[6]} G={G} setG={setG} history={history}><div style={{display:"flex",flexDirection:"column",gap:4}}>{Array.from({length:TF},(_,f)=>{const active=tw.active&&f===tw.floor;const cleared=f<tw.floor;const m=TM[f];return <div key={f} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:10,border:`1px solid ${active?"rgba(245,200,66,.4)":cleared?"rgba(0,229,176,.2)":"rgba(255,200,80,.06)"}`,background:active?"rgba(245,200,66,.05)":cleared?"rgba(0,229,176,.03)":"transparent"}}><div className="cn" style={{width:24,fontSize:15,color:"#6a7a9a",textAlign:"center"}}>{TF-f}</div><div style={{display:"flex",gap:5,flex:1}}>{Array.from({length:TC},(_,c)=>{const r=rev[`${f}_${c}`];const can=active&&!r;return <button key={c} onClick={()=>step(f,c)} disabled={!can} className={active&&!r?"tA":""} style={{flex:1,padding:"6px 0",borderRadius:8,border:`1px solid ${r==="bomb"?"rgba(255,61,90,.5)":r==="safe"?"rgba(0,229,176,.5)":active?"rgba(245,200,66,.3)":"rgba(255,200,80,.08)"}`,background:r==="bomb"?"rgba(255,61,90,.15)":r==="safe"?"rgba(0,229,176,.12)":"rgba(12,18,38,.8)",color:r==="bomb"?"#ff3d5a":r==="safe"?"#00e5b0":"#6a7a9a",fontSize:18,cursor:can?"pointer":"default"}}>{r==="bomb"?"💣":r==="safe"?"✅":"❓"}</button>;})}</div><div className="cn" style={{width:44,fontSize:14,color:"#00e5b0",textAlign:"right"}}>×{m}</div></div>;})}</div><WinMsg msg={msg} type={mT} prize={lastResult.prize} bet={lastResult.bet}/>{stuck&&<button onClick={unstick} className="btn-press" style={{width:"100%",padding:"9px 0",border:"1px solid rgba(255,200,80,.4)",borderRadius:10,background:"rgba(245,200,66,.1)",color:"#f5c842",fontSize:14,fontWeight:700,cursor:"pointer",marginTop:4}}>🔓 Cancelar rodada travada</button>}<div style={{display:"flex",gap:8,alignItems:"flex-end"}}><div style={{flex:1}}><BetRow G={G} setG={setG} onAction={begin} label="SUBIR A TORRE" disabled={tw.active}/></div><button onClick={saque} disabled={!tw.active||tw.collected===0} className="btn-press" style={{padding:"10px 14px",border:"none",borderRadius:10,background:"linear-gradient(135deg,#00e5b0,#00b88a)",color:"#000",fontFamily:"'Cinzel Decorative',serif",fontSize:15,fontWeight:700,cursor:"pointer",opacity:(!tw.active||tw.collected===0)?.4:1,whiteSpace:"nowrap",height:42}}>🏆 SACAR</button></div></GameLayout>;
}
