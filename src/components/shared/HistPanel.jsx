import { Panel } from "./Panel";

export function HistPanel({history}){return <Panel title="📜 Histórico"><div style={{maxHeight:120,overflowY:"auto"}} className="ns">{history.length===0?<div style={{fontSize:15,color:"#6a7a9a"}}>Nenhuma rodada ainda.</div>:history.slice(0,20).map((h,i)=><div key={i} style={{fontSize:14,padding:"3px 7px",borderRadius:5,borderLeft:`3px solid ${h.type==="win"?"#f5c842":h.type==="dragon"?"#c264ff":h.type==="teal"?"#00e5b0":"transparent"}`,color:h.type?"#eeeaf0":"#6a7a9a",background:"rgba(255,255,255,.02)",marginBottom:2}}>{h.txt}</div>)}</div></Panel>;}
