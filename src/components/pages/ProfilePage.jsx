import { Panel } from "../shared/Panel";
import { fmt, INI } from "../../game/constants";
import { ReferralPanel } from "./ReferralPanel";

export function ProfilePage({G,user,profile,onSignOut,onLogin,onNav,onDeposit,onWithdraw,onCompleteCadastro,demoMode}){
  const level=G.rounds<20?"Iniciante":G.rounds<100?"Aventureiro":G.rounds<500?"Veterano":"Lendário";
  const lc={Iniciante:"#6a7a9a",Aventureiro:"#4da6ff",Veterano:"#f5c842",Lendário:"#c264ff"}[level];
  const lucro=G.saldo-INI;
  const kycComplete=!!(profile?.full_name&&profile?.document_number);

  return <div style={{maxWidth:480,margin:"0 auto",padding:"24px 16px 100px",textAlign:"center"}}>
    <div style={{fontSize:95,marginBottom:12}}>⭐</div>
    {user ? <>
      <div className="cd" style={{fontSize:24,fontWeight:700,color:"#eeeaf0",marginBottom:4}}>{profile?.username||user.email}</div>
      <div style={{fontSize:15,color:"#6a7a9a",marginBottom:8}}>{user.email}</div>
    </> : <>
      <div className="cd" style={{fontSize:24,fontWeight:700,color:"#eeeaf0",marginBottom:4}}>Jogador Visitante</div>
      <div style={{fontSize:15,color:"#6a7a9a",marginBottom:8}}>Jogue sem conta — progresso não é salvo</div>
    </>}
    <div style={{display:"inline-block",background:`${lc}22`,border:`1px solid ${lc}55`,color:lc,fontSize:17,fontWeight:700,padding:"4px 16px",borderRadius:20,marginBottom:24}}>{level}</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
      {[{e:"🎮",v:G.rounds,l:"Rodadas"},{e:"🏆",v:G.wins,l:"Vitórias"},{e:"🐉",v:G.dragons,l:"Dragões"}].map(s=><Panel key={s.l}><div style={{fontSize:32}}>{s.e}</div><div className="cn" style={{fontSize:29,fontWeight:700,color:"#f5c842"}}>{s.v}</div><div style={{fontSize:14,color:"#6a7a9a",textTransform:"uppercase",letterSpacing:1}}>{s.l}</div></Panel>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
      {[{l:"Saldo",v:fmt(G.saldo),c:"#f5c842"},{l:"Lucro/Prejuízo",v:(lucro>=0?"+":"")+fmt(lucro),c:lucro>=0?"#2dde98":"#ff3d5a"},{l:"Melhor Prêmio",v:fmt(G.best),c:"#00e5b0"},{l:"Streak 🔥",v:G.streak,c:"#f5c842"}].map(s=><Panel key={s.l}><div style={{fontSize:14,color:"#6a7a9a",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{s.l}</div><div className="cn" style={{fontSize:24,fontWeight:700,color:s.c}}>{s.v}</div></Panel>)}
    </div>
    {user && demoMode && (
      <div style={{textAlign:"left",background:"rgba(194,100,255,.07)",border:"1px solid rgba(194,100,255,.25)",borderRadius:10,padding:"10px 14px",marginBottom:10,fontSize:14,color:"#c264ff"}}>
        🎮 Você está no modo teste. Os valores abaixo são do seu <strong>saldo real</strong> — o saldo teste não aparece aqui nem afeta depósito/saque.
      </div>
    )}
    {user && <ReferralPanel user={user} profile={profile} />}
    {user && !kycComplete && (
      <div onClick={onCompleteCadastro} style={{cursor:"pointer",textAlign:"left",background:"rgba(245,200,66,.07)",border:"1px solid rgba(245,200,66,.25)",borderRadius:10,padding:"10px 14px",marginBottom:10,fontSize:15,color:"#f5c842",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
        <span>📋 Complete seu cadastro (nome/CPF) pra sacar mais rápido depois</span>
        <span style={{fontWeight:700,whiteSpace:"nowrap"}}>Completar →</span>
      </div>
    )}
    {user && (
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
        <button onClick={onDeposit} className="btn-press" style={{padding:"13px 8px",border:"none",borderRadius:10,background:"linear-gradient(135deg,#f5c842,#e8a020)",color:"#000",fontFamily:"'Cinzel Decorative',serif",fontSize:16,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 20px rgba(245,200,66,.3)"}}>💰 DEPOSITAR</button>
        <button onClick={onWithdraw} className="btn-press" style={{padding:"13px 8px",border:"none",borderRadius:10,background:"linear-gradient(135deg,#00e5b0,#00b88a)",color:"#000",fontFamily:"'Cinzel Decorative',serif",fontSize:16,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 20px rgba(0,229,176,.3)"}}>🏦 SACAR</button>
      </div>
    )}
    {user && <button onClick={()=>onNav('/history')} style={{width:"100%",padding:"12px",border:"none",borderRadius:10,background:"linear-gradient(135deg,#4da6ff,#2277dd)",color:"#fff",fontFamily:"'Cinzel Decorative',serif",fontSize:16,fontWeight:700,cursor:"pointer",marginBottom:10}}>📜 VER HISTÓRICO COMPLETO</button>}
    {user
      ? <button onClick={onSignOut} style={{width:"100%",padding:"12px",border:"1px solid rgba(255,61,90,.3)",borderRadius:10,background:"rgba(255,61,90,.08)",color:"#ff3d5a",fontFamily:"'Cinzel Decorative',serif",fontSize:16,fontWeight:700,cursor:"pointer",marginBottom:16}}>SAIR DA CONTA</button>
      : <button onClick={onLogin} style={{width:"100%",padding:"12px",border:"none",borderRadius:10,background:"linear-gradient(135deg,#f5c842,#e8a020)",color:"#000",fontFamily:"'Cinzel Decorative',serif",fontSize:16,fontWeight:700,cursor:"pointer",marginBottom:16}}>ENTRAR / CRIAR CONTA</button>
    }
    {!user && <Panel title="💾 Por que criar conta?">
      <div style={{fontSize:16,color:"#6a7a9a",lineHeight:2,textAlign:"left"}}>
        ☁️ Saldo salvo na nuvem<br/>
        📊 Histórico de todas as rodadas<br/>
        🏆 Ranking entre jogadores<br/>
        ⚡ Deposite via PIX e comece a jogar na hora<br/>
        <span style={{color:"#f5c842",fontWeight:700}}>Crie uma conta grátis e nunca perca seu progresso!</span>
      </div>
    </Panel>}
  </div>;
}
