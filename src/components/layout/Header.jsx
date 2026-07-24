import { fmt, GAMES } from "../../game/constants";

// ═══ LAYOUT SHELL ═════════════════════════════════════════════
export function Header({G,setG,muted,toggleMute,route,onNav,user,profile,onLogin,onLogout,guestMode,demoMode=false,onToggleDemo,sessionMinutes=0,onDeposit}){
  const isGame=route.startsWith("/jogo/");const gameId=isGame?route.replace("/jogo/",""):null;const cg=gameId?GAMES.find(g=>g.id===gameId):null;
  return <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 18px",background:"rgba(8,12,26,.95)",borderBottom:"1px solid rgba(255,200,80,.15)",backdropFilter:"blur(20px)",position:"sticky",top:0,zIndex:100,flexWrap:"wrap",gap:8}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      {isGame&&<button onClick={()=>onNav("/")} style={{background:"rgba(255,200,80,.08)",border:"1px solid rgba(255,200,80,.2)",color:"#f5c842",padding:"5px 10px",borderRadius:8,cursor:"pointer",fontSize:16,fontWeight:700}}>← Voltar</button>}
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div className="lglow" style={{width:38,height:38,background:"linear-gradient(135deg,#f5c842,#e8a020)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>⭐</div>
        <div><div className="cd" style={{fontSize:18,fontWeight:700,background:"linear-gradient(90deg,#f5c842,#fff8dc,#f5c842)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:1}}>Long777 龙</div><div style={{fontSize:12,letterSpacing:3,color:"#00e5b0",textTransform:"uppercase"}}>{cg?cg.name:`${GAMES.length} Jogos Exclusivos`}</div></div>
      </div>
      {((guestMode && !user) || (user && demoMode)) && (
        <div title="Saldo de teste — RTP idêntico ao modo real" style={{color:"#c264ff",fontSize:11,fontWeight:700,letterSpacing:1,padding:"3px 8px",textTransform:"uppercase",whiteSpace:"nowrap",opacity:.75}}>· teste</div>
      )}
    </div>
    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      {sessionMinutes>=1 && (
        <div title="Tempo desde que você abriu o app nesta sessão" style={{fontSize:12.5,color:"#6a7a9a",padding:"5px 10px",borderRadius:8,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.08)",whiteSpace:"nowrap"}}>
          ⏱ {sessionMinutes} min jogando
        </div>
      )}
      {user && (
        <button
          onClick={onToggleDemo}
          title={demoMode ? "Voltar a jogar com saldo real" : "Jogar com saldo teste, sem afetar seu saldo real"}
          className="btn-press"
          style={{background:"transparent",border:"none",color:demoMode?"#c264ff":"#4a5468",fontSize:16,padding:"4px 6px",borderRadius:6,cursor:"pointer",opacity:demoMode?1:.6,transition:"opacity .2s"}}
        >
          🎮
        </button>
      )}
      <div className="glow-pulse-sm" style={{background:"linear-gradient(135deg,rgba(245,200,66,.18),rgba(232,160,32,.1))",border:"1.5px solid rgba(245,200,66,.4)",padding:"7px 16px",borderRadius:10,fontSize:18,fontWeight:800,color:"#f5c842",boxShadow:"0 2px 12px rgba(245,200,66,.15)"}}><span style={{color:"#8a96aa",fontWeight:500,marginRight:4,fontSize:14}}>Saldo</span>{fmt(G.saldo)}</div>
      {user && !demoMode && onDeposit && (
        <button
          onClick={onDeposit}
          className="btn-press"
          style={{background:"linear-gradient(135deg,#00e5b0,#00b88a)",border:"none",color:"#00160f",fontSize:14,fontWeight:800,padding:"8px 16px",borderRadius:10,cursor:"pointer",whiteSpace:"nowrap",boxShadow:"0 2px 12px rgba(0,229,176,.35)",display:"flex",alignItems:"center",gap:6}}
        >
          💰 Depositar
        </button>
      )}
      <div className={G.streak>=5?"chip-active":""} style={{background:G.streak>=20?"linear-gradient(135deg,rgba(245,200,66,.22),rgba(255,61,90,.12))":G.streak>=10?"rgba(245,200,66,.12)":G.streak>=5?"rgba(0,229,176,.1)":"rgba(0,229,176,.06)",border:`1.5px solid ${G.streak>=10?"rgba(245,200,66,.45)":"rgba(0,229,176,.25)"}`,padding:"7px 14px",borderRadius:10,fontSize:16,fontWeight:800,color:G.streak>=10?"#f5c842":"#00e5b0",display:"flex",flexDirection:"column",alignItems:"center",lineHeight:1.1}}>
        <span>🔥 {G.streak}</span>
        {G.streak>=5 && <span style={{fontSize:10,fontWeight:700,letterSpacing:.5}}>+{G.streak>=20?35:G.streak>=10?20:10}% BÔNUS</span>}
      </div>
      <button onClick={toggleMute} className="btn-press" style={{background:"rgba(245,200,66,.08)",border:"1px solid rgba(245,200,66,.25)",color:"#f5c842",fontSize:21,width:36,height:36,borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{muted?"🔇":"🔊"}</button>
      {user
        ? <button onClick={onLogout} className="btn-press" style={{background:"rgba(255,61,90,.08)",border:"1px solid rgba(255,61,90,.2)",color:"rgba(255,61,90,.8)",fontSize:14,padding:"5px 10px",borderRadius:8,cursor:"pointer",fontWeight:700,fontFamily:"'Rajdhani',sans-serif"}}>SAIR</button>
        : <button onClick={onLogin} className="btn-press" style={{background:"linear-gradient(135deg,#f5c842,#e8a020)",border:"none",color:"#000",fontSize:15,padding:"6px 12px",borderRadius:8,cursor:"pointer",fontWeight:700,fontFamily:"'Cinzel Decorative',serif",letterSpacing:.5}}>{guestMode?"ENTRAR":"LOGIN"}</button>
      }
    </div>
  </header>;
}
