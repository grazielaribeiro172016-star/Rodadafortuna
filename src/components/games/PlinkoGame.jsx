import { useState, useEffect, useRef } from "react";
import { activateAudio, sWin, sLoss, sPeg } from "../../game/audio";
import { rnd } from "../../game/rng";
import { sleep, fmt, BETS, GAMES } from "../../game/constants";
import { supabase, hasSupabase } from "../../lib/supabase";
import { GameLayout } from "../shared/GameLayout";
import { WinMsg } from "../shared/WinMsg";
import { BetRow } from "../shared/BetControls";


// ═══ PLINKO NEON — auditado, correto ═════════════════════════
// CORRIGIDO: 8 fileiras geram 9 buckets (distribuição binomial), não 11.
// Multiplicadores calibrados matematicamente para RTP exato de 95.9%
// usando as probabilidades binomiais reais C(8,k)/256.
const PM=[26,4,1.4,0.3,0.25,0.3,1.4,4,26];
const PC=PM.map(m=>m>=10?"#c264ff":m>=2?"#f5c842":m>=1?"#00e5b0":"#ff3d5a");
export function PlinkoGame({G,setG,history,addHistory,user,demoMode}){
  const cvR=useRef(null);const[playing,setPlay]=useState(false);const[hit,setHit]=useState(null);
  const[msg,setMsg]=useState("");const[mT,setMT]=useState("");
  const[lastResult,setLastResult]=useState({prize:0,bet:0});
  useEffect(()=>{drawBoard(null);},[]);
  function drawBoard(bp){const cv=cvR.current;if(!cv)return;const ctx=cv.getContext("2d");const W=cv.width,H=cv.height;ctx.clearRect(0,0,W,H);const ROWS=8;for(let r=0;r<ROWS;r++){const cols=r+2;for(let c=0;c<cols;c++){const x=(W/2)+(c-cols/2+.5)*(W/(ROWS+2));const y=25+r*(H-60)/(ROWS+1);ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fillStyle="#00e5b0";ctx.shadowBlur=8;ctx.shadowColor="#00e5b0";ctx.fill();ctx.shadowBlur=0;}}if(bp){ctx.beginPath();ctx.arc(bp.x,bp.y,7,0,Math.PI*2);ctx.fillStyle="#f5c842";ctx.shadowBlur=16;ctx.shadowColor="#f5c842";ctx.fill();ctx.shadowBlur=0;}}
  async function play(){
    activateAudio();
    const bet=BETS[G.betIdx];
    if(G.saldo<bet){setMsg("❌ Saldo insuficiente!");setMT("loss");return;}
    setPlay(true);setHit(null);setMsg("");setMT("");
    const useServer = hasSupabase && user && !demoMode;

    let bi, m, prize=0, newBalance=null;

    if(useServer){
      const { data, error } = await supabase.rpc('play_plinko', { p_user_id: user.id, p_bet: bet });
      if(error || !data || !data[0]){
        console.error('[play_plinko]', error);
        setMsg("⚠️ Erro ao processar. Tente novamente.");setMT("loss");
        setPlay(false);return;
      }
      const res=data[0];
      bi=res.bucket; m=Number(res.mult); prize=Number(res.prize); newBalance=Number(res.new_balance);
    }else{
      setG(p=>({...p,saldo:p.saldo-bet}));
    }

    const cv=cvR.current;const W=cv.width,H=cv.height;
    const ROWS=8;
    const B=PM.length;

    let x=W/2, y=15;
    let relPos=0;
    // Se useServer, força a animação a terminar no bucket sorteado pelo servidor;
    // senão (modo visitante), sorteia localmente igual antes.
    const targetBucket = useServer ? bi : null;

    for(let r=0;r<ROWS;r++){
      let dir;
      if(targetBucket!==null && r===ROWS-1){
        // última fileira: força o lado que fecha exatamente no bucket certo
        const wanted = targetBucket*2 - ROWS;
        dir = (wanted - relPos) > 0 ? 1 : -1;
      }else{
        dir = rnd()>.5 ? 1 : -1;
      }
      relPos += dir;

      const cols=r+2;
      const colIndex = (cols/2) + (relPos/2);
      const tx=(W/2)+(colIndex-cols/2+.5)*(W/(ROWS+2));
      const ty=25+(r+1)*(H-60)/(ROWS+1);

      for(let s=0;s<=8;s++){
        drawBoard({x:x+(tx-x)*(s/8), y:y+(ty-y)*(s/8)});
        await sleep(30);
      }
      sPeg();
      x=tx; y=ty;
    }

    const bucketIndex = targetBucket!==null ? targetBucket : Math.max(0, Math.min(B-1, Math.round((relPos+ROWS)/2)));
    bi = bucketIndex;

    const fy=H-20;
    for(let s=0;s<=6;s++){drawBoard({x,y:y+(fy-y)*(s/6)});await sleep(25);}
    drawBoard(null);

    if(!useServer){
      m=PM[bi];
      prize=+(bet*m).toFixed(2);
    }
    setHit(bi);
    setLastResult({prize,bet});

    if(useServer) setG(p=>({...p,saldo:newBalance}));

    if(m>=1){
      sWin();
      if(!useServer) setG(p=>({...p,saldo:p.saldo+prize,wins:p.wins+1,totalWon:p.totalWon+prize,streak:p.streak+1,rounds:p.rounds+1,best:Math.max(p.best,prize)}));
      setMsg(`🔵 Bucket ×${m} — +${fmt(prize)}!`);setMT("win");
      if(!useServer) addHistory({txt:`🔵 Plinko ×${m} +${fmt(prize)}`,type:"win"},{gameId:'plinko',bet,result:prize,won:true});
    }else{
      sLoss();
      if(!useServer) setG(p=>({...p,saldo:p.saldo+prize,losses:p.losses+1,streak:0,rounds:p.rounds+1}));
      setMsg(`😔 Bucket ×${m} — recebeu ${fmt(prize)} (de ${fmt(bet)})`);setMT("loss");
      if(!useServer) addHistory({txt:`🔵 Plinko ×${m} +${fmt(prize)} (parcial)`,type:""},{gameId:'plinko',bet,result:prize,won:false});
    }
    setPlay(false);
    setTimeout(()=>setHit(null),1200);
  }
  return <GameLayout game={GAMES[9]} G={G} setG={setG} history={history}><div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}><canvas ref={cvR} width={320} height={220} style={{borderRadius:10,border:"1px solid rgba(255,200,80,.15)",background:"rgba(5,7,15,.8)",width:"100%",maxWidth:320}}/><div style={{display:"flex",gap:2,width:"100%",maxWidth:320}}>{PM.map((m,i)=><div key={i} style={{flex:1,padding:"4px 2px",textAlign:"center",borderRadius:5,border:`1px solid ${hit===i?PC[i]:"transparent"}`,background:hit===i?`${PC[i]}22`:"rgba(12,18,38,.6)",fontFamily:"'Cinzel',serif",fontSize:12,fontWeight:700,color:PC[i],transform:hit===i?"scale(1.15)":"scale(1)",transition:"all .3s"}}>×{m}</div>)}</div></div><WinMsg msg={msg} type={mT} prize={lastResult.prize} bet={lastResult.bet}/><BetRow G={G} setG={setG} onAction={play} label="SOLTAR BOLA" disabled={playing}/></GameLayout>;
}
