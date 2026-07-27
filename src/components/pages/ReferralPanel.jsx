import { useState, useEffect, useMemo } from "react";
import { Panel } from "../shared/Panel";
import { fmt } from "../../game/constants";
import { supabase, hasSupabase } from "../../lib/supabase";

const LEVELS = [
  { name: "Conector",      need: 1,  emoji: "🔗" },
  { name: "Multiplicador", need: 3,  emoji: "⚡" },
  { name: "Líder",         need: 10, emoji: "🚀" },
  { name: "Embaixador",    need: 25, emoji: "👑" },
];

function levelInfo(qualificados) {
  let current = null, next = LEVELS[0];
  for (const l of LEVELS) {
    if (qualificados >= l.need) current = l;
    else { next = l; break; }
  }
  if (current && current.need === LEVELS[LEVELS.length - 1].need) next = null; // já é Embaixador
  return { current, next };
}

export function ReferralPanel({ user, profile }) {
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(-1);
  const [friendsPerMonth, setFriendsPerMonth] = useState(5);

  const code = profile?.referral_code;
  const referralLink = code
    ? `${window.location.origin}/r/${code}`
    : (profile?.username ? `${window.location.origin}/?ref=${profile.username}` : null);

  useEffect(() => {
    if (!hasSupabase || !user) return;
    let alive = true;
    supabase.rpc('get_referral_program_stats').then(({ data }) => {
      if (alive && data?.ok) setStats(data);
    }).catch(() => {});
    return () => { alive = false };
  }, [user]);

  function copyLink() {
    if (!referralLink) return;
    navigator.clipboard?.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Mensagens prontas — cada uma abre com uma linha curta que só existe
  // pra fazer a pessoa ler a linha seguinte (o gancho de curiosidade vem
  // antes do valor concreto, e o valor concreto vem antes do link).
  const templates = useMemo(() => {
    if (!referralLink) return [];
    return [
      `Achei uma forma de ganhar uma graninha extra sem fazer nada 👀\n\nToda vez que alguém entra pelo meu link e deposita, eu ganho até R$ 25 na hora.\n\nEntra pelo meu link e cadastra: ${referralLink}`,
      `Para de rolar 2 segundos 🛑\n\nTô te mandando isso porque literalmente ganho quando você entra — e você não perde nada. Dá uma olhada: ${referralLink}`,
      `Ei, separei um convite só pra você.\n\nQuem entra pelo link ganha bônus de boas-vindas, e se você curtir e quiser depositar depois, eu também ganho um bônus. Ganha-ganha: ${referralLink}`,
    ];
  }, [referralLink]);

  function copyTemplate(i) {
    navigator.clipboard?.writeText(templates[i]).then(() => {
      setCopiedMsg(i);
      setTimeout(() => setCopiedMsg(-1), 2000);
    });
  }

  function shareWhatsApp(i) {
    window.open(`https://wa.me/?text=${encodeURIComponent(templates[i])}`, '_blank');
  }

  if (!user || !referralLink) return null;

  const qualificados = stats?.qualificados ?? 0;
  const totalIndicados = stats?.total_indicados ?? 0;
  const totalBonus = stats?.total_bonus_recebido ?? 0;
  const pendentes = stats?.pendentes ?? 0;
  const { current, next } = levelInfo(qualificados);
  const progressPct = next ? Math.min(100, (qualificados / next.need) * 100) : 100;

  // Calculadora: mostra o intervalo de ganho possível, sem inventar
  // médias — ancora no cenário top (R$25) sem esconder o piso (R$5).
  const minMonthly = friendsPerMonth * 5;
  const maxMonthly = friendsPerMonth * 25;
  const minYearly = minMonthly * 12;
  const maxYearly = maxMonthly * 12;

  return (
    <div style={{ textAlign: "left", background: "linear-gradient(135deg,rgba(194,100,255,.10),rgba(194,100,255,.03))", border: "1px solid rgba(194,100,255,.28)", borderRadius: 14, padding: "16px 16px 18px", marginBottom: 16 }}>

      <div style={{ fontSize: 12.5, color: "#c264ff", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Programa de indicação</div>
      <div style={{ fontSize: 19, color: "#eeeaf0", fontWeight: 700, marginBottom: 6, lineHeight: 1.3 }}>
        Quanto dá pra ganhar indicando amigos?
      </div>
      <div style={{ fontSize: 13.5, color: "#9aa6ba", marginBottom: 14, lineHeight: 1.5 }}>
        Cada pessoa que entra pelo seu link e faz o primeiro depósito te dá um bônus na hora — sem limite de quantas vezes. Quanto mais o amigo deposita de primeira, maior o seu bônus.
      </div>

      {/* Link + copiar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, background: "rgba(0,0,0,.3)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: "9px 10px", fontSize: 13, color: "#c8d4e6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{referralLink}</div>
        <button onClick={copyLink} className="btn-press" style={{ flexShrink: 0, padding: "9px 14px", border: "none", borderRadius: 8, background: copied ? "linear-gradient(135deg,#00e5b0,#00b88a)" : "linear-gradient(135deg,#c264ff,#9040dd)", color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{copied ? "Copiado ✓" : "Copiar link"}</button>
      </div>

      {/* Faixas de bônus — números concretos, não "ganhe dinheiro" vago */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 14 }}>
        {[{ f: "R$20–34", v: "R$5" }, { f: "R$35–99", v: "R$10" }, { f: "R$100+", v: "R$25" }].map(x => (
          <div key={x.f} style={{ background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, padding: "8px 6px", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#6a7a9a" }}>1º depósito {x.f}</div>
            <div style={{ fontSize: 17, color: "#f5c842", fontWeight: 700 }}>{x.v}</div>
          </div>
        ))}
      </div>

      {/* Estatísticas reais do usuário */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          <Panel><div style={{ fontSize: 22, fontWeight: 700, color: "#4da6ff" }}>{totalIndicados}</div><div style={{ fontSize: 11.5, color: "#6a7a9a", textTransform: "uppercase" }}>Indicados</div></Panel>
          <Panel><div style={{ fontSize: 22, fontWeight: 700, color: "#2dde98" }}>{qualificados}</div><div style={{ fontSize: 11.5, color: "#6a7a9a", textTransform: "uppercase" }}>Depositaram</div></Panel>
          <Panel><div style={{ fontSize: 22, fontWeight: 700, color: "#f5c842" }}>{fmt(totalBonus)}</div><div style={{ fontSize: 11.5, color: "#6a7a9a", textTransform: "uppercase" }}>Recebido</div></Panel>
        </div>
      )}
      {stats && pendentes > 0 && (
        <div style={{ fontSize: 12.5, color: "#8a96aa", marginBottom: 14 }}>⏳ {pendentes} amigo{pendentes > 1 ? "s" : ""} cadastrado{pendentes > 1 ? "s" : ""}, ainda sem depositar.</div>
      )}

      {/* Gamificação — goal-gradient: mostra a distância até o próximo nível */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <div style={{ fontSize: 13, color: "#c8d4e6" }}>
            Nível: <strong style={{ color: "#c264ff" }}>{current ? `${current.emoji} ${current.name}` : "Iniciante"}</strong>
          </div>
          {next && <div style={{ fontSize: 12, color: "#6a7a9a" }}>faltam {next.need - qualificados} pra {next.emoji} {next.name}</div>}
        </div>
        <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progressPct}%`, background: "linear-gradient(90deg,#c264ff,#f5c842)", borderRadius: 4, transition: "width .3s" }} />
        </div>
      </div>

      {/* Calculadora de potencial de ganho */}
      <div style={{ background: "rgba(0,0,0,.25)", border: "1px solid rgba(245,200,66,.2)", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, color: "#f5c842", fontWeight: 700, marginBottom: 8 }}>💡 Se você indicar {friendsPerMonth} amigo{friendsPerMonth > 1 ? "s" : ""} por mês...</div>
        <input type="range" min={1} max={30} value={friendsPerMonth} onChange={e => setFriendsPerMonth(+e.target.value)}
          style={{ width: "100%", marginBottom: 10, accentColor: "#f5c842" }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: "#6a7a9a", textTransform: "uppercase" }}>Por mês</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#eeeaf0" }}>{fmt(minMonthly)} <span style={{ color: "#6a7a9a", fontWeight: 400, fontSize: 13 }}>a</span> <span style={{ color: "#2dde98" }}>{fmt(maxMonthly)}</span></div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#6a7a9a", textTransform: "uppercase" }}>Em 1 ano</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#eeeaf0" }}>{fmt(minYearly)} <span style={{ color: "#6a7a9a", fontWeight: 400, fontSize: 13 }}>a</span> <span style={{ color: "#2dde98" }}>{fmt(maxYearly)}</span></div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#6a7a9a", marginTop: 8, lineHeight: 1.4 }}>Faixa entre o bônus mínimo (R$5) e o máximo (R$25) por amigo, dependendo do valor do primeiro depósito de cada um.</div>
      </div>

      {/* Mensagens prontas — a linha de abertura só existe pra fazer ler a próxima */}
      <div style={{ fontSize: 13.5, color: "#c8d4e6", fontWeight: 700, marginBottom: 8 }}>📲 Mensagens prontas pra mandar agora</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {templates.map((t, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 12.5, color: "#9aa6ba", marginBottom: 8, whiteSpace: "pre-line", lineHeight: 1.4 }}>{t.length > 110 ? t.slice(0, 110) + "…" : t}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => shareWhatsApp(i)} className="btn-press" style={{ flex: 1, padding: "7px 10px", border: "none", borderRadius: 6, background: "linear-gradient(135deg,#25D366,#1ea952)", color: "#000", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>WhatsApp</button>
              <button onClick={() => copyTemplate(i)} className="btn-press" style={{ padding: "7px 12px", border: "1px solid rgba(255,255,255,.15)", borderRadius: 6, background: "rgba(255,255,255,.04)", color: "#c8d4e6", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>{copiedMsg === i ? "Copiado ✓" : "Copiar"}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
