import { useState, useRef } from "react";
import { activateAudio, sWin, sLoss, sCard } from "../../game/audio";
import { rnd } from "../../game/rng";
import { fmt, BETS, GAMES } from "../../game/constants";
import { supabase, hasSupabase } from "../../lib/supabase";
import { GameLayout } from "../shared/GameLayout";
import { WinMsg } from "../shared/WinMsg";
import { BetRow } from "../shared/BetControls";

const N_TOTAL=50, N_ESCOLHER=5, N_SORTEADOS=20;
const MULT_POR_ACERTO={3:1.5,4:3.75,5:40};

function sortLocal(){
  const nums=Array.from({length:N_TOTAL},(_,i)=>i+1);
  for(let i=nums.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[nums[i],nums[j]]=[nums[j],nums[i]];}
  return nums.slice(0,N_SORTEADOS);
}

// ═══ BINGO RELÂMPAGO — RTP ≈90.1% (probabilidade real, não peso arbitrário) ═
// 5 números escolhidos, 20 sorteados de 50 sem reposição.
export function BingoGame({G,setG,history,addHistory,user,demoMode}){
  const[picks,setPicks]=useState([]);
  const[busy,setBusy]=useState(false);
  const busyR=useRef(false);
  const[sorteados,setSorteados]=useState([]);
  const[acertos,setAcertos]=useState(null);
  const[msg,setMsg]=useState("");const[mT,setMT]=useState("");
  const[lastResult,setLastResult]=useState({prize:0,bet:0});

  function toggle(n){
    if(busy)return;
    setPicks(p=>p.includes(n)?p.filter(x=>x!==n):(p.length<N_ESCOLHER?[...p,n]:p));
  }

  async function play(){
    if(busyR.current||picks.length!==N_ESCOLHER)return;
    busyR.current=true;
    try{
    activateAudio();const bet=BETS[G.betIdx];if(G.saldo<bet){setMsg("❌ Saldo insuficiente!");setMT("loss");busyR.current=false;return;}
    setBusy(true);setSorteados([]);setAcertos(null);setMsg("");setMT("");sCard();
    const useServer = hasSupabase && user && !demoMode;

    let resultSorteados,resultAcertos,resultMult,win,prize=0,newBalance=null;

    if(useServer){
      const { data, error } = await supabase.rpc('play_bingo', { p_user_id: user.id, p_bet: bet, p_numeros: picks });
      if(error || !data || !data[0]){
        console.error('[play_bingo]', error);
        setMsg("⚠️ Erro ao processar. Tente novamente.");setMT("loss");setBusy(false);busyR.current=false;return;
      }
      const res=data[0];
      resultSorteados=res.sorteados; resultAcertos=res.acertos; resultMult=Number(res.multiplicador); win=res.won; prize=Number(res.prize); newBalance=Number(res.new_balance);
    }else{
      setG(p=>({...p,saldo:p.saldo-bet}));
      resultSorteados=sortLocal();
      resultAcertos=picks.filter(n=>resultSorteados.includes(n)).length;
      resultMult=MULT_POR_ACERTO[resultAcertos]||0;
      win=resultMult>0;
      if(win)prize=+(bet*resultMult).toFixed(2);
    }

    await new Promise(r=>setTimeout(r,1200)); // tempo da "cortina" do sorteio
    setSorteados(resultSorteados);setAcertos(resultAcertos);

    if(useServer) setG(p=>({...p,saldo:newBalance}));
    if(win){
      setLastResult({prize,bet});sWin();
      if(!useServer) setG(p=>({...p,saldo:p.saldo+prize,wins:p.wins+1,totalWon:p.totalWon+prize,rounds:p.rounds+1,best:Math.max(p.best,prize)}));
      setMsg(`🎉 ${resultAcertos} acertos! ×${resultMult} — +${fmt(prize)}`);setMT("win");
      if(!useServer) addHistory({txt:`🔴 Bingo ${resultAcertos} acertos +${fmt(prize)}`,type:"win"},{gameId:'bingo',bet,result:prize,won:true});
    }else{
      sLoss();
      if(!useServer) setG(p=>({...p,losses:p.losses+1,rounds:p.rounds+1}));
      setMsg(`😔 Só ${resultAcertos} acerto${resultAcertos===1?"":"s"} — precisa de 3+. −${fmt(bet)}`);setMT("loss");
      if(!useServer) addHistory({txt:`🔴 Bingo ${resultAcertos} acertos −${fmt(bet)}`,type:""},{gameId:'bingo',bet,result:0,won:false});
    }
    setBusy(false);setPicks([]);

    }finally{busyR.current=false;}
  }

  return <GameLayout game={GAMES.find(g=>g.id==='bingo')} G={G} setG={setG} history={history}>
    <div style={{textAlign:"center",fontSize:13,color:"#6a7a9a",marginBottom:4}}>
      Escolha {N_ESCOLHER} números ({picks.length}/{N_ESCOLHER}) — pague com 3, 4 ou 5 acertos entre os {N_SORTEADOS} sorteados
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(10,1fr)",gap:5,padding:"8px 0"}}>
      {Array.from({length:N_TOTAL},(_,i)=>i+1).map(n=>{
        const picked=picks.includes(n);
        const drawn=sorteados.includes(n);
        const hit=drawn&&picked;
        return <button key={n} onClick={()=>toggle(n)} disabled={busy} className="btn-press" style={{aspectRatio:"1",fontSize:12,fontWeight:700,borderRadius:6,border:`1px solid ${hit?"rgba(0,229,176,.6)":picked?"rgba(245,200,66,.5)":drawn?"rgba(77,166,255,.4)":"rgba(255,200,80,.1)"}`,background:hit?"rgba(0,229,176,.2)":picked?"rgba(245,200,66,.15)":drawn?"rgba(77,166,255,.12)":"rgba(12,18,38,.6)",color:hit?"#00e5b0":picked?"#f5c842":drawn?"#4da6ff":"#6a7a9a",cursor:busy?"not-allowed":"pointer"}}>{n}</button>;
      })}
    </div>
    {acertos!==null&&<div style={{textAlign:"center",fontSize:15,color:"#f5c842",fontWeight:700}}>{acertos} de {N_ESCOLHER} números bateram!</div>}
    <WinMsg msg={msg} type={mT} prize={lastResult.prize} bet={lastResult.bet}/>
    <BetRow G={G} setG={setG} onAction={play} label={`🔴 SORTEAR (${picks.length}/${N_ESCOLHER})`} disabled={busy||picks.length!==N_ESCOLHER}/>
  </GameLayout>;
}
