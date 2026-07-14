import { useState, useRef } from "react";
import { activateAudio, sBomb, sCash, sTreasure } from "../../game/audio";
import { shuffle } from "../../game/rng";
import { fmt, BETS, GAMES } from "../../game/constants";
import { GameLayout } from "../shared/GameLayout";
import { WinMsg } from "../shared/WinMsg";
import { supabase, hasSupabase } from "../../lib/supabase";
import { BetRow } from "../shared/BetControls";

const MM=[1,1.08,1.23,1.42,1.64,1.92,2.25,2.68,3.21,3.9,4.8,6,7.64,9.93,13.24,18.21,26.01,39.02,62.43,109.25,218.5];
export function MinaGame({G,setG,history,addHistory,user}){
  const[mn,setMn]=useState({active:false,bombs:[],rev:[],open:0,mult:1,bet:0,roundId:null});
  const[msg,setMsg]=useState("");const[mT,setMT]=useState("");
  const[lastResult,setLastResult]=useState({prize:0,bet:0});
  const submittingR = useRef(false);
  async function start(){
    if(submittingR.current || mn.active) return;
    submittingR.current = true;
    try{
      activateAudio();const bet=BETS[G.betIdx];if(G.saldo<bet){setMsg("❌ Saldo insuficiente!");setMT("loss");return;}
      const useServer = hasSupabase && user;
      setMsg("");setMT("");
      if(useServer){
        const { data, error } = await supabase.rpc('mina_start', { p_user_id: user.id, p_bet: bet });
        if(error || !data){console.error('[mina_start]',error);setMsg(error?.message?.includes('em andamento')?"⚠️ Já tem uma rodada em andamento.":"⚠️ Erro ao iniciar. Tente novamente.");setMT("loss");return;}
        setG(p=>({...p,saldo:p.saldo-bet}));
        setMn({active:true,bombs:[],rev:[],open:0,mult:1,bet,roundId:data});
      }else{
        const bombs=shuffle(Array.from({length:25},(_,i)=>i)).slice(0,3);
        setG(p=>({...p,saldo:p.saldo-bet}));
        setMn({active:true,bombs,rev:[],open:0,mult:1,bet,roundId:null});
      }
      setMsg("💣 Clique nas células — 3 bombas escondidas!");setMT("teal");
    } finally {
      submittingR.current = false;
    }
  }
  async function tap(i){
    if(!mn.active||mn.rev.includes(i))return;
    const useServer = hasSupabase && user;

    if(useServer){
      let data,error;
      try{
        ({ data, error } = await supabase.rpc('mina_tap', { p_user_id: user.id, p_round_id: mn.roundId, p_cell: i }));
      }catch(e){
        console.error('[mina_tap] exceção:',e);
        setMsg("⚠️ Erro de conexão. Tente clicar de novo — sua rodada continua ativa.");setMT("loss");
        return;
      }
      if(error || !data || !data[0]){console.error('[mina_tap]',error);setMsg("⚠️ Erro ao processar. Tente novamente.");setMT("loss");return;}
      const r=data[0];
      if(r.is_bomb){
        sBomb();
        setMn(p=>({...p,active:false,rev:[...p.rev,i],bombs:r.all_bombs||p.bombs}));
        setG(p=>({...p,saldo:r.new_balance}));
        setMsg(`💥 BOMBA! Perdeu ${fmt(mn.bet)}`);setMT("loss");
      }else{
        sTreasure();
        setMn(p=>({...p,rev:[...p.rev,i],open:r.open_count,mult:Number(r.mult)}));
        setMsg(`💎 Tesouro! Multiplicador: ×${Number(r.mult).toFixed(2)} — saque ou continue!`);setMT("teal");
      }
      return;
    }

    if(mn.bombs.includes(i)){sBomb();setMn(p=>({...p,active:false,rev:[...p.rev,i]}));setG(p=>({...p,losses:p.losses+1,streak:0,rounds:p.rounds+1}));setMsg(`💥 BOMBA! Perdeu ${fmt(mn.bet)}`);setMT("loss");addHistory({txt:`💣 Bomba −${fmt(mn.bet)}`,type:""},{gameId:'mina',bet:mn.bet,result:0,won:false});}else{sTreasure();const o=mn.open+1;const m=MM[o]||400;setMn(p=>({...p,rev:[...p.rev,i],open:o,mult:m}));setMsg(`💎 Tesouro! Multiplicador: ×${m.toFixed(2)} — saque ou continue!`);setMT("teal");}
  }
  async function saque(){
    if(!mn.active||mn.open===0)return;
    const useServer = hasSupabase && user;
    if(useServer){
      let data,error;
      try{
        ({ data, error } = await supabase.rpc('mina_cashout', { p_user_id: user.id, p_round_id: mn.roundId }));
      }catch(e){
        console.error('[mina_cashout] exceção:',e);
        setMsg("⚠️ Erro de conexão ao sacar. Tente de novo.");setMT("loss");
        return;
      }
      if(error || !data || !data[0]){console.error('[mina_cashout]',error);setMsg("⚠️ Erro ao sacar. Tente novamente.");setMT("loss");return;}
      const r=data[0];
      setLastResult({prize:r.prize,bet:mn.bet});sCash();
      setG(p=>({...p,saldo:r.new_balance}));
      setMn(p=>({...p,active:false}));
      setMsg(`🏆 Sacou ×${mn.mult.toFixed(2)} — +${fmt(r.prize)}!`);setMT("win");
      return;
    }
    const prize=+(mn.bet*mn.mult).toFixed(2);setLastResult({prize,bet:mn.bet});sCash();setG(p=>({...p,saldo:p.saldo+prize,wins:p.wins+1,totalWon:p.totalWon+prize,streak:p.streak+1,rounds:p.rounds+1,best:Math.max(p.best,prize)}));setMn(p=>({...p,active:false}));setMsg(`🏆 Sacou ×${mn.mult.toFixed(2)} — +${fmt(prize)}!`);setMT("win");addHistory({txt:`💣 Mina ×${mn.mult.toFixed(2)} +${fmt(prize)}`,type:"win"},{gameId:'mina',bet:mn.bet,result:prize,won:true});
  }
  return <GameLayout game={GAMES[2]} G={G} setG={setG} history={history}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:5,maxWidth:340,margin:"0 auto"}}>
      {Array.from({length:25},(_,i)=>{const rev=mn.rev.includes(i);const bomb=rev&&mn.bombs.includes(i);const tres=rev&&!mn.bombs.includes(i);const sb=!mn.active&&mn.bombs.includes(i)&&!mn.rev.includes(i);return <button key={i} onClick={()=>tap(i)} disabled={!mn.active||rev} style={{aspectRatio:"1",fontSize:26,borderRadius:10,border:`1px solid ${bomb?"rgba(255,61,90,.5)":tres?"rgba(0,229,176,.5)":"rgba(255,200,80,.1)"}`,background:bomb?"rgba(255,61,90,.15)":tres?"rgba(0,229,176,.12)":sb?"rgba(255,61,90,.08)":"rgba(12,18,38,.9)",cursor:mn.active&&!rev?"pointer":"default"}}>{bomb?"💣":tres?"💎":sb?"💣":"❓"}</button>;})}
    </div>
    <WinMsg msg={msg} type={mT} prize={lastResult.prize} bet={lastResult.bet}/>
    <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
      <div style={{flex:1}}><BetRow G={G} setG={setG} onAction={start} label="INICIAR" disabled={mn.active}/></div>
      <button onClick={saque} disabled={!mn.active||mn.open===0} className="btn-press" style={{padding:"10px 14px",border:"none",borderRadius:10,background:"linear-gradient(135deg,#00e5b0,#00b88a)",color:"#000",fontFamily:"'Cinzel Decorative',serif",fontSize:15,fontWeight:700,cursor:"pointer",opacity:(!mn.active||mn.open===0)?.4:1,whiteSpace:"nowrap",height:42}}>🏆 SACAR</button>
    </div>
  </GameLayout>;
}
