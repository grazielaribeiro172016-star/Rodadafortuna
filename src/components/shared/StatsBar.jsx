import { Panel } from "./Panel";
import { fmt } from "../../game/constants";

export function StatsBar({G}){
  const taxa=G.rounds>0?Math.round(G.wins/G.rounds*100):0;
  const nextTier=G.streak<5?5:G.streak<10?10:G.streak<20?20:null;
  const tierBase=G.streak<5?0:G.streak<10?5:G.streak<20?10:20;
  const progress=nextTier?Math.min(100,((G.streak-tierBase)/(nextTier-tierBase))*100):100;
  return <div style={{display:"flex",flexDirection:"column",gap:8}}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>{[{l:"Saldo",v:fmt(G.saldo),c:"#f5c842"},{l:"Rodadas",v:G.rounds,c:"#eeeaf0"},{l:"Acerto",v:taxa+"%",c:"#2dde98"},{l:"Streak 🔥",v:G.streak,c:G.streak>=5?"#f5c842":"#6a7a9a"}].map(s=><Panel key={s.l}><div style={{fontSize:12,letterSpacing:2,textTransform:"uppercase",color:"#6a7a9a",marginBottom:4}}>{s.l}</div><div className="cn" style={{fontSize:20,fontWeight:700,color:s.c}}>{s.v}</div></Panel>)}</div>
    {nextTier && (
      <div style={{padding:"8px 12px",borderRadius:10,background:"rgba(245,200,66,.05)",border:"1px solid rgba(245,200,66,.12)"}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#8a96aa",marginBottom:5}}>
          <span>🔥 Próximo bônus: <strong style={{color:"#f5c842"}}>+{nextTier>=20?35:nextTier>=10?20:10}%</strong></span>
          <span>{G.streak}/{nextTier}</span>
        </div>
        <div style={{height:6,borderRadius:4,background:"rgba(255,255,255,.06)",overflow:"hidden"}}>
          <div style={{height:"100%",width:`${progress}%`,borderRadius:4,background:"linear-gradient(90deg,#f5c842,#ffdd7a)",transition:"width .4s cubic-bezier(.16,1,.3,1)",boxShadow:progress>70?"0 0 8px rgba(245,200,66,.6)":"none"}}/>
        </div>
      </div>
    )}
  </div>;
}
