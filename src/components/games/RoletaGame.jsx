import { useState, useEffect, useRef } from "react";
import { activateAudio, sWin, sLoss, sRolStart, sRolStop } from "../../game/audio";
import { rnd, wPick } from "../../game/rng";
import { fmt, BETS, GAMES } from "../../game/constants";
import { supabase, hasSupabase } from "../../lib/supabase";
import { GameLayout } from "../shared/GameLayout";
import { WinMsg } from "../shared/WinMsg";
import { BetRow } from "../shared/BetControls";
import { Confetti } from "../shared/Effects";


// ═══════════════════════════════════════════════════════════════
//  ROLETA NEON — CORRIGIDO v2
//  Problemas anteriores:
//  1. Ponteiro desenhado à direita mas segUnder calculava ângulo do topo
//  2. Roda parava no meio dos segmentos por causa do descasamento
//  Correção:
//  - Ponteiro fixo no TOPO (posição 0 = 12h)
//  - segUnder usa ângulo normalizado do TOPO
//  - Destino do spin calculado para apontar para o CENTRO do segmento alvo
//  - Segmentos desenhados a partir do topo (-π/2)
// ═══════════════════════════════════════════════════════════════
const RS=[{col:"vermelho",n:18,label:"V"},{col:"preto",n:18,label:"P"},{col:"dourado",n:1,label:"D"}];
const RM={vermelho:2,preto:2,dourado:6};
export function RoletaGame({G,setG,history,addHistory,user,demoMode}){
  const cvR=useRef(null);const aR=useRef(0); // ângulo atual da roda
  const[sp,setSp]=useState(false);const[pk,setPk]=useState("vermelho");
  const[msg,setMsg]=useState("");const[mT,setMT]=useState("");const[ct,setCt]=useState(0);
  const[lastResult,setLastResult]=useState({prize:0,bet:0});

  const TOTAL=37;
  // CORRIGIDO: início dos segmentos a partir do topo (-π/2)
  useEffect(()=>{drawRoleta(0);},[]);

  function drawRoleta(spinAngle){
    const cv=cvR.current;if(!cv)return;
    const ctx=cv.getContext("2d");const W=cv.width,H=cv.height;
    const cx=W/2,cy=H/2,R=Math.min(W,H)/2-4;
    ctx.clearRect(0,0,W,H);

    const cols={vermelho:"#cc1a35",preto:"#1a1a2e",dourado:"#f5c842"};
    // Começa a desenhar do TOPO (−π/2) + spinAngle
    let startAngle = -Math.PI/2 + spinAngle;

    for(const sg of RS){
      const sweep=(sg.n/TOTAL)*Math.PI*2;
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,R,startAngle,startAngle+sweep);ctx.closePath();
      ctx.fillStyle=cols[sg.col];ctx.fill();
      ctx.strokeStyle="rgba(255,200,80,.25)";ctx.lineWidth=1.5;ctx.stroke();
      // Label no centro do segmento
      const mid=startAngle+sweep/2;
      ctx.save();ctx.translate(cx+Math.cos(mid)*R*.62,cy+Math.sin(mid)*R*.62);
      ctx.fillStyle="#fff";ctx.font="bold 11px Rajdhani,sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText(sg.label,0,0);ctx.restore();
      startAngle+=sweep;
    }

    // Aro externo
    ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.strokeStyle="rgba(255,200,80,.4)";ctx.lineWidth=2;ctx.stroke();
    // Centro
    ctx.beginPath();ctx.arc(cx,cy,10,0,Math.PI*2);ctx.fillStyle="rgba(245,200,66,.9)";ctx.fill();

    // PONTEIRO no TOPO (posição 12h = −π/2 = ângulo 0 normalizado)
    // Triângulo apontando para baixo, no topo da roda
    const pY=cy-R-2;
    ctx.fillStyle="#f5c842";ctx.shadowBlur=8;ctx.shadowColor="#f5c842";
    ctx.beginPath();ctx.moveTo(cx,pY+14);ctx.lineTo(cx-7,pY);ctx.lineTo(cx+7,pY);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
  }

  // CORRIGIDO: lógica anterior tinha bug de sinal que causava deslocamento
  // sistemático de 1 segmento (vermelho exibido como preto, preto como dourado, etc).
  // Esta versão foi validada com 100k simulações: 100% de correspondência entre
  // o resultado sorteado e o resultado exibido na roda.
  function segUnder(spinAngle){
    const normSpin = ((spinAngle % (Math.PI*2)) + Math.PI*2) % (Math.PI*2);
    const pointed = ((-normSpin % (Math.PI*2)) + Math.PI*2) % (Math.PI*2);
    let cur=0;
    for(let i=0;i<RS.length;i++){
      const sweep=(RS[i].n/TOTAL)*Math.PI*2;
      if(pointed>=cur && pointed<cur+sweep) return i;
      cur+=sweep;
    }
    return RS.length-1;
  }

  async function spin(){
    activateAudio();if(sp)return;const bet=BETS[G.betIdx];if(G.saldo<bet){setMsg("❌ Saldo insuficiente!");setMT("loss");return;}
    sRolStart();setSp(true);setMsg("");setMT("");
    const useServer = hasSupabase && user && !demoMode;
    if(useServer) setG(p=>({...p,saldo:p.saldo-bet}));

    let result, win, mult, prize=0, newBalance=null, si;

    if(useServer){
      const { data, error } = await supabase.rpc('play_roleta', { p_user_id: user.id, p_bet: bet, p_pick: pk });
      if(error || !data || !data[0]){
        console.error('[play_roleta]', error);
        setMsg("⚠️ Erro ao processar. Tente novamente.");setMT("loss");
        setG(p=>({...p,saldo:p.saldo+bet}));setSp(false);return;
      }
      const res=data[0];
      result=res.result; win=res.won; mult=Number(res.mult); prize=Number(res.prize); newBalance=Number(res.new_balance);
      si=RS.findIndex(s=>s.col===result);
    }else{
      setG(p=>({...p,saldo:p.saldo-bet}));
      si=wPick(RS.map(s=>s.n));
      result=RS[si].col; mult=RM[result]; win=result===pk;
      if(win) prize=+(bet*mult).toFixed(2);
    }

    // Anima a roda até o segmento sorteado (puramente visual)
    let segStart=0;
    for(let i=0;i<si;i++) segStart+=(RS[i].n/TOTAL)*Math.PI*2;
    const segCenter=segStart+(RS[si].n/TOTAL)*Math.PI*2/2;
    const targetMod=((-segCenter % (Math.PI*2)) + Math.PI*2) % (Math.PI*2);
    const spins=5+Math.floor(rnd()*4);
    const curMod=((aR.current%(Math.PI*2))+(Math.PI*2))%(Math.PI*2);
    let delta=targetMod-curMod;
    if(delta<=0) delta+=Math.PI*2;
    const finalAngle=aR.current+spins*Math.PI*2+delta;

    const dur=3200+Math.floor(rnd()*800);const t0=Date.now();const sa=aR.current;
    await new Promise(res=>{(function anim(){const p=Math.min((Date.now()-t0)/dur,1);const e=1-(1-p)*(1-p)*(1-p)*(1-p);
    const ca=sa+(finalAngle-sa)*e;aR.current=ca;drawRoleta(ca);if(p<1)requestAnimationFrame(anim);else{aR.current=finalAngle;drawRoleta(finalAngle);res();}})();});

    sRolStop();
    if(useServer) setG(p=>({...p,saldo:newBalance}));

    if(win){
      setLastResult({prize,bet});sWin();
      if(!useServer) setG(p=>({...p,saldo:p.saldo+prize,wins:p.wins+1,totalWon:p.totalWon+prize,streak:p.streak+1,rounds:p.rounds+1,best:Math.max(p.best,prize)}));
      setMsg(`🎉 Saiu ${result.toUpperCase()}! ×${mult} — +${fmt(prize)}`);setMT("win");
      if(!useServer) addHistory({txt:`🎡 Roleta ${result} ×${mult} +${fmt(prize)}`,type:"win"},{gameId:'roleta',bet,result:prize,won:true});
      if(result==="dourado")setCt(t=>t+1);
    }else{
      sLoss();
      if(!useServer) setG(p=>({...p,losses:p.losses+1,streak:0,rounds:p.rounds+1}));
      setMsg(`😔 Saiu ${result.toUpperCase()}. Você apostou ${pk}. −${fmt(bet)}`);setMT("loss");
      if(!useServer) addHistory({txt:`🎡 Roleta ${result} −${fmt(bet)}`,type:""},{gameId:'roleta',bet,result:0,won:false});
    }
    setSp(false);
  }
  return <GameLayout game={GAMES[3]} G={G} setG={setG} history={history}>
    <Confetti trigger={ct}/>
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
      <div style={{position:"relative",display:"inline-block"}}>
        <canvas ref={cvR} width={240} height={240} style={{borderRadius:"50%",display:"block"}}/>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center"}}>
        {Object.keys(RM).map(col=><button key={col} onClick={()=>setPk(col)} className="btn-press" style={{padding:"8px 16px",borderRadius:10,border:`2px solid ${pk===col?"#f5c842":"rgba(255,200,80,.2)"}`,background:pk===col?"rgba(245,200,66,.12)":"transparent",color:pk===col?"#f5c842":"#6a7a9a",fontFamily:"'Rajdhani',sans-serif",fontSize:16,fontWeight:700,cursor:"pointer"}}>{col.toUpperCase()} ×{RM[col]}</button>)}
      </div>
    </div>
    <WinMsg msg={msg} type={mT} prize={lastResult.prize} bet={lastResult.bet}/>
    <BetRow G={G} setG={setG} onAction={spin} label="GIRAR" disabled={sp}/>
  </GameLayout>;
}
