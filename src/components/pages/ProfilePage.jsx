import { useState, useEffect } from "react";
import { Panel } from "../shared/Panel";
import { fmt, INI } from "../../game/constants";
import { supabase, hasSupabase } from "../../lib/supabase";

export function ProfilePage({G,user,profile,onSignOut,onLogin,onNav,onDeposit,onWithdraw,onCompleteCadastro,demoMode}){
  const level=G.rounds<20?"Iniciante":G.rounds<100?"Aventureiro":G.rounds<500?"Veterano":"Lendário";
  const lc={Iniciante:"#6a7a9a",Aventureiro:"#4da6ff",Veterano:"#f5c842",Lendário:"#c264ff"}[level];
  const lucro=G.saldo-INI;
  const kycComplete=!!(profile?.full_name&&profile?.document_number);

  // Fase 9: link de indicação + estatísticas (via RPC, só leitura própria)
  const[refStats,setRefStats]=useState(null);
  const[copied,setCopied]=useState(false);
  const referralLink = profile?.username ? `${window.location.origin}/?ref=${profile.username}` : null;
  useEffect(()=>{
    if(!hasSupabase||!user) return;
    let alive=true;
    supabase.rpc('get_referral_stats').then(({data})=>{ if(alive&&data) setRefStats(data); }).catch(()=>{});
    return ()=>{alive=false};
  },[user]);
  function copyReferralLink(){
    if(!referralLink) return;
    navigator.clipboard?.writeText(referralLink).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000); });
  }

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
        🎮 Você está testando em Modo Demo. Os valores abaixo são do seu <strong>saldo real</strong> — o saldo demo não aparece aqui nem afeta depósito/saque.
      </div>
    )}
    {user && referralLink && (
      <div style={{textAlign:"left",background:"linear-gradient(135deg,rgba(194,100,255,.08),rgba(194,100,255,.03))",border:"1px solid rgba(194,100,255,.25)",borderRadius:12,padding:"14px 16px",marginBottom:16}}>
        <div style={{fontSize:15,color:"#c264ff",fontWeight:700,marginBottom:4}}>🎁 Convide um amigo</div>
        <div style={{fontSize:13,color:"#9aa6ba",marginBottom:10,lineHeight:1.4}}>
          Cada amigo que entrar com seu link e jogar a primeira rodada dá bônus de saldo demo pra vocês dois.
        </div>
        <div style={{display:"flex",gap:8,marginBottom:refStats?10:0}}>
          <div style={{flex:1,background:"rgba(0,0,0,.3)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"9px 10px",fontSize:13,color:"#c8d4e6",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{referralLink}</div>
          <button onClick={copyReferralLink} className="btn-press" style={{flexShrink:0,padding:"9px 14px",border:"none",borderRadius:8,background:copied?"linear-gradient(135deg,#00e5b0,#00b88a)":"linear-gradient(135deg,#c264ff,#9040dd)",color:"#000",fontWeight:700,fontSize:13,cursor:"pointer"}}>{copied?"Copiado ✓":"Copiar"}</button>
        </div>
        {refStats && (refStats.credited>0||refStats.pending>0) && (
          <div style={{fontSize:12.5,color:"#8a96aa"}}>
            {refStats.credited>0 && <>✅ {refStats.credited} amigo{refStats.credited>1?"s":""} já jogaram e renderam bônus. </>}
            {refStats.pending>0 && <>⏳ {refStats.pending} cadastrado{refStats.pending>1?"s":""}, aguardando a 1ª rodada.</>}
          </div>
        )}
      </div>
    )}
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
        💳 Depósito via PIX (em breve)<br/>
        <span style={{color:"#f5c842",fontWeight:700}}>Crie uma conta grátis e nunca perca seu progresso!</span>
      </div>
    </Panel>}
  </div>;
}
