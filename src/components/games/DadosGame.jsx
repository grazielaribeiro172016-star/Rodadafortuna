import { useState } from "react";
import { activateAudio, sWin, sLoss, sDice } from "../../game/audio";
import { rnd } from "../../game/rng";
import { sleep, fmt, BETS, GAMES } from "../../game/constants";
import { supabase, hasSupabase } from "../../lib/supabase";
import { GameLayout } from "../shared/GameLayout";
import { WinMsg } from "../shared/WinMsg";
import { BetRow } from "../shared/BetControls";


// ═══ DADOS DA SORTE — auditado, correto ════════════════════════
const DC=[50,35,25];const DM=[1.90,2.71,3.80];const DL=["Fácil ≤50","Médio ≤35","Difícil ≤25"];
export function DadosGame({G,setG,history,addHistory,user,demoMode}){
  const[risk,setRisk]=useState(0);const[roll,setRoll]=useState(false);const[num,setNum]=useState(null);
  const[msg,setMsg]=useState("");const[mT,setMT]=useState("");
  const[lastResult,setLastResult]=useState({prize:0,bet:0});
  async function doRoll(){
    activateAudio();const bet=BETS[G.betIdx];if(G.saldo<bet){setMsg("❌ Saldo insuficiente!");setMT("loss");return;}
    sDice();setRoll(true);setMsg("");setMT("");
    const useServer = hasSupabase && user && !demoMode;
    if(useServer) setG(p=>({...p,saldo:p.saldo-bet}));
    for(let i=0;i<14;i++){setNum(Math.floor(rnd()*100)+1);await sleep(55);}

    let r, w, m, prize=0;
    if(useServer){
      const { data, error } = await supabase.rpc('play_dados', { p_user_id: user.id, p_bet: bet, p_risk: risk });
      if(error || !data || !data[0]){
        console.error('[play_dados]', error);
        setMsg("⚠️ Erro ao processar. Tente novamente.");setMT("loss");
        setG(p=>({...p,saldo:p.saldo+bet}));setRoll(false);return;
      }
      const res=data[0]; r=res.rolled; w=res.won; m=Number(res.mult); prize=Number(res.prize);
      setG(p=>({...p,saldo:Number(res.new_balance)}));
    }else{
      setG(p=>({...p,saldo:p.saldo-bet}));
      r=Math.floor(rnd()*100)+1; const ch=DC[risk]; m=DM[risk]; w=r<=ch;
      const sb=G.streak>=5?.1:0;
      if(w) prize=+(bet*m*(1+sb)).toFixed(2);
    }
    setNum(r);
    if(w){
      setLastResult({prize,bet});sWin();
      if(!useServer) setG(p=>({...p,saldo:p.saldo+prize,wins:p.wins+1,totalWon:p.totalWon+prize,streak:p.streak+1,rounds:p.rounds+1,best:Math.max(p.best,prize)}));
      setMsg(`🎲 ${r} ≤ ${DC[risk]} — GANHOU! +${fmt(prize)} (×${m})`);setMT("win");
      if(!useServer) addHistory({txt:`🎲 Dado ${r} ≤${DC[risk]} +${fmt(prize)}`,type:"win"},{gameId:'dados',bet,result:prize,won:true});
    }else{
      sLoss();
      if(!useServer) setG(p=>({...p,losses:p.losses+1,streak:0,rounds:p.rounds+1}));
      setMsg(`🎲 ${r} > ${DC[risk]} — perdeu. −${fmt(bet)}`);setMT("loss");
      if(!useServer) addHistory({txt:`❌ Dado −${fmt(bet)}`,type:""},{gameId:'dados',bet,result:0,won:false});
    }
    setRoll(false);
  }
  return <GameLayout game={GAMES[4]} G={G} setG={setG} history={history}>
    <div style={{display:"flex",justifyContent:"center",alignItems:"center",minHeight:120}}>
      <div className="cn" style={{fontSize:106,fontWeight:900,color:num!==null?(roll?"#6a7a9a":num<=DC[risk]?"#2dde98":"#ff3d5a"):"#6a7a9a",transition:"color .2s",textShadow:num!==null&&!roll?(num<=DC[risk]?"0 0 30px rgba(45,222,152,.5)":"0 0 30px rgba(255,61,90,.4)"):"none"}}>{num!==null?num:"?"}</div>
    </div>
    <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
      {DL.map((l,i)=><button key={i} onClick={()=>setRisk(i)} className="btn-press" style={{padding:"8px 14px",borderRadius:10,border:`2px solid ${risk===i?"#f5c842":"rgba(255,200,80,.2)"}`,background:risk===i?"rgba(245,200,66,.12)":"transparent",color:risk===i?"#f5c842":"#6a7a9a",fontFamily:"'Rajdhani',sans-serif",fontSize:15,fontWeight:700,cursor:"pointer",textAlign:"center"}}>{l}<br/><span style={{color:"#2dde98",fontSize:17}}>×{DM[i]}</span></button>)}
    </div>
    <WinMsg msg={msg} type={mT} prize={lastResult.prize} bet={lastResult.bet}/>
    <BetRow G={G} setG={setG} onAction={doRoll} label="ROLAR" disabled={roll}/>
  </GameLayout>;
}
