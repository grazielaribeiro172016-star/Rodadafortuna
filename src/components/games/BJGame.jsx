import { useState, useRef } from "react";
import { activateAudio, sWin, sLoss, sCard, sBJ } from "../../game/audio";
import { shuffle } from "../../game/rng";
import { sleep, fmt, BETS, GAMES, SU, RK } from "../../game/constants";
import { GameLayout } from "../shared/GameLayout";
import { WinMsg } from "../shared/WinMsg";
import { QuickBets } from "../shared/BetControls";
import { supabase, hasSupabase } from "../../lib/supabase";
import { Confetti } from "../shared/Effects";


// ═══ BLACKJACK ELITE — auditado, correto ════════════════════
export function BJGame({G,setG,history,addHistory,user,demoMode}){
  const busyR=useRef(false);
  const[stuck,setStuck]=useState(false);
  const[bj,setBJ]=useState({deck:[],player:[],dealer:[],bet:0,active:false,roundId:null});
  const[msg,setMsg]=useState("");const[mT,setMT]=useState("");const[ct,setCt]=useState(0);
  const[lastResult,setLastResult]=useState({prize:0,bet:0});
  function makeDeck(){return shuffle(SU.flatMap(s=>RK.map(r=>({rank:r,suit:s}))));}
  function bjV(cs){let t=0,a=0;for(const c of cs){if(c.rank==="A"){a++;t+=11;}else if(["J","Q","K"].includes(c.rank))t+=10;else t+=parseInt(c.rank);}while(t>21&&a){t-=10;a--;}return t;}
  function BCard({c}){if(!c)return null;const red=c.suit==="♥"||c.suit==="♦";if(c.rank==="?")return <div style={{width:42,height:58,background:"linear-gradient(135deg,#1a2a4a,#0c1226)",borderRadius:7,border:"1px solid rgba(245,200,66,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"#f5c842"}}>?</div>;return <div style={{width:42,height:58,background:"linear-gradient(135deg,#fff,#eee)",borderRadius:7,border:"1px solid rgba(255,255,255,.3)",boxShadow:"0 2px 8px rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:red?"#cc1a35":"#111"}}>{c.rank}{c.suit}</div>;}
  async function deal(){
    if(busyR.current)return;
    busyR.current=true;
    try{
    activateAudio();const bet=BETS[G.betIdx];if(G.saldo<bet){setMsg("❌ Saldo insuficiente!");setMT("loss");return;}
    sCard();setTimeout(sCard,120);setTimeout(sCard,240);
    setMsg("");setMT("");
    const useServer = hasSupabase && user && !demoMode;

    if(useServer){
      const { data, error } = await supabase.rpc('bj_deal', { p_user_id: user.id, p_bet: bet });
      if(error || !data || !data[0]){console.error('[bj_deal]',error);if(error?.message?.includes("em andamento")){setStuck(true);setMsg("⚠️ Mão anterior travada detectada.");}else{setMsg("⚠️ Erro ao distribuir. Tente novamente.");}setMT("loss");return;}
      const r=data[0];
      setG(p=>({...p,saldo:r.new_balance ?? (p.saldo-bet)}));
      if(r.finished){
        // blackjack natural, já resolvido
        setBJ({deck:[],player:r.player,dealer:r.dealer,bet,active:false,roundId:r.round_id});
        setLastResult({prize:r.prize,bet});
        sBJ();setCt(t=>t+1);
        setMsg(`🎰 BLACKJACK! +${fmt(r.prize)} (×2.15)`);setMT("win");
      }else{
        setBJ({deck:[],player:r.player,dealer:[r.dealer_up,{rank:'?',suit:'?'}],bet,active:true,roundId:r.round_id});
      }
      return;
    }

    let deck=bj.deck.length<10?makeDeck():[...bj.deck];const player=[deck.pop(),deck.pop()];const dealer=[deck.pop(),deck.pop()];setG(p=>({...p,saldo:p.saldo-bet}));const nb={deck,player,dealer,bet,active:true,roundId:null};setBJ(nb);if(bjV(player)===21)await standWith(nb);
  
    }finally{busyR.current=false;}
  }
  async function hit(){
    if(busyR.current)return;
    busyR.current=true;
    try{
    activateAudio();sCard();
    const useServer = hasSupabase && user && !demoMode;
    if(useServer){
      const { data, error } = await supabase.rpc('bj_hit', { p_user_id: user.id, p_round_id: bj.roundId });
      if(error || !data || !data[0]){console.error('[bj_hit]',error);setMsg("⚠️ Erro ao pedir carta. Tente novamente.");setMT("loss");return;}
      const r=data[0];
      setBJ(p=>({...p,player:r.player,dealer:r.finished?r.dealer:p.dealer,active:!r.finished}));
      if(r.finished){
        sLoss();
        setG(p=>({...p,saldo:r.new_balance}));
        setMsg(`💥 Estourou (${r.player_total})! −${fmt(bj.bet)}`);setMT("loss");
      }
      return;
    }
    const d=[...bj.deck];const card=d.pop();const np=[...bj.player,card];const nb={...bj,deck:d,player:np};setBJ(nb);if(bjV(np)>21)await standWith(nb);
  
    }finally{busyR.current=false;}
  }
  async function dbl(){
    if(busyR.current)return;
    busyR.current=true;
    try{
    if(G.saldo<bj.bet){setMsg("❌ Insuficiente para dobrar!");setMT("loss");return;}
    activateAudio();sCard();
    const useServer = hasSupabase && user && !demoMode;
    if(useServer){
      const { data, error } = await supabase.rpc('bj_double', { p_user_id: user.id, p_round_id: bj.roundId });
      if(error || !data || !data[0]){console.error('[bj_double]',error);setMsg("⚠️ Erro ao dobrar. Tente novamente.");setMT("loss");return;}
      const r=data[0];
      setBJ(p=>({...p,player:r.player,dealer:r.dealer,bet:p.bet*2,active:false}));
      setG(p=>({...p,saldo:r.new_balance}));
      await sleep(300);
      finishMsgFromServer(r, bj.bet*2);
      return;
    }
    const d=[...bj.deck];const card=d.pop();const np=[...bj.player,card];setG(p=>({...p,saldo:p.saldo-bj.bet}));const nb={...bj,deck:d,player:np,bet:bj.bet*2,active:false};setBJ(nb);await standWith(nb);
  
    }finally{busyR.current=false;}
  }

  // Traduz o retorno das RPCs de servidor (bj_stand/bj_double) pra mesma UI de sempre
  function finishMsgFromServer(r, effectiveBet){
    const pv=r.player_total, dv=r.dealer_total;
    if(r.result==='win'){
      setLastResult({prize:r.prize,bet:effectiveBet});
      const isNatural = pv===21 && (bj.player?.length===2);
      if(isNatural){sBJ();setCt(t=>t+1);}else sWin();
      setMsg(isNatural?`🎰 BLACKJACK! +${fmt(r.prize)} (×2.15)`:`✅ Você ${pv} vs Dealer ${dv>21?"bust":dv} — +${fmt(r.prize)}`);setMT("win");
    }else if(r.result==='push'){
      setMsg(`🤝 Empate ${pv}. Aposta devolvida.`);setMT("");
    }else{
      sLoss();
      setMsg(`😔 Dealer ${dv} vs Você ${pv}. −${fmt(effectiveBet)}`);setMT("loss");
    }
  }
  async function stand(){
    if(busyR.current)return;
    busyR.current=true;
    try{
    const useServer = hasSupabase && user && !demoMode;
    if(useServer){
      activateAudio();
      const { data, error } = await supabase.rpc('bj_stand', { p_user_id: user.id, p_round_id: bj.roundId });
      if(error || !data || !data[0]){console.error('[bj_stand]',error);setMsg("⚠️ Erro ao parar. Tente novamente.");setMT("loss");return;}
      const r=data[0];
      setBJ(p=>({...p,dealer:r.dealer,active:false}));
      setG(p=>({...p,saldo:r.new_balance}));
      await sleep(300);
      finishMsgFromServer(r, bj.bet);
      return;
    }
    await standWith(bj);
  
    }finally{busyR.current=false;}
  }
  async function standWith(st){let dealer=[...st.dealer];let deck=[...st.deck];while(bjV(dealer)<17)dealer.push(deck.pop());const nb={...st,dealer,deck,active:false};setBJ(nb);const pv=bjV(st.player),dv=bjV(dealer);await sleep(300);let win=false,txt="";if(pv>21){txt=`💥 Estourou (${pv})! −${fmt(st.bet)}`;setG(p=>({...p,losses:p.losses+1,streak:0,rounds:p.rounds+1}));sLoss();}else if(dv>21||pv>dv){win=true;const m=pv===21&&st.player.length===2?2.15:1.80;const prize=+(st.bet*m).toFixed(2);setLastResult({prize,bet:st.bet});txt=pv===21&&st.player.length===2?`🎰 BLACKJACK! +${fmt(prize)} (×2.15)`:`✅ Você ${pv} vs Dealer ${dv>21?"bust":dv} — +${fmt(prize)}`;setG(p=>({...p,saldo:p.saldo+prize,wins:p.wins+1,totalWon:p.totalWon+prize,streak:p.streak+1,rounds:p.rounds+1,best:Math.max(p.best,prize)}));if(pv===21&&st.player.length===2){sBJ();setCt(t=>t+1);}else sWin();addHistory({txt:`♠️ BJ ${pv} vs ${dv} +${fmt(prize)}`,type:"win"},{gameId:'blackjack',bet:st.bet,result:prize,won:true});}else if(pv===dv){setG(p=>({...p,saldo:p.saldo+st.bet,rounds:p.rounds+1}));txt=`🤝 Empate ${pv}. Aposta devolvida.`;}else{sLoss();setG(p=>({...p,losses:p.losses+1,streak:0,rounds:p.rounds+1}));txt=`😔 Dealer ${dv} vs Você ${pv}. −${fmt(st.bet)}`;addHistory({txt:`❌ BJ −${fmt(st.bet)}`,type:""},{gameId:'blackjack',bet:st.bet,result:0,won:false});}setMsg(txt);setMT(win?"win":"loss");}
  const pv=bjV(bj.player);const dv=bjV(bj.dealer);
  async function unstick(){
    if(!user) return;
    setStuck(false);
    const { error } = await supabase.rpc('abandon_round', { p_user_id: user.id, p_game: 'blackjack' });
    if(error){console.error('[abandon_round]',error);setMsg("⚠️ Não consegui cancelar. Tente de novo em alguns segundos.");setMT("loss");return;}
    setMsg("🔓 Rodada travada cancelada — pode jogar de novo!");setMT("");
  }

  return <GameLayout game={GAMES[7]} G={G} setG={setG} history={history}><Confetti trigger={ct}/>{[{cs:bj.dealer,h:bj.active,title:"🤖 DEALER",tot:bj.active?"?":dv,bust:dv>21},{cs:bj.player,h:false,title:"🧑 VOCÊ",tot:pv,bust:pv>21}].map(hd=><div key={hd.title} style={{background:"rgba(5,7,15,.8)",border:"1px solid rgba(255,200,80,.12)",borderRadius:12,padding:"10px 14px"}}><div style={{fontSize:14,letterSpacing:2,textTransform:"uppercase",color:"#6a7a9a",marginBottom:8}}>{hd.title}</div><div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:6}}>{hd.cs.length>0?hd.cs.map((c,i)=><BCard key={i} c={hd.h&&i===1?{rank:"?",suit:"?"}:c}/>):<div style={{color:"#6a7a9a",fontSize:16}}>Aguardando...</div>}</div><div className="cn" style={{fontSize:29,fontWeight:700,color:hd.bust?"#ff3d5a":hd.tot===21?"#f5c842":"#eeeaf0"}}>{hd.tot||""}</div></div>)}<WinMsg msg={msg} type={mT} prize={lastResult.prize} bet={lastResult.bet}/>{stuck&&<button onClick={unstick} className="btn-press" style={{width:"100%",padding:"9px 0",border:"1px solid rgba(255,200,80,.4)",borderRadius:10,background:"rgba(245,200,66,.1)",color:"#f5c842",fontSize:14,fontWeight:700,cursor:"pointer",marginTop:4}}>🔓 Cancelar rodada travada</button>}<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{[{fn:deal,l:"DISTRIBUIR",bg:"linear-gradient(135deg,#f5c842,#e8a020)",tc:"#000",d:bj.active},{fn:hit,l:"+ CARTA",bg:"linear-gradient(135deg,#00e5b0,#00b88a)",tc:"#000",d:!bj.active},{fn:stand,l:"✋ PARAR",bg:"linear-gradient(135deg,#4da6ff,#2277dd)",tc:"#fff",d:!bj.active},{fn:dbl,l:"⚡ DOBRAR",bg:"linear-gradient(135deg,#c264ff,#9b4de0)",tc:"#fff",d:!bj.active}].map(b=><button key={b.l} onClick={b.fn} disabled={b.d} className="btn-press" style={{flex:1,padding:"10px 8px",border:"none",borderRadius:10,background:b.bg,color:b.tc,fontFamily:"'Cinzel Decorative',serif",fontSize:14,fontWeight:700,cursor:b.d?"not-allowed":"pointer",opacity:b.d?.4:1}}>{b.l}</button>)}</div><QuickBets G={G} setG={setG} disabled={bj.active}/></GameLayout>;
}
