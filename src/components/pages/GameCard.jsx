import { useState } from "react";
import { fmt } from "../../game/constants";

// ═══ GAME CARD ════════════════════════════════════════════════
export function GameCard({game,onClick}){
  const[hov,setHov]=useState(false);
  const[showRtp,setShowRtp]=useState(false); // tooltip do RTP, fechado por padrão
  return <div className="gc card-lift" onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{boxShadow:hov?`0 12px 40px ${game.glow}`:"none"}}>
    <div style={{height:140,background:`linear-gradient(135deg,${game.color}22 0%,rgba(5,7,15,0) 100%)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:85,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,background:`radial-gradient(circle at 50% 50%,${game.glow} 0%,transparent 70%)`,opacity:hov?1:.3,transition:"opacity .25s"}}/>
      <span style={{position:"relative",zIndex:1,filter:`drop-shadow(0 0 16px ${game.color})`}}>{game.emoji}</span>
      <div className="bp" style={{position:"absolute",top:10,right:10,background:`${game.color}22`,border:`1px solid ${game.color}55`,color:game.color,fontSize:12,fontWeight:700,padding:"3px 8px",borderRadius:20,letterSpacing:.5}}>{game.tag}</div>
    </div>
    <div style={{padding:"14px 16px",background:"rgba(8,12,26,.7)",backdropFilter:"blur(10px)"}}>
      <div style={{fontSize:17,fontWeight:700,color:"#eeeaf0",marginBottom:12}}>{game.name}</div>
      <button className="btn-press" style={{width:"100%",padding:"9px 0",border:"none",borderRadius:10,background:`linear-gradient(135deg,${game.color},${game.color}aa)`,color:["#f5c842","#2dde98","#00e5b0","#ff8c42"].includes(game.color)?"#000":"#fff",fontFamily:"'Cinzel Decorative',serif",fontSize:16,fontWeight:700,cursor:"pointer",letterSpacing:1.5,boxShadow:`0 4px 20px ${game.glow}`}}>JOGAR</button>
    </div>
  </div>;
}
