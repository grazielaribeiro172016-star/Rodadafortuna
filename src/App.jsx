// ═══════════════════════════════════════════════════════════════
//  FORTUNA DO TIGRE — FASE 2 (Supabase Auth integrado)
//  Fase 1: Home, 15 jogos, RTPs corrigidos
//  Fase 2: Login, Cadastro, Logout, Recuperação de senha, perfil na nuvem
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from "react";
import { useAuth } from "./hooks/useAuth";
import { supabase, hasSupabase } from "./lib/supabase";
import { useGameSync } from "./hooks/useGameSync";
import { useFirstTimeHint } from "./hooks/useFirstTimeHint";
import { Hint } from "./components/shared/Hint";
import { BigWinConversionModal } from "./components/shared/BigWinModal";
import { AuthModal } from "./components/auth/AuthModal";
import { ResetPasswordPage } from "./components/auth/ResetPasswordPage";
import { HistoryPage } from "./components/history/HistoryPage";
import { WalletModal } from "./components/wallet/WalletModal";
import { WithdrawalModal } from "./components/wallet/WithdrawalModal";
import { AdminPanel } from "./components/admin/AdminPanel";
import { CSS } from "./styles/globalStyles";
import { INI, GAMES, VISIBLE_GAMES, createState } from "./game/constants";
import { setAudioMuted } from "./game/audio";
import { GameCard } from "./components/pages/GameCard";
import { HomePage } from "./components/pages/HomePage";
import { StatsPage } from "./components/pages/StatsPage";
import { ProfilePage } from "./components/pages/ProfilePage";
import { Header } from "./components/layout/Header";
import { BottomNav } from "./components/layout/BottomNav";
import { Particles } from "./components/layout/Particles";
import { SlotGame } from "./components/games/SlotGame";
import { CrashGame } from "./components/games/CrashGame";
import { MinaGame } from "./components/games/MinaGame";
import { RoletaGame } from "./components/games/RoletaGame";
import { DadosGame } from "./components/games/DadosGame";
import { DueloGame } from "./components/games/DueloGame";
import { TorreGame } from "./components/games/TorreGame";
import { BJGame } from "./components/games/BJGame";
import { KenoGame } from "./components/games/KenoGame";
import { PlinkoGame } from "./components/games/PlinkoGame";
import { MoedaGame } from "./components/games/MoedaGame";
import { RaspadinhaGame } from "./components/games/RaspadinhaGame";
import { NumeroGame } from "./components/games/NumeroGame";
import { BaccaratGame } from "./components/games/BaccaratGame";
import { TorreMiniGame } from "./components/games/TorreMiniGame";
import { TurfeGame } from "./components/games/TurfeGame";
import { BauGame } from "./components/games/BauGame";

const GC={slot:SlotGame,crash:CrashGame,mina:MinaGame,roleta:RoletaGame,dados:DadosGame,duelo:DueloGame,torre:TorreGame,blackjack:BJGame,keno:KenoGame,plinko:PlinkoGame,moeda:MoedaGame,raspadinha:RaspadinhaGame,numero:NumeroGame,baccarat:BaccaratGame,torremini:TorreMiniGame,turfe:TurfeGame,bau:BauGame};

