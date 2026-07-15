import { useState } from "react";
import { activateAudio, sWin, sLoss, sCard } from "../../game/audio";
import { rnd } from "../../game/rng";
import { fmt, BETS, GAMES } from "../../game/constants";
import { supabase, hasSupabase } from "../../lib/supabase";
import { GameLayout } from "../shared/GameLayout";
import { WinMsg } from "../shared/WinMsg";
import { BetRow } from "../shared/BetControls";

// ═══ SORTE NUMÉRICA — Baixo/Alto: RTP 90.6% | Exato: RTP 85% ═══
export function NumeroGame({G,setG,history,addHistory,user,demoMode}){
  const[tipo,setTipo]=useState("baixo");const[valor,setValor]=useState(7);const[busy,setBusy]=useState(false);
  const[sorteado,setSorteado]=useState(null);
  const[msg,setMsg]=useState("");const[mT,setMT]=useState("");
  const[lastResult,setLastResult]=useState({prize:0,bet:0});

  async function play(){
    activateAudio();const bet=BETS[G.betIdx];if(G.saldo<bet){setMsg("❌ Saldo insuficiente!");setMT("loss");return;}
    setBusy(true);setMsg("");setMT("");setSorteado(null);sCard();
    const useServer = hasSupabase && user && !demoMode;

    let num,win,mult,prize=0,newBalance=null;

    if(useServer){
      const { data, error } = await supabase.rpc('play_numero', { p_user_id: user.id, p_bet: bet, p_tipo: tipo, p_valor: tipo==='exato'?valor:null });
      if(error || !data || !data[0]){
        console.error('[play_numero]', error);
        setMsg("⚠️ Erro ao processar. Tente novamente.");setMT("loss");setBusy(false);return;
      }
      const res=data[0];
      num=res.sorteado; win=res.won; prize=Number(res.prize); newBalance=Number(res.new_balance);
      mult=bet>0?(prize/bet):0;
    }else{
      setG(p=>({...p,saldo:p.saldo-bet}));
      num=Math.floor(rnd()*100)+1;
      if(tipo==='baixo'){win=num>=1&&num<=49;mult=1.85;}
      else if(tipo==='alto'){win=num>=51&&num<=100;mult=1.85;}
      else{win=num===valor;mult=85;}
      if(win) prize=+(bet*mult).toFixed(2);
    }

    // pequena contagem regressiva visual antes de revelar
    for(let i=0;i<6;i++){
      await new Promise(r=>setTimeout(r,80));
      setSorteado(Math.floor(rnd()*100)+1);
    }
    await new Promise(r=>setTimeout(r,150));
    setSorteado(num);

    if(useServer) setG(p=>({...p,saldo:newBalance}));
    if(win){
      setLastResult({prize,bet});sWin();
      if(!useServer) setG(p=>({...p,saldo:p.saldo+prize,wins:p.wins+1,totalWon:p.totalWon+prize,streak:p.streak+1,rounds:p.rounds+1,best:Math.max(p.best,prize)}));
      setMsg(`🎉 Saiu ${num}! +${fmt(prize)}`);setMT("win");
      if(!useServer) addHistory({txt:`🔢 Número ${num} +${fmt(prize)}`,type:"win"},{gameId:'numero',bet,result:prize,won:true});
    }else{
      sLoss();
      if(!useServer) setG(p=>({...p,losses:p.losses+1,streak:0,rounds:p.rounds+1}));
      setMsg(`😔 Saiu ${num}. −${fmt(bet)}`);setMT("loss");
      if(!useServer) addHistory({txt:`🔢 Número ${num} −${fmt(bet)}`,type:""},{gameId:'numero',bet,result:0,won:false});
    }
    setBusy(false);
  }

  return <GameLayout game={GAMES.find(g=>g.id==='numero')} G={G} setG={setG} history={history}>
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14,padding:"16px 0"}}>
      <div className="cn" style={{fontSize:64,fontWeight:700,color:sorteado?(tipo==='exato'?(sorteado===valor?"#00e5b0":"#eeeaf0"):((tipo==='baixo'&&sorteado<=49)||(tipo==='alto'&&sorteado>=51)?"#00e5b0":"#eeeaf0")):"#6a7a9a"}}>
        {sorteado ?? "—"}
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center"}}>
        {[{k:"baixo",l:"Baixo (1-49) ×1.85"},{k:"alto",l:"Alto (51-100) ×1.85"},{k:"exato",l:"Exato ×85"}].map(t=>
          <button key={t.k} onClick={()=>setTipo(t.k)} disabled={busy} className="btn-press" style={{padding:"9px 14px",borderRadius:10,border:`2px solid ${tipo===t.k?"#f5c842":"rgba(255,200,80,.2)"}`,background:tipo===t.k?"rgba(245,200,66,.12)":"transparent",color:tipo===t.k?"#f5c842":"#6a7a9a",fontFamily:"'Rajdhani',sans-serif",fontSize:14,fontWeight:700,cursor:busy?"not-allowed":"pointer"}}>{t.l}</button>
        )}
      </div>
      {tipo==='exato' && (
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:14,color:"#6a7a9a"}}>Seu número:</span>
          <input type="number" min={1} max={100} value={valor} disabled={busy}
            onChange={e=>setValor(Math.min(100,Math.max(1,Number(e.target.value)||1)))}
            style={{width:70,padding:"7px 10px",borderRadius:8,border:"1px solid rgba(255,200,80,.3)",background:"rgba(12,18,38,.9)",color:"#f5c842",fontSize:16,fontWeight:700,textAlign:"center"}}/>
        </div>
      )}
      <div style={{fontSize:12.5,color:"#6a7a9a"}}>O número 50 fica com a casa — não conta pra Baixo nem Alto.</div>
    </div>
    <WinMsg msg={msg} type={mT} prize={lastResult.prize} bet={lastResult.bet}/>
    <BetRow G={G} setG={setG} onAction={play} label="🔢 SORTEAR" disabled={busy}/>
  </GameLayout>;
}
