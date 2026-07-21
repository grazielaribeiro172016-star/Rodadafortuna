import { useState, useEffect, useRef } from "react";
import { fmt, GAMES } from "../../game/constants";
import { GameCard } from "./GameCard";

// Compara a data (formato YYYY-MM-DD, como vem da coluna DATE do Postgres)
// com "hoje" no fuso de Brasília.
function isTodayBR(dateStr) {
  if (!dateStr) return false;
  const todayBR = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return dateStr === todayBR;
}

// Nível 3: escolhe 2 jogos ao acaso pra destacar — rotação simples, sem
// dado real de comportamento (não é "mais jogado" nem histórico pessoal),
// só pra dar hierarquia visual em vez do grid uniforme de 15 jogos.
function pickFeatured() {
  const shuffled = [...GAMES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 2);
}

// ═══ PAGES ════════════════════════════════════════════════════
export function HomePage({ G, onNav, user, profile, onClaimDaily, fetchTopWins }) {
  const [featured] = useState(pickFeatured); // fixo durante a visita, muda na próxima

  // ── Marketing honesto: maiores vitórias reais já registradas no banco ──
  // Dado público, funciona mesmo sem login (modo demo também vê).
  const [topWins, setTopWins] = useState(null); // null = carregando, [] = ainda sem dados
  useEffect(() => {
    let alive = true;
    if (fetchTopWins) {
      fetchTopWins(5).then(rows => { if (alive) setTopWins(rows); });
    } else {
      setTopWins([]);
    }
    return () => { alive = false; };
  }, [fetchTopWins]);
  const gameMeta = Object.fromEntries(GAMES.map(g => [g.id, g]));

  // ── Nível 2: banner "bem-vindo de volta" quando existe streak ativo ──
  // Aparece no máximo 1x por sessão de navegador (sessionStorage).
  const [showReturnBanner, setShowReturnBanner] = useState(false);
  const checkedReturnRef = useRef(false);
  useEffect(() => {
    if (checkedReturnRef.current) return;
    if (G.streak <= 0) return;
    checkedReturnRef.current = true;
    try {
      const seen = sessionStorage.getItem("ftg_return_banner_seen");
      if (!seen) {
        setShowReturnBanner(true);
        sessionStorage.setItem("ftg_return_banner_seen", "1");
      }
    } catch {}
  }, [G.streak]);

  // ── Nível 2: recompensa de login diário (só para contas logadas) ──
  const [claimState, setClaimState] = useState("idle"); // idle | claiming | claimed | already
  const [claimedAmount, setClaimedAmount] = useState(0);
  const alreadyClaimedToday = isTodayBR(profile?.last_daily_reward);
  const showDailyCard = !!user && !!onClaimDaily && !alreadyClaimedToday && claimState !== "claimed";

  async function handleClaim() {
    if (claimState === "claiming") return;
    setClaimState("claiming");
    const res = await onClaimDaily();
    if (res?.claimed) {
      setClaimedAmount(res.amount || 0);
      setClaimState("claimed");
    } else {
      setClaimState("already");
    }
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ textAlign: "center", padding: "40px 20px 30px" }}>
        <div style={{ fontSize: 15, letterSpacing: 4, textTransform: "uppercase", color: "#00e5b0", marginBottom: 12, fontWeight: 600 }}>
          BEM-VINDO AO LONG777
        </div>
        <div className="cd" style={{ fontSize: 39, fontWeight: 900, background: "linear-gradient(90deg,#f5c842,#fff8dc,#f5c842)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1.2, marginBottom: 12 }}>
          Bora buscar a sorte grande?
        </div>
        <div style={{ fontSize: 17, color: "#6a7a9a", maxWidth: 440, margin: "0 auto 20px" }}>
          15 jogos exclusivos. Escolha sua mesa e descubra se hoje é o seu grande dia.
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {[
            { l: "💰 Saldo", v: fmt(G.saldo), c: "#f5c842", bg: "rgba(245,200,66,.08)", bc: "rgba(245,200,66,.25)" },
            { l: "🔥 Streak", v: G.streak, c: "#00e5b0", bg: "rgba(0,229,176,.08)", bc: "rgba(0,229,176,.25)" },
            { l: "🐉 Dragões", v: G.dragons, c: "#c264ff", bg: "rgba(194,100,255,.08)", bc: "rgba(194,100,255,.25)" },
          ].map(s => (
            <div key={s.l} style={{ padding: "6px 14px", borderRadius: 20, background: s.bg, border: `1px solid ${s.bc}`, fontSize: 16, color: s.c, fontWeight: 600 }}>
              {s.l}: <strong>{s.v}</strong>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 16px", maxWidth: 960, margin: "0 auto" }}>
        {/* Nível 2: banner de retorno com streak ativo */}
        {showReturnBanner && (
          <div className="fade-in-up" style={{ display: "flex", gap: 10, alignItems: "center", background: "linear-gradient(135deg,rgba(0,229,176,.1),rgba(245,200,66,.06))", border: "1px solid rgba(0,229,176,.3)", borderRadius: 14, padding: "12px 16px", marginBottom: 14 }}>
            <div style={{ fontSize: 24 }}>🔥</div>
            <div style={{ flex: 1, fontSize: 14.5, color: "#e8f0fa" }}>
              Bem-vindo de volta! Sua sequência de <strong>{G.streak}</strong> vitória{G.streak !== 1 ? "s" : ""} ainda está ativa — continue jogando pra não perdê-la.
            </div>
            <button onClick={() => setShowReturnBanner(false)} aria-label="Fechar" style={{ background: "none", border: "none", color: "#6a7a9a", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
        )}

        {/* Nível 2: recompensa de login diário */}
        {showDailyCard && (
          <div className="fade-in-up" style={{ display: "flex", gap: 12, alignItems: "center", background: "linear-gradient(135deg,rgba(245,200,66,.14),rgba(232,160,32,.06))", border: "1px solid rgba(245,200,66,.35)", borderRadius: 14, padding: "12px 16px", marginBottom: 14 }}>
            <div style={{ fontSize: 26 }}>🎁</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, color: "#f5c842", fontWeight: 700 }}>Bônus diário disponível</div>
              <div style={{ fontSize: 12.5, color: "#9aa6ba" }}>Reivindique 1x por dia, sem pegadinha — valor fixo de R$ 1,00.</div>
            </div>
            <button
              onClick={handleClaim}
              disabled={claimState === "claiming"}
              className="btn-press"
              style={{ background: "linear-gradient(135deg,#f5c842,#e8a020)", border: "none", color: "#000", fontSize: 14, padding: "8px 16px", borderRadius: 10, cursor: claimState === "claiming" ? "default" : "pointer", fontWeight: 700, whiteSpace: "nowrap", opacity: claimState === "claiming" ? 0.7 : 1 }}
            >
              {claimState === "claiming" ? "..." : "Reivindicar"}
            </button>
          </div>
        )}
        {claimState === "claimed" && (
          <div className="fade-in-up" style={{ fontSize: 13.5, color: "#00e5b0", background: "rgba(0,229,176,.08)", border: "1px solid rgba(0,229,176,.25)", borderRadius: 10, padding: "8px 14px", marginBottom: 14 }}>
            🎉 +{fmt(claimedAmount)} creditado! Volte amanhã pra reivindicar de novo.
          </div>
        )}
        {claimState === "already" && (
          <div className="fade-in-up" style={{ fontSize: 13.5, color: "#6a7a9a", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: "8px 14px", marginBottom: 14 }}>
            Você já reivindicou seu bônus hoje. Volte amanhã!
          </div>
        )}

        {/* Destaques reais — só aparece quando já existem vitórias registradas */}
        {topWins && topWins.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: "#8a96aa", marginBottom: 10, fontWeight: 600 }}>
              🐉 Já saiu por aqui
            </div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
              {topWins.map((w, i) => {
                const meta = gameMeta[w.game] || {};
                return (
                  <div key={i} style={{ flex: "0 0 auto", minWidth: 190, background: "linear-gradient(135deg,rgba(194,100,255,.1),rgba(245,200,66,.05))", border: "1px solid rgba(194,100,255,.25)", borderRadius: 12, padding: "10px 14px" }}>
                    <div style={{ fontSize: 22 }}>{meta.emoji || "🎰"}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#c264ff" }}>{fmt(w.result)}</div>
                    <div style={{ fontSize: 11.5, color: "#6a7a9a" }}>{meta.name || w.game} • {w.username}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: "#4a5568", marginTop: 6 }}>
              Vitórias reais registradas na plataforma — mesmo RTP pro modo demo e pra conta real.
            </div>
          </div>
        )}

        <div style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: "#8a96aa", marginBottom: 10, fontWeight: 600 }}>
          ✨ Em destaque agora
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 16, marginBottom: 22 }}>
          {featured.map(g => <GameCard key={g.id} game={g} onClick={() => onNav(`/jogo/${g.id}`)} />)}
        </div>

        <div style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: "#8a96aa", marginBottom: 10, fontWeight: 600 }}>
          🎮 Todos os jogos
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 16 }}>
          {GAMES.map(g => <GameCard key={g.id} game={g} onClick={() => onNav(`/jogo/${g.id}`)} />)}
        </div>
      </div>
    </div>
  );
}
