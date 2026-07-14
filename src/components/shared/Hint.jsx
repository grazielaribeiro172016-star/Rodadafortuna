// ═══ HINT — dica contextual dispensável (aparece 1x na vida do usuário) ═══
export function Hint({ show, onClose, children, emoji = "💡" }) {
  if (!show) return null;
  return (
    <div
      className="fade-in-up"
      style={{
        position: "relative",
        margin: "10px auto 0",
        maxWidth: 440,
        background: "rgba(0,229,176,.08)",
        border: "1px solid rgba(0,229,176,.3)",
        borderRadius: 12,
        padding: "10px 14px",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <div style={{ fontSize: 20, lineHeight: 1 }}>{emoji}</div>
      <div style={{ flex: 1, fontSize: 13.5, color: "#c8d4e6", lineHeight: 1.45 }}>{children}</div>
      <button
        onClick={onClose}
        aria-label="Fechar dica"
        style={{ background: "none", border: "none", color: "#6a7a9a", cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1 }}
      >
        ✕
      </button>
    </div>
  );
}
