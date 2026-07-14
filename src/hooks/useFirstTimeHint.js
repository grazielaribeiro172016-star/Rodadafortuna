import { useState, useCallback } from "react";

// Controla dicas contextuais que devem aparecer apenas na primeira vez
// que um evento acontece (ex: primeiro streak bônus, primeiro near-miss).
// Usa localStorage — funciona tanto pra conta logada quanto pra modo demo,
// e não exige nenhuma coluna nova no banco.
const PREFIX = "ftg_hint_";

export function useFirstTimeHint(key) {
  const storageKey = PREFIX + key;
  const [seen, setSeen] = useState(() => {
    try { return localStorage.getItem(storageKey) === "1"; } catch { return true; }
  });
  const [visible, setVisible] = useState(false);

  const trigger = useCallback(() => {
    setSeen(prevSeen => {
      if (!prevSeen) setVisible(true);
      return prevSeen;
    });
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    setSeen(true);
    try { localStorage.setItem(storageKey, "1"); } catch {}
  }, [storageKey]);

  return { visible, trigger, dismiss };
}
