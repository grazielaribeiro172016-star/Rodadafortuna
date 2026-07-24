import { fmt } from "../../game/constants";

// ═══ Nível 3: gatilho de conversão no pico emocional (pós big-win) ═══
// Não bloqueia o jogo — a pessoa pode fechar e continuar jogando no demo normalmente.
export function BigWinConversionModal({ show, prize, alreadyLoggedIn, onCreateAccount, onSwitchToReal, onDismiss }) {
  if (!show) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(5,7,15,.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="fade-in-up" style={{ maxWidth: 380, width: "100%", background: "linear-gradient(160deg,#0c1226,#080c1a)", border: "1px solid rgba(245,200,66,.3)", borderRadius: 18, padding: "28px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 46, marginBottom: 6 }}>🎉</div>
        <div className="cd" style={{ fontSize: 21, fontWeight: 800, color: "#f5c842", marginBottom: 8 }}>
          Ganhou de verdade!
        </div>
        <div style={{ fontSize: 14.5, color: "#c8d4e6", lineHeight: 1.5, marginBottom: 14 }}>
          Você acabou de ganhar <strong style={{ color: "#00e5b0" }}>{fmt(prize)}</strong> no modo teste.
          {alreadyLoggedIn
            ? " Quer voltar a jogar com seu saldo real?"
            : " Crie uma conta gratuita pra jogar com saldo de verdade."}
        </div>
        <button
          onClick={alreadyLoggedIn ? onSwitchToReal : onCreateAccount}
          className="btn-press"
          style={{ width: "100%", background: "linear-gradient(135deg,#f5c842,#e8a020)", border: "none", color: "#000", fontSize: 15, padding: "12px", borderRadius: 12, cursor: "pointer", fontWeight: 700, marginBottom: 10 }}
        >
          {alreadyLoggedIn ? "Voltar pro saldo real" : "Criar conta grátis"}
        </button>
        <button onClick={onDismiss} style={{ width: "100%", background: "none", border: "none", color: "#6a7a9a", fontSize: 13.5, padding: "6px", cursor: "pointer" }}>
          Agora não, continuar no demo
        </button>
        {!alreadyLoggedIn && (
          <div style={{ fontSize: 12.5, color: "#8a96aa", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: "8px 12px", marginTop: 14, textAlign: "left" }}>
            ⚠️ O saldo e o streak do modo demo são só de teste — ao criar conta, você começa do zero com saldo padrão, o progresso daqui não é transferido.
          </div>
        )}
      </div>
    </div>
  );
}
