import { useState } from "react";
import { activateAudio, sWin, sLoss, sCard } from "../../game/audio";
import { shuffle } from "../../game/rng";
import { fmt, BETS, GAMES, SU, RK } from "../../game/constants";
import { supabase, hasSupabase } from "../../lib/supabase";
import { GameLayout } from "../shared/GameLayout";
import { WinMsg } from "../shared/WinMsg";
import { QuickBets } from "../shared/BetControls";

function cardVal(rank){
  if(rank==="A") return 1;
  if(["10","J","Q","K"].includes(rank)) return 0;
  return parseInt(rank);
}
function handVal(cs){ return cs.reduce((t,c)=>t+cardVal(c.rank),0)%10; }

function BCard({c}){
  if(!c) return null;
  const red=c.suit==="♥"||c.suit==="♦";
  return <div style={{width:42,height:58,background:"linear-gradient(135deg,#fff,#eee)",borderRadius:7,border:"1px solid rgba(255,255,255,.3)",boxShadow:"0 2px 8px rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:red?"#cc1a35":"#111"}}>{c.rank}{c.suit}</div>;
}

// ═══ BACCARAT REAL — Player/Banker: RTP ~91% | Empate: RTP ~89% ═══
// Simplificado (2 cartas cada, sem regra de 3ª carta), probabilidades
// confirmadas por simulação: player 45.04% | banker 45.06% | empate 9.91%
export function BaccaratGame({G,setG,history,addHistory,user,demoMode}){
  const[pick,setPick]=useState("player");const[busy,setBusy]=useState(false);
  const[hands,setHands]=useState({player:[],banker:[]});
  const[msg,setMsg]=useState("");const[mT,setMT]=useState("");
  const[lastResult,setLastResult]=useState({prize:0,bet:0});

  function makeDeck(){return shuffle(SU.flatMap(s=>RK.map(r=>({rank:r,suit:s}))));}

  async function play(){
    activateAudio();const bet=BETS[G.betIdx];if(G.saldo<bet){setMsg("❌ Saldo insuficiente!");setMT("loss");return;}
    setBusy(true);setMsg("");setMT("");sCard();setTimeout(sCard,120);setTimeout(sCard,240);setTimeout(sCard,360);
    const useServer = hasSupabase && user && !demoMode;

    let player,banker,pv,bv,result,win,prize=0,newBalance=null;

    if(useServer){
      const { data, error } = await supabase.rpc('play_baccarat', { p_user_id: user.id, p_bet: bet, p_pick: pick });
      if(error || !data || !data[0]){
        console.error('[play_baccarat]', error);
        setMsg("⚠️ Erro ao processar. Tente novamente.");setMT("loss");setBusy(false);return;
      }
      const res=data[0];
      player=res.player; banker=res.banker; pv=res.player_total; bv=res.banker_total;
      result=res.result; win=res.won; prize=Number(res.prize); newBalance=Number(res.new_balance);
    }else{
      setG(p=>({...p,saldo:p.saldo-bet}));
      const deck=makeDeck();
      player=[deck[0],deck[1]]; banker=[deck[2],deck[3]];
      pv=handVal(player); bv=handVal(banker);
      result = pv>bv?'player':bv>pv?'banker':'empate';
      win = result===pick;
      if(win){
        const mult = pick==='empate'?9.0:2.02;
        prize=+(bet*mult).toFixed(2);
      }
    }

    setHands({player:[],banker:[]});
    await new Promise(r=>setTimeout(r,250));
    setHands({player:[player[0]],banker:[banker[0]]});
    await new Promise(r=>setTimeout(r,300));
    setHands({player,banker:[banker[0]]});
    await new Promise(r=>setTimeout(r,300));
    setHands({player,banker});
    await new Promise(r=>setTimeout(r,400));

    if(useServer) setG(p=>({...p,saldo:newBalance}));
    const resultLabel={player:"Jogador",banker:"Banca",empate:"Empate"}[result];
    if(win){
      setLastResult({prize,bet});sWin();
      if(!useServer) setG(p=>({...p,saldo:p.saldo+prize,wins:p.wins+1,totalWon:p.totalWon+prize,streak:p.streak+1,rounds:p.rounds+1,best:Math.max(p.best,prize)}));
      setMsg(`🎉 ${resultLabel} venceu (${pv} vs ${bv})! +${fmt(prize)}`);setMT("win");
      if(!useServer) addHistory({txt:`♠️ Baccarat ${result} +${fmt(prize)}`,type:"win"},{gameId:'baccarat',bet,result:prize,won:true});
    }else{
      sLoss();
      if(!useServer) setG(p=>({...p,losses:p.losses+1,streak:0,rounds:p.rounds+1}));
      setMsg(`😔 ${resultLabel} venceu (${pv} vs ${bv}). −${fmt(bet)}`);setMT("loss");
      if(!useServer) addHistory({txt:`♠️ Baccarat ${result} −${fmt(bet)}`,type:""},{gameId:'baccarat',bet,result:0,won:false});
    }
    setBusy(false);
  }

  return <GameLayout game={GAMES.find(g=>g.id==='baccarat')} G={G} setG={setG} history={history}>
    {[{cs:hands.banker,title:"🏦 BANCA",tot:hands.banker.length?handVal(hands.banker):""},{cs:hands.player,title:"🧑 JOGADOR",tot:hands.player.length?handVal(hands.player):""}].map(hd=>
      <div key={hd.title} style={{background:"rgba(5,7,15,.8)",border:"1px solid rgba(255,200,80,.12)",borderRadius:12,padding:"10px 14px",marginBottom:8}}>
        <div style={{fontSize:14,letterSpacing:2,textTransform:"uppercase",color:"#6a7a9a",marginBottom:8}}>{hd.title}</div>
        <div style={{display:"flex",gap:7,minHeight:58,marginBottom:6}}>{hd.cs.length>0?hd.cs.map((c,i)=><BCard key={i} c={c}/>):<div style={{color:"#6a7a9a",fontSize:16}}>Aguardando...</div>}</div>
        <div className="cn" style={{fontSize:24,fontWeight:700,color:hd.tot===9?"#f5c842":"#eeeaf0"}}>{hd.tot}</div>
      </div>
    )}
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
      {[{k:"player",l:"Jogador ×2.02"},{k:"banker",l:"Banca ×2.02"},{k:"empate",l:"Empate ×9"}].map(p=>
        <button key={p.k} onClick={()=>setPick(p.k)} disabled={busy} className="btn-press" style={{flex:1,padding:"9px 8px",borderRadius:10,border:`2px solid ${pick===p.k?"#f5c842":"rgba(255,200,80,.2)"}`,background:pick===p.k?"rgba(245,200,66,.12)":"transparent",color:pick===p.k?"#f5c842":"#6a7a9a",fontFamily:"'Rajdhani',sans-serif",fontSize:14,fontWeight:700,cursor:busy?"not-allowed":"pointer"}}>{p.l}</button>
      )}
    </div>
    <WinMsg msg={msg} type={mT} prize={lastResult.prize} bet={lastResult.bet}/>
    <button onClick={play} disabled={busy} className="btn-press" style={{width:"100%",padding:"12px",border:"none",borderRadius:10,background:"linear-gradient(135deg,#f5c842,#e8a020)",color:"#000",fontFamily:"'Cinzel Decorative',serif",fontSize:16,fontWeight:700,cursor:busy?"not-allowed":"pointer",opacity:busy?.6:1}}>♠️ DISTRIBUIR</button>
    <QuickBets G={G} setG={setG} disabled={busy}/>
  </GameLayout>;
}
