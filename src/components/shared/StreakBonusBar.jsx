// Barra de progresso do bônus real de streak (+10%/+20%/+35% — vantagem matemática
// de verdade aplicada em Slot, Dados e Duelo, não decoração).
export function StreakBonusBar({streak}){
  const tiers=[{at:5,bonus:"+10%"},{at:10,bonus:"+20%"},{at:20,bonus:"+35%"}];
  const next=tiers.find(t=>streak<t.at);
  const current=tiers.filter(t=>streak>=t.at).pop();
  if(streak===0) return null;
  const prevAt=current?current.at:0;
  const targetAt=next?next.at:20;
  const pct=next?Math.min(100,((streak-prevAt)/(targetAt-prevAt))*100):100;
  return <div className="fade-in-up" style={{background:"rgba(245,200,66,.05)",border:"1px solid rgba(245,200,66,.18)",borderRadius:12,padding:"10px 14px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
      <div style={{fontSize:13,color:"#f5c842",fontWeight:700,display:"flex",alignItems:"center",gap:5}}>
        <span className={streak>=5?"icon-glow-pulse":""}>🔥</span> Streak de {streak}
        {current&&<span style={{color:"#2dde98",marginLeft:4}}>({current.bonus} nos prêmios ativo!)</span>}
      </div>
      {next&&<div style={{fontSize:12,color:"#6a7a9a"}}>Faltam {next.at-streak} para {next.bonus}</div>}
    </div>
    <div style={{height:6,background:"rgba(255,255,255,.06)",borderRadius:4,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,#f5c842,#ffd76e)",borderRadius:4,transition:"width .5s cubic-bezier(.16,1,.3,1)",boxShadow:"0 0 8px rgba(245,200,66,.5)"}}/>
    </div>
  </div>;
}