export default function App(){
  const[route,setRoute]=useState(()=>window.location.pathname || "/");
  const[G,setG]=useState(createState);
  const[history,setHistory]=useState([]);
  const[muted,setMuted]=useState(true);
  const[showAuth,setShowAuth]=useState(false);
  const[guestMode,setGuestMode]=useState(false);
  // Modo demo disponível mesmo logado: saldo local, nunca sincroniza com Supabase.
  const[demoMode,setDemoMode]=useState(false);
  const[demoG,setDemoG]=useState(createState);
  const[showWallet,setShowWallet]=useState(false);
  const[showWithdrawal,setShowWithdrawal]=useState(false);
  const[withdrawalInitialStep,setWithdrawalInitialStep]=useState(undefined);
  const[bigWinModal,setBigWinModal]=useState({show:false,prize:0}); // Nível 3: conversão pós big-win no demo
  const[authInitialTab,setAuthInitialTab]=useState('login');

  // ── Auth hook ──────────────────────────────────────────────
  const { user, profile, loading, authError, setAuthError, signIn, signUp, signOut, resetPassword, fetchProfile } = useAuth();

  // ── Fase 3: sync hook ──────────────────────────────────────
  const { syncRound, fetchHistory, fetchTransactions, fetchGameStats, fetchPendingWithdrawals, cancelWithdrawal, claimDailyReward, fetchTopWins } = useGameSync(user);

  // ── Nível 2: dica contextual de streak (aparece só 1x, na primeira
  // vez que o bônus de streak é ativado, em qualquer jogo) ──────
  const streakHint = useFirstTimeHint("streak_bonus");
  const prevStreakRef = useRef(0);
  useEffect(() => {
    if (prevStreakRef.current < 5 && G.streak >= 5) streakHint.trigger();
    prevStreakRef.current = G.streak;
  }, [G.streak]);

  // ── Nível 3: contador de sessão visível (baixo custo, alto ganho de
  // transparência — ajuda a pessoa a perceber quanto tempo já jogou) ──
  const sessionStartRef = useRef(Date.now());
  const [sessionMinutes, setSessionMinutes] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setSessionMinutes(Math.floor((Date.now() - sessionStartRef.current) / 60000));
    }, 30000);
    return () => clearInterval(id);
  }, []);

  // Detecta rota de reset-password (vinda do email do Supabase)
  const isResetRoute = window.location.hash.includes('type=recovery') || route === '/reset-password';

  // Fase 5: rota oculta /admin?key=... para painel de teste
  const urlParams = new URLSearchParams(window.location.search);
  const isAdminRoute = route === '/admin' && urlParams.get('key') === (import.meta.env.VITE_ADMIN_PANEL_KEY || '__no_key_set__');

  // Fase 9: captura ?ref=username (link de indicação) uma única vez e
  // guarda na sessão até o cadastro acontecer — não é enviado a lugar
  // nenhum ainda, só fica disponível pro AuthModal usar no signUp.
  const [refCode] = useState(() => {
    try {
      const fromUrl = urlParams.get('ref');
      if (fromUrl) { sessionStorage.setItem('ftg_ref_code', fromUrl); return fromUrl; }
      return sessionStorage.getItem('ftg_ref_code') || null;
    } catch { return null; }
  });
  // Evita chamar a RPC de crédito toda hora — 1 tentativa por carregamento
  // de página já basta, ela mesma é idempotente (só credita 1x no banco).
  const referralAttemptedRef = useRef(false);
  async function tryCreditReferral() {
    if (!hasSupabase || !user || referralAttemptedRef.current) return;
    referralAttemptedRef.current = true;
    try {
      await supabase.rpc('credit_referral_bonus');
    } catch {
      // idempotente no banco — se falhar aqui, só não creditou desta vez,
      // não trava o resto do addHistory (que já rodou antes desta chamada)
    }
  }

  // Fase 3: quando perfil carrega, restaura estado do Supabase (sem localStorage)
  useEffect(() => {
    if (profile) {
      setG(p => ({
        ...p,
        saldo:    profile.balance != null ? Number(profile.balance) : INI,
        totalWon: Number(profile.total_won) || 0,
        best:     Number(profile.best_win)  || 0,
        streak:   profile.streak  || 0,
        dragons:  profile.dragons || 0,
        rounds:   profile.rounds  || 0,
        wins:     profile.wins    || 0,
        losses:   profile.losses  || 0,
      }));
    }
  }, [profile]);

  // Fase 3: addHistory grava cada rodada finalizada no Supabase via RPC segura
  // syncOpts = { gameId, bet, result, won } — passado pelos jogos ao finalizar
  function addHistory(item, syncOpts = null) {
    setHistory(p => [item, ...p].slice(0, 50));
    // Em modo demo (com ou sem login) a rodada é só local — nunca grava saldo/real no Supabase.
    if (!inLocalDemo && syncOpts && user) {
      syncRound({ ...syncOpts, G, setG });
    }
    // (Não existe mais um fallback de "sync sem syncOpts": os 15 jogos sempre passam
    // syncOpts, e a única rota alternativa era um update direto na tabela profiles —
    // removida por ser uma brecha de segurança. Ver supabase_lock_profile_writes.sql.)
    // Fase 9: 1ª rodada de quem chegou por indicação credita o bônus demo pros
    // dois lados (RPC idempotente, valor fixo definido no servidor, não no client).
    if (syncOpts && user) tryCreditReferral();
    // Nível 3: gatilho de conversão no pico emocional — no modo demo (logado ou não),
    // só em ganho grande (mesmo limiar usado pro som de "big win"), 1x por sessão.
    if ((guestMode && !user || inLocalDemo) && syncOpts && syncOpts.won && syncOpts.bet > 0 && (syncOpts.result / syncOpts.bet) >= 10) {
      try {
        if (!sessionStorage.getItem("ftg_bigwin_modal_shown")) {
          sessionStorage.setItem("ftg_bigwin_modal_shown", "1");
          setTimeout(() => setBigWinModal({ show: true, prize: syncOpts.result }), 900);
        }
      } catch {}
    }
  }

  function toggleMute(){setMuted(m=>{setAudioMuted(!m);return !m;});}
  function nav(path){setRoute(path.startsWith("/")?path:`/${path}`);window.scrollTo(0,0);}

  // Quando logado + demoMode ativo, joga-se com saldo demo local (nunca vai pro Supabase).
  // Sem login, o "guestMode" de sempre já cumpre esse papel (G já é local).
  const inLocalDemo = !!user && demoMode;
  const activeG = inLocalDemo ? demoG : G;
  const activeSetG = inLocalDemo ? setDemoG : setG;
  function toggleDemoMode(){ if(user) setDemoMode(d=>!d); }

  async function handleSignOut() {
    await signOut();
    setG(createState());
    setDemoG(createState());
    setDemoMode(false);
    setHistory([]);
    setGuestMode(false);
    nav('/');
  }

  function handleAuthSuccess() {
    setShowAuth(false);
    setGuestMode(false);
  }

  function handleGuestMode() {
    setGuestMode(true);
    setShowAuth(false);
  }

  // Nível 2: reivindica bônus diário e sincroniza saldo local + perfil
  // (perfil precisa recarregar pra travar novo claim até amanhã, mesmo com F5)
  async function handleClaimDaily() {
    const res = await claimDailyReward();
    if (res?.claimed && res.new_balance !== null && res.new_balance !== undefined) {
      setG(p => ({ ...p, saldo: Number(res.new_balance) }));
      if (user) fetchProfile(user.id);
    }
    return res;
  }

  // Loading inicial
  if (loading) return (
    <>
      <style>{CSS}</style>
      <div style={{height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#05070f',flexDirection:'column',gap:16}}>
        <div style={{fontSize:63}}>⭐</div>
        <div style={{fontFamily:"'Cinzel Decorative',serif",fontSize:18,color:'#f5c842',letterSpacing:2}}>CARREGANDO...</div>
      </div>
    </>
  );

  // Rota de reset de senha
  if (isResetRoute) return (
    <>
      <style>{CSS}</style>
      <ResetPasswordPage onDone={() => { nav('/'); setShowAuth(true); }} />
    </>
  );

  // Fase 5: rota oculta do painel admin
  if (route === '/admin') {
    if (!isAdminRoute) return (
      <>
        <style>{CSS}</style>
        <div style={{height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#05070f',color:'#6a7a9a',fontSize:17}}>Acesso restrito.</div>
      </>
    );
    return (
      <>
        <style>{CSS}</style>
        <AdminPanel user={user} />
      </>
    );
  }

  // Não logado e não em modo guest: mostra AuthModal
  const needsAuth = !user && !guestMode;

  function renderRoute(){
    if(route==="/"||route==="/home")return <HomePage G={activeG} onNav={nav} user={user} profile={profile} onClaimDaily={handleClaimDaily} fetchTopWins={fetchTopWins}/>;
    if(route==="/games")return <div style={{maxWidth:960,margin:"0 auto",padding:"20px 16px 100px"}}><div className="cd" style={{fontSize:24,fontWeight:700,color:"#f5c842",textAlign:"center",marginBottom:20}}>🎮 Todos os Jogos</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:16}}>{VISIBLE_GAMES.map(g=><GameCard key={g.id} game={g} onClick={()=>nav(`/jogo/${g.id}`)}/>)}</div></div>;
    if(route==="/stats")return <StatsPage G={activeG}/>;
    if(route==="/history")return <HistoryPage user={user} fetchHistory={fetchHistory} fetchTransactions={fetchTransactions} fetchGameStats={fetchGameStats} fetchPendingWithdrawals={fetchPendingWithdrawals} cancelWithdrawal={cancelWithdrawal}/>;
    if(route==="/profile")return <ProfilePage G={G} user={user} profile={profile} demoMode={demoMode} onSignOut={handleSignOut} onLogin={()=>setShowAuth(true)} onNav={nav} onDeposit={()=>setShowWallet(true)} onWithdraw={()=>setShowWithdrawal(true)} onCompleteCadastro={()=>{ setWithdrawalInitialStep('kyc'); setShowWithdrawal(true); }}/>;
    if(route.startsWith("/jogo/")){const id=route.replace("/jogo/","");const meta=GAMES.find(g=>g.id===id);const C=GC[id];if(C&&!meta?.hidden)return <C G={activeG} setG={activeSetG} history={history} addHistory={addHistory} user={user} demoMode={inLocalDemo}/>;}
    return <HomePage G={activeG} onNav={nav} user={user} profile={profile} onClaimDaily={handleClaimDaily} fetchTopWins={fetchTopWins}/>;
  }

  return <>
    <style>{CSS}</style>
    <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",background:"radial-gradient(ellipse 80% 50% at 20% 60%,rgba(0,100,80,.12) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 30%,rgba(120,60,0,.10) 0%,transparent 55%)",animation:"auP 8s ease-in-out infinite alternate"}}/>
    <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",backgroundImage:"linear-gradient(rgba(245,200,66,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(245,200,66,.03) 1px,transparent 1px)",backgroundSize:"60px 60px"}}/>
    <Particles/>
    <div style={{position:"relative",zIndex:1,minHeight:"100vh"}}>
      <Header G={activeG} setG={activeSetG} muted={muted} toggleMute={toggleMute} route={route} onNav={nav} user={user} profile={profile} onLogin={()=>{ setAuthInitialTab('login'); setShowAuth(true); }} onLogout={handleSignOut} guestMode={guestMode} demoMode={demoMode} onToggleDemo={toggleDemoMode} sessionMinutes={sessionMinutes} onDeposit={()=>setShowWallet(true)}/>
      <div style={{padding:"0 16px"}}>
        <Hint show={streakHint.visible} onClose={streakHint.dismiss} emoji="🔥">
          <strong>Bônus de streak ativado!</strong> A partir de 5 vitórias seguidas, seus prêmios ganham um bônus extra automático — quanto maior a sequência, maior o bônus. Ele zera se você perder uma rodada.
        </Hint>
      </div>
      <main>{renderRoute()}</main>
      <BottomNav route={route} onNav={nav}/>
    </div>
    {/* Auth Modal */}
    {(showAuth || needsAuth) && (
      <AuthModal
        onAuth={handleAuthSuccess}
        onGuest={handleGuestMode}
        authError={authError}
        setAuthError={setAuthError}
        signIn={signIn}
        signUp={signUp}
        resetPassword={resetPassword}
        initialTab={authInitialTab}
        refCode={refCode}
      />
    )}
    {/* Fase 5: Wallet Modal (depósito PIX) */}
    {showWallet && user && (
      <WalletModal
        user={user}
        profile={profile}
        onClose={()=>setShowWallet(false)}
        onDeposited={()=>{ fetchProfile(user.id); }}
        onKycSaved={()=>{ fetchProfile(user.id); }}
      />
    )}
    {/* Saque PIX */}
    {showWithdrawal && user && (
      <WithdrawalModal
        user={user}
        profile={profile}
        currentBalance={G.saldo}
        initialStep={withdrawalInitialStep}
        onClose={()=>{ setShowWithdrawal(false); setWithdrawalInitialStep(undefined); }}
        onWithdrawn={(newBalance)=>{ setG(p=>({...p,saldo:Number(newBalance)})); }}
        onKycSaved={()=>{ fetchProfile(user.id); }}
      />
    )}
    {/* Nível 3: conversão pós big-win no demo */}
    <BigWinConversionModal
      show={bigWinModal.show}
      prize={bigWinModal.prize}
      alreadyLoggedIn={!!user}
      onCreateAccount={()=>{ setBigWinModal({show:false,prize:0}); setAuthInitialTab('cadastro'); setShowAuth(true); }}
      onSwitchToReal={()=>{ setBigWinModal({show:false,prize:0}); setDemoMode(false); }}
      onDismiss={()=>setBigWinModal({show:false,prize:0})}
    />
  </>;
}
