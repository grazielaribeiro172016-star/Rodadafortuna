import { useState } from "react";
import { StreakBonusBar } from "./StreakBonusBar";
import { StatsBar } from "./StatsBar";
import { HistPanel } from "./HistPanel";

export function GameLayout({game,G,setG,history,children}){
  const[showStats,setShowStats]=useState(false); // colapsado por padrão — menos ruído visual durante o jogo
  return <div style={{maxWidth:900,margin:"0 auto",padding:"14px 16px 100px",display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
      <div className="cd" style={{fontSize:21,fontWeight:700,background:`linear-gradient(90deg,${game.color},#fff8dc)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{game.emoji} {game.name}</div>
      <div className="bp" style={{background:`linear-gradient(135deg,${game.color},${game.color}aa)`,color:["#f5c842","#2dde98","#00e5b0","#ff8c42"].includes(game.color)?"#000":"#fff",fontSize:14,fontWeight:700,padding:"3px 9px",borderRadius:20,letterSpacing:.5}}>🍀 Boa Sorte!</div>
    </div>
    {children}
    {game.hasStreakBonus&&<StreakBonusBar streak={G.streak}/>}
    <button onClick={()=>setShowStats(v=>!v)} className="btn-press" style={{alignSelf:"center",background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.1)",color:"#8a96aa",fontSize:13,fontWeight:600,padding:"6px 14px",borderRadius:20,cursor:"pointer"}}>
      {showStats?"▲ Esconder estatísticas e histórico":"📊 Ver estatísticas e histórico"}
    </button>
    {showStats && <div className="fade-in-up" style={{display:"flex",flexDirection:"column",gap:12}}>
      <StatsBar G={G}/>
      <HistPanel history={history}/>
    </div>}
  </div>;
}
