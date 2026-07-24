import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Conta quantos jogos existem de verdade em src/game/constants.js, lendo o
// arquivo-fonte (não executando o React) — assim o meta description do
// index.html (usado por WhatsApp/Telegram pra montar o card de
// compartilhamento) nunca fica desatualizado, sem precisar editar 2 lugares
// toda vez que um jogo for adicionado ou removido.
function countGames() {
  const src = readFileSync(resolve(__dirname, 'src/game/constants.js'), 'utf-8')
  const match = src.match(/export const GAMES\s*=\s*\[([\s\S]*?)\n\];/)
  if (!match) return 15 // fallback de segurança, não deveria acontecer
  const count = (match[1].match(/\{id:/g) || []).length
  return count || 15
}

// Injeta o placeholder {{GAME_COUNT}} do index.html com o número real na
// hora do build (transformIndexHtml roda em todo `npm run build`/`vite dev`).
function injectGameCount() {
  return {
    name: 'inject-game-count',
    transformIndexHtml(html) {
      const n = countGames()
      return html.replaceAll('{{GAME_COUNT}}', String(n))
    },
  }
}

export default defineConfig({
  plugins: [react(), injectGameCount()],
})
