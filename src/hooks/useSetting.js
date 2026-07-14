import { useState, useCallback } from "react";

// Configurações do jogador, salvas no localStorage (client-side, não precisa
// de coluna no banco). Cada instância lê o valor atual ao montar; como as
// páginas do app são roteadas uma de cada vez (só uma montada por vez),
// isso é suficiente pra refletir mudanças ao navegar entre telas.
const PREFIX = "ftg_setting_";

export function useSetting(key, defaultValue) {
  const storageKey = PREFIX + key;
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw === null ? defaultValue : JSON.parse(raw);
    } catch {
      return defaultValue;
    }
  });

  const update = useCallback((newValue) => {
    setValue(newValue);
    try { localStorage.setItem(storageKey, JSON.stringify(newValue)); } catch {}
  }, [storageKey]);

  return [value, update];
}
