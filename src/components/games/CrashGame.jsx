import { useState, useEffect, useRef } from "react";
import { activateAudio, sLoss, sCash, sCrashStart, sCrashStop } from "../../game/audio";
import { rnd } from "../../game/rng";
import { fmt, BETS, GAMES } from "../../game/constants";
import { GameLayout } from "../shared/GameLayout";
import { WinMsg } from "../shared/WinMsg";
import { supabase, hasSupabase } from "../../lib/supabase";
import { QuickBets } from "../shared/BetControls";


// ═══════════════════════════════════════════════════════════════
//  CRASH AVIÃO — CORRIGIDO v3
//  Correção anterior (v2): cap de crash em 50x, mínimo rnd() etc.
//  Correção NOVA (v3): trava de "fonte única de verdade" no cashout.
//
//  O BUG: existiam dois relógios em paralelo —
//    1) pollServer() -> pergunta "já crashou?" a cada 180ms (crash_peek)
//    2) cashOut()     -> pede o saque de verdade (crash_cashout)
//  Se uma chamada de crash_peek já estava "em voo" (esperando rede) no
//  exato momento em que o jogador clicava em SACAR, ela podia responder
//  DEPOIS do crash_cashout e sobrescrever o estado/mensagem corretos
//  com um valor desatualizado. Isso é uma corrida de rede, não um
//  problema de relógio do aparelho.
//
//  A CORREÇÃO: uma trava (cashingR) que é ligada no instante do clique
//  em SACAR. A partir daí, qualquer resposta do pollServer que chegue
//  depois é simplesmente ignorada — só o crash_cashout pode mudar o
//  estado daquele round. A trava é desligada quando o round termina
//  (sucesso, erro, ou início de um novo round).
// ═══════════════════════════════════════════════════════════════
export function CrashGame({G,setG,history,addHistory,user,demoMode}){
  const[cr,setCr]=useState({running:false,betIn:false,mult:1,crashAt:1,betAmt:0,roundId:null});
  const[msg,setMsg]=useState("");const[mT,setMT]=useState("");
  const[lastResult,setLastResult]=useState({prize:0,bet:0});
  const cvR=useRef(null);const rafR=useRef(null);const visRafR=useRef(null);const t0R=useRef(0);const crR=useRef(cr);const busyR=useRef(false);
  const cashingR=useRef(false); // trava: true a partir do clique em SACAR até a resposta do crash_cashout
  const[stuck,setStuck]=useState(false);
  crR.current=cr;

  // RTP alvo: ~93% (house edge 7%), dentro do range 92-94% definido pelo operador
  function genCrash(){
    const u=Math.max(rnd(), 0.019); // garante crash <= 50×
    return Math.max(1.01, Math.min(50.0, Math.floor(0.93/u*100)/100));
  }

  function draw(m,crashed){
    const cv=cvR.current;if(!cv)return;const ctx=cv.getContext("2d");const W=cv.width,H=cv.height;ctx.clearRect(0,0,W,H);
    const maxM=Math.max(m*1.4,2);const el=(Date.now()-t0R.current)/1000;
    ctx.strokeStyle=crashed?"rgba(255,61,90,.8)":"rgba(0,229,176,.8)";ctx.lineWidth=2.5;ctx.beginPath();
    const pts=Math.max(20,Math.floor(el*20));
    for(let i=0;i<=pts;i++){const t=el*(i/pts);const mv=Math.pow(Math.E,t*.12);const x=(i/pts)*W;const y=H-(Math.log(mv)/Math.log(maxM))*H*.82;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}
    ctx.stroke();ctx.fillStyle=crashed?"rgba(255,61,90,.06)":"rgba(0,229,176,.06)";ctx.fill();
    if(!crashed){const cy=Math.max(18,H-(Math.log(m)/Math.log(maxM))*H*.82);ctx.fillStyle="#00e5b0";ctx.shadowBlur=12;ctx.shadowColor="#00e5b0";ctx.beginPath();ctx.arc(W-6,cy,7,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
  }

  // Modo LOCAL (visitante, sem login): calcula tudo no navegador, como antes.
  function loop(){
    const el=(Date.now()-t0R.current)/1000;const m=Math.floor(Math.pow(Math.E,el*.12)*100)/100;const c=crR.current;
    if(m>=c.crashAt){
      setCr(p=>({...p,running:false,mult:c.crashAt}));draw(c.crashAt,true);sCrashStop();
      const bet=c.betAmt;
      if(c.betIn){sLoss();setG(p=>({...p,losses:p.losses+1,streak:0,rounds:p.rounds+1}));setMsg(`💥 Crash em ×${c.crashAt.toFixed(2)}! −${fmt(bet)}`);setMT("loss");addHistory({txt:`✈️ Crash ×${c.crashAt} −${fmt(bet)}`,type:""},{gameId:'crash',bet,result:0,won:false});setCr(p=>({...p,betIn:false}));}
      else{setMsg(`💥 Crash em ×${c.crashAt.toFixed(2)}! (sem aposta ativa)`);setMT("loss");}
      return;
    }
    setCr(p=>({...p,mult:m}));draw(m,false);rafR.current=requestAnimationFrame(loop);
  }

  // Modo SERVIDOR (logado): o ponto de crash fica escondido no banco.
  // A cada ~180ms perguntamos pro servidor "já crashou? qual o multiplicador
  // atual?" — o navegador nunca sabe o crash_at de antemão, só descobre
  // quando o servidor confirma que já aconteceu.
  // Loop VISUAL — roda a 60 quadros/segundo só pra desenhar suave (a mesma
  // fórmula que o servidor usa, então visualmente bate certinho). Não decide
  // nada sobre dinheiro — quem manda de verdade é o pollServer() ao lado.
  function visualLoop(){
    if(!crR.current.running || cashingR.current) return;
    const el=(Date.now()-t0R.current)/1000;
    const m=Math.floor(Math.pow(Math.E, el*.12)*100)/100;
    setCr(p=>p.running?{...p,mult:m}:p);
    draw(m,false);
    visRafR.current=requestAnimationFrame(visualLoop);
  }

  function pollServer(roundId){
    (async()=>{
      const rid=roundId || crR.current.roundId;
      if(!rid){return;}
      const { data, error } = await supabase.rpc('crash_peek', { p_user_id: user.id, p_round_id: rid });
      // ── TRAVA DE FONTE ÚNICA DE VERDADE ──────────────────────────
      // Se o jogador já clicou em SACAR (cashingR.current === true) ou
      // se o round mudou enquanto esperávamos essa resposta, ela chegou
      // atrasada e não vale mais nada — quem manda agora é o retorno
      // do crash_cashout, não este peek. Descarta e não agenda mais.
      if(cashingR.current || crR.current.roundId!==rid){ return; }
      if(error || !data || !data[0]){ rafR.current=requestAnimationFrame(()=>pollServer(rid)); return; }
      const r=data[0];
      if(r.crashed){
        if(visRafR.current)cancelAnimationFrame(visRafR.current);
        setCr(p=>({...p,running:false,mult:Number(r.crash_at)}));draw(Number(r.crash_at),true);sCrashStop();
        const c=crR.current;
        if(c.betIn){
          setMsg(`💥 Crash em ×${Number(r.crash_at).toFixed(2)}! −${fmt(c.betAmt)}`);setMT("loss");
          if(r.new_balance!=null) setG(p=>({...p,saldo:Number(r.new_balance),losses:p.losses+1,streak:0,rounds:p.rounds+1}));
          else setG(p=>({...p,losses:p.losses+1,streak:0,rounds:p.rounds+1}));
          setCr(p=>({...p,betIn:false}));
        }
        return;
      }
      rafR.current=setTimeout(()=>pollServer(rid), 180);
    })();
  }

  // CORRIGIDO: a aposta agora é feita ANTES de decolar — elimina a brecha onde
  // o jogador podia decolar sem apostar, observar o multiplicador subir sem risco,
  // e só apostar+sacar depois de já saber que o avião ainda não tinha crashado.
  async function placeBetAndFly(){
    if(busyR.current)return;
    busyR.current=true;
    try{
    activateAudio();
    sCrashStop(); // garante que nenhum som de voo anterior fique preso tocando
    if(cr.running)return;
    cashingR.current=false; // novo round: destrava (round anterior já terminou)
    const b=BETS[G.betIdx];
    if(G.saldo<b){setMsg("❌ Saldo insuficiente!");setMT("loss");return;}
    const useServer = hasSupabase && user && !demoMode;

    if(useServer){
      const { data, error } = await supabase.rpc('crash_start', { p_user_id: user.id, p_bet: b });
      if(error || !data || !data[0]){
        console.error('[crash_start]',error);
        if(error?.message?.includes('em andamento')){setStuck(true);setMsg("⚠️ Rodada anterior travada detectada.");}
        else{setMsg("⚠️ Erro ao decolar. Tente novamente.");}
        setMT("loss");return;
      }
      const r=data[0];
      setG(p=>({...p,saldo:p.saldo-b}));
      t0R.current=new Date(r.started_at).getTime();
      setCr({running:true,betIn:true,mult:1.00,crashAt:0,betAmt:b,roundId:r.round_id});
      setMsg(`✅ Apostou ${fmt(b)} — saque antes do crash!`);setMT("teal");
      sCrashStart();
      pollServer(r.round_id);
      visRafR.current=requestAnimationFrame(visualLoop);
      return;
    }

    setG(p=>({...p,saldo:p.saldo-b}));
    const ca=genCrash();
    t0R.current=Date.now();
    setCr({running:true,betIn:true,mult:1.00,crashAt:ca,betAmt:b,roundId:null});
    setMsg(`✅ Apostou ${fmt(b)} — saque antes do crash!`);setMT("teal");
    sCrashStart();
    rafR.current=requestAnimationFrame(loop);
  
    }finally{busyR.current=false;}
  }

  async function cashOut(){
    if(busyR.current)return;
    busyR.current=true;
    try{
    if(!cr.running||!cr.betIn)return;
    activateAudio();
    const useServer = hasSupabase && user && !demoMode;

    if(useServer){
      // A PARTIR DAQUI, só o retorno do crash_cashout manda no estado deste
      // round. Qualquer resposta atrasada do pollServer será ignorada (ver
      // trava dentro de pollServer). Também paramos os dois loops locais
      // imediatamente, pra tela não continuar "correndo" enquanto esperamos
      // a confirmação de verdade.
      cashingR.current=true;
      if(rafR.current){clearTimeout(rafR.current);cancelAnimationFrame(rafR.current);}
      if(visRafR.current)cancelAnimationFrame(visRafR.current);
      setCr(p=>({...p,betIn:false})); // impede novo clique em SACAR; mult fica congelado
      setMsg("⏳ Confirmando saque...");setMT("teal");

      try{
        const { data, error } = await supabase.rpc('crash_cashout', { p_user_id: user.id, p_round_id: cr.roundId });
        if(error || !data || !data[0]){
          console.error('[crash_cashout]',error);
          setMsg("⚠️ Erro ao sacar. Tente novamente.");setMT("loss");
          return;
        }
        const r=data[0];
        // A partir daqui, r.mult / r.crash_at (vindos do servidor) são os
        // ÚNICOS números usados — nunca o cr.mult calculado localmente.
        if(r.won){
          sCrashStop();sCash();
          setCr(p=>({...p,betIn:false,running:false,mult:Number(r.mult)}));
          draw(Number(r.mult),false);
          setLastResult({prize:r.prize,bet:cr.betAmt});
          setG(p=>({...p,saldo:r.new_balance,wins:p.wins+1,totalWon:p.totalWon+r.prize,streak:p.streak+1,rounds:p.rounds+1,best:Math.max(p.best,r.prize)}));
          setMsg(`🎉 Sacou em ×${Number(r.mult).toFixed(2)} — +${fmt(r.prize)}!`);setMT("win");
          addHistory({txt:`✈️ Cashout ×${Number(r.mult).toFixed(2)} +${fmt(r.prize)}`,type:"win"},{gameId:'crash',bet:cr.betAmt,result:r.prize,won:true});
        }else{
          sLoss();sCrashStop();
          setCr(p=>({...p,betIn:false,running:false,mult:Number(r.crash_at)}));
          draw(Number(r.crash_at),true);
          setG(p=>({...p,saldo:r.new_balance,losses:p.losses+1,streak:0,rounds:p.rounds+1}));
          setMsg(`💥 Já tinha crashado em ×${Number(r.crash_at).toFixed(2)}! −${fmt(cr.betAmt)}`);setMT("loss");
          addHistory({txt:`💥 Crash ×${Number(r.crash_at).toFixed(2)} −${fmt(cr.betAmt)}`,type:""},{gameId:'crash',bet:cr.betAmt,result:0,won:false});
        }
      } finally {
        cashingR.current=false; // round encerrado, destrava para o próximo
      }
      return;
    }

    sCash();sCrashStop();if(rafR.current)cancelAnimationFrame(rafR.current);const b=cr.betAmt;const prize=+(b*cr.mult).toFixed(2);setLastResult({prize,bet:b});setG(p=>({...p,saldo:p.saldo+prize,wins:p.wins+1,totalWon:p.totalWon+prize,streak:p.streak+1,rounds:p.rounds+1,best:Math.max(p.best,prize)}));setCr(p=>({...p,betIn:false,running:false}));setMsg(`🎉 Sacou em ×${cr.mult.toFixed(2)} — +${fmt(prize)}!`);setMT("win");addHistory({txt:`✈️ Cashout ×${cr.mult.toFixed(2)} +${fmt(prize)}`,type:"win"},{gameId:'crash',bet:b,result:prize,won:true});
  
    }finally{busyR.current=false;}
  }
  useEffect(()=>()=>{if(rafR.current){cancelAnimationFrame(rafR.current);clearTimeout(rafR.current);}if(visRafR.current)cancelAnimationFrame(visRafR.current);sCrashStop();},[]);

  const multColor=cr.mult>=3?"#f5c842":cr.mult>=2?"#00e5b0":"#eeeaf0";
  async function unstick(){
    if(!user) return;
    setStuck(false);
    cashingR.current=false;
    const { error } = await supabase.rpc('abandon_round', { p_user_id: user.id, p_game: 'crash' });
    if(error){console.error('[abandon_round]',error);setMsg("⚠️ Não consegui cancelar. Tente de novo em alguns segundos.");setMT("loss");return;}
    setMsg("🔓 Rodada travada cancelada — pode jogar de novo!");setMT("");
  }

  return <GameLayout game={GAMES[1]} G={G} setG={setG} history={history}>
    <div style={{background:"rgba(5,7,15,.9)",borderRadius:14,padding:12,border:"1px solid rgba(255,200,80,.15)"}}>
      <canvas ref={cvR} width={340} height={200} style={{width:"100%",maxWidth:340,borderRadius:10,background:"rgba(5,7,15,.8)"}}/>
      <div className="cn" style={{textAlign:"center",fontSize:69,fontWeight:700,color:cr.running?multColor:"#6a7a9a",textShadow:cr.running?`0 0 30px ${multColor}80`:"none",marginTop:8,transition:"color .3s"}}>{cr.mult.toFixed(2)}×</div>
      <div style={{textAlign:"center",fontSize:15,color:"#6a7a9a",marginTop:4}}>{cr.running?(cr.betIn?"⚡ Aposta ativa — SAQUE AGORA!":"⏳ Confirmando..."):"🛫 Aposte para decolar"}</div>
      {/* Probabilidade de crash */}
      <div style={{textAlign:"center",fontSize:14,color:"rgba(255,61,90,.6)",marginTop:4}}>
        {cr.running?`⚠️ Risco de crash: ~${Math.min(99,Math.round((1-0.93/Math.max(cr.mult,1.01))*100))}%`:"📊 ~53% crasham antes de 2× | ~78% sobrevivem até 1.2×"}
      </div>
    </div>
    <WinMsg msg={msg} type={mT} prize={lastResult.prize} bet={lastResult.bet}/>{stuck&&<button onClick={unstick} className="btn-press" style={{width:"100%",padding:"9px 0",border:"1px solid rgba(255,200,80,.4)",borderRadius:10,background:"rgba(245,200,66,.1)",color:"#f5c842",fontSize:14,fontWeight:700,cursor:"pointer",marginTop:4}}>🔓 Cancelar rodada travada</button>}
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      {[{fn:placeBetAndFly,l:"✈️ APOSTAR E DECOLAR",bg:"linear-gradient(135deg,#f5c842,#e8a020)",tc:"#000",d:cr.running},{fn:cashOut,l:"🏦 SACAR",bg:"linear-gradient(135deg,#ff3d5a,#cc1a35)",tc:"#fff",d:!cr.running||!cr.betIn}].map(b=><button key={b.l} onClick={b.fn} disabled={b.d} className="btn-press" style={{flex:1,padding:"10px 10px",border:"none",borderRadius:10,background:b.bg,color:b.tc,fontFamily:"'Cinzel Decorative',serif",fontSize:15,fontWeight:700,cursor:b.d?"not-allowed":"pointer",opacity:b.d?.4:1}}>{b.l}</button>)}
    </div>
    <QuickBets G={G} setG={setG} disabled={cr.running}/>
  </GameLayout>;
}
