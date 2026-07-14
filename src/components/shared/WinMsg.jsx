import { useState, useEffect, useRef } from "react";

export function WinMsg({msg,type,prize=null,bet=null}){
  if(!msg)return<div style={{minHeight:40}}/>;
  const s={win:{color:"#f5c842",background:"rgba(245,200,66,.08)",border:"1px solid rgba(245,200,66,.3)"},loss:{color:"#ff3d5a",background:"rgba(255,61,90,.06)",border:"1px solid rgba(255,61,90,.2)"},dragon:{color:"#c264ff",background:"rgba(194,100,255,.1)",border:"1px solid rgba(194,100,255,.4)"},teal:{color:"#00e5b0",background:"rgba(0,229,176,.08)",border:"1px solid rgba(0,229,176,.3)"}};
  // Celebração em camadas: só ativa se prize+bet forem passados E for vitória (type win/dragon)
  const isWinType = type==="win"||type==="dragon";
  const hasCelebrationData = prize!==null && bet!==null && bet>0 && isWinType;
  const tier = hasCelebrationData ? winTier(prize,bet) : null;
  const popClass = tier==="lg"?"win-pop-lg glow-pulse-lg":tier==="md"?"win-pop-md glow-pulse-sm":tier==="sm"?"win-pop-sm":"fade-in-up";
  return <>
    {hasCelebrationData && <WinCelebration trigger={msg} prize={prize} tier={tier}/>}
    <div key={msg} className={`cn ${popClass}`} style={{textAlign:"center",fontSize:18,fontWeight:700,padding:"8px 12px",borderRadius:10,minHeight:40,letterSpacing:.5,display:"flex",alignItems:"center",justifyContent:"center",gap:6,...(s[type]||s.win)}}>
      {hasCelebrationData ? <>
        <span>{msg.split(/[+\-]?R\$\s?[\d.,]+/)[0]}</span>
        <CountUp value={prize} duration={tier==="lg"?1100:tier==="md"?750:400}/>
      </> : msg}
    </div>
  </>;
}

// ═══ FASE 7 — Número do prêmio "sobe" animadamente em vez de aparecer direto ═══
function CountUp({value,duration=700,prefix="R$ ",decimals=2}){
  const[display,setDisplay]=useState(0);
  const rafRef=useRef(null);
  useEffect(()=>{
    const start=performance.now();
    const from=0;
    function tick(now){
      const t=Math.min(1,(now-start)/duration);
      const eased=1-Math.pow(1-t,3); // ease-out cubic
      setDisplay(from+(value-from)*eased);
      if(t<1) rafRef.current=requestAnimationFrame(tick);
    }
    rafRef.current=requestAnimationFrame(tick);
    return ()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current);};
  },[value,duration]);
  return <span className="count-up-num">{prefix}{display.toFixed(decimals).replace(".",",")}</span>;
}

// ═══ FASE 7 — Orquestra os 3 níveis de celebração: pequena/média/grande ═══
// Nível decidido pelo múltiplo (prize/bet). Não substitui Confetti/WinMsg/DragonOverlay
// existentes — funciona em conjunto com eles, sem alterar nenhuma lógica de jogo.
function winTier(prize,bet){
  if(!bet||bet<=0) return "sm";
  const mult=prize/bet;
  if(mult>=10) return "lg";
  if(mult>=3) return "md";
  return "sm";
}
function WinCelebration({trigger,prize,tier}){
  const[shake,setShake]=useState(false);
  const[flash,setFlash]=useState(false);
  useEffect(()=>{
    if(!trigger) return;
    if(tier==="lg"){
      setShake(true);setFlash(true);
      const t1=setTimeout(()=>setShake(false),520);
      const t2=setTimeout(()=>setFlash(false),750);
      return ()=>{clearTimeout(t1);clearTimeout(t2);};
    }
  },[trigger,tier]);
  return <>
    {flash&&<div className="flash-overlay" style={{background:"radial-gradient(circle,rgba(245,200,66,.25) 0%,transparent 70%)"}}/>}
    {shake&&<div className="screen-shake" style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:1}}/>}
  </>;
}
