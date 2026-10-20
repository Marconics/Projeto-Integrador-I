// Mantém o bot ligado: roda o index.js e, se ele cair, liga de novo.
//
// Uso (na pasta ChatBot):  npm run bot      (Ctrl + C para desligar de vez)
//
// O index.js encerra sozinho quando percebe que a página do WhatsApp Web
// quebrou ("detached Frame", desconexão, verificação de saúde falhando).
// Aqui ele é religado depois de alguns segundos. A sessão fica salva em
// .wwebjs_auth/, então não precisa ler o QR Code de novo (só se o WhatsApp
// tiver desconectado o aparelho — aí o QR aparece neste terminal).
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pastaBot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

const ESPERA_MS = 5000             // pausa antes de religar
const JANELA_MS = 2 * 60 * 1000    // se cair muitas vezes nesse intervalo...
const MAX_QUEDAS = 5               // ...espera mais antes de tentar de novo
const ESPERA_LONGA_MS = 60 * 1000

let quedas = []
let desligando = false
let bot = null

const hora = () => new Date().toLocaleTimeString('pt-BR')

function ligar() {
  console.log(`[VIGIA ${hora()}] Ligando o bot...`)
  bot = spawn(process.execPath, ['index.js'], { cwd: pastaBot, stdio: 'inherit' })

  bot.on('exit', (codigo, sinal) => {
    bot = null
    if (desligando) return

    const agora = Date.now()
    quedas = [...quedas.filter(t => agora - t < JANELA_MS), agora]
    const espera = quedas.length >= MAX_QUEDAS ? ESPERA_LONGA_MS : ESPERA_MS

    console.log(`[VIGIA ${hora()}] O bot parou (código ${codigo ?? sinal}). Religando em ${espera / 1000}s...`)
    setTimeout(ligar, espera)
  })
}

// Ctrl + C: desliga o bot e o vigia
function desligar() {
  if (desligando) return
  desligando = true
  console.log(`\n[VIGIA ${hora()}] Desligando...`)
  if (!bot) process.exit(0)
  bot.once('exit', () => process.exit(0))
  bot.kill()
  setTimeout(() => process.exit(0), 15000) // não espera para sempre
}
process.on('SIGINT', desligar)
process.on('SIGTERM', desligar)

ligar()
