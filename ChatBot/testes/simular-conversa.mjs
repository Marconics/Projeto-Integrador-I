// Simula conversas do WhatsApp chamando o handleMessage do bot de verdade,
// sem abrir o WhatsApp: as mensagens são objetos falsos e as respostas do
// bot aparecem no terminal (🤖). No fim, envia a fila de alertas para um
// "cliente WhatsApp" falso.
//
// Pré-requisitos (na pasta Backend, em terminais separados):
//   npm run banco:teste   e   npm run back:teste
//   e rode ANTES o  npm run teste:api  (ele cadastra cidade, bairros e inscritos)
// Depois, na pasta ChatBot:
//   npm run teste:conversa
process.env.API_URL = process.env.API_URL || 'http://127.0.0.1:3000'
process.env.BOT_API_KEY = 'chave-de-teste'
process.env.NOTIFICACOES_PAUSA_MS = '10'

// Trava de segurança: só roda contra a API em MODO TESTE (a API real recusa a chave de teste)
{
  const r = await fetch(`${process.env.API_URL}/api/bot/inscritos/verificacao-modo-teste`, { headers: { 'x-bot-key': 'chave-de-teste' } })
  if (r.status !== 404) {
    console.error(`✗ A API em ${process.env.API_URL} NÃO está em modo teste (resposta ${r.status}). Use npm run back:teste no Backend.`)
    process.exit(1)
  }
}

// import dinâmico: as variáveis acima precisam existir antes de carregar o bot
const { handleMessage } = await import('../controllers/message-controller.js')
const { iniciarEnvioDeNotificacoes } = await import('../services/notificacao-service.js')

const FOTO_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

function mensagem(from, body, extra = {}) {
  return {
    from, body, hasMedia: false, author: extra.author,
    reply: async (t) => console.log(`   🤖 ${t.replace(/\n/g, '\n      ')}`),
    getContact: async () => ({ number: from.split('@')[0] }),
    downloadMedia: async () => ({ data: FOTO_PNG, mimetype: 'image/png' }),
    getChat: async () => ({ isGroup: true, participants: [{ id: { _serialized: 'adm@c.us', user: 'adm' }, isAdmin: true }] }),
    ...extra,
  }
}

async function diz(from, body, extra) {
  console.log(`\n👤 [${from.split('@')[0]}] ${extra?.hasMedia ? '<FOTO>' : body}`)
  await handleMessage(mensagem(from, body, extra), null)
}

const eu = '5512988887777@c.us'
await diz(eu, 'Oiii!')        // saudação com letras repetidas → menu
await diz(eu, 'OLAA')         // maiúsculas → menu
await diz(eu, '5')            // alertas ativos
await diz(eu, '1')            // alertas → convite (não inscrito)
await diz(eu, '2')            // entrar no grupo da cidade → link
await diz(eu, '1')            // volta aos alertas
await diz(eu, '1')            // quero me inscrever
await diz(eu, 'Maria Teste')
await diz(eu, 'email-errado')
await diz(eu, 'maria@teste.com')
await diz(eu, 'indep')        // bairro por parte do nome
await diz(eu, '3')            // acompanhar outro bairro
await diz(eu, '12070-610')    // pelo CEP
await diz(eu, '1')            // confirma bairro do CEP
await diz(eu, '2')            // grupo da cidade (inscrito)
await diz(eu, '1')            // volta aos alertas
await diz(eu, '1')            // relatar
await diz(eu, '2')            // local: bairro acompanhado
await diz(eu, '1')            // alagamento
await diz(eu, '1')            // grave
await diz(eu, 'olha lá')      // texto em vez de foto
await diz(eu, '', { hasMedia: true })
await diz(eu, '1')            // enviar
await diz(eu, 'bom dia')      // saudação → menu
await diz(eu, '2')            // solicitar apoio
await diz(eu, 'Rua das Flores, 10 - Centro')
await diz(eu, '3')
await diz(eu, '2')            // alimentação
await diz(eu, 'não')
await diz(eu, '4')            // apoio psicológico
await diz(eu, '2')
await diz(eu, 'nao')
await diz(eu, '3')
await diz(eu, '6')            // telefones
await diz(eu, '7')            // indicar abrigo
await diz(eu, 'cancelar')     // cancela qualquer fluxo
await diz(eu, 'xyz')          // não entendi → menu
await diz(eu, '3')            // abrigos via API
await diz(eu, 'vincular 12')  // responsável de abrigo: código curto
await diz(eu, 'Vincular 123 456') // código que não existe → aviso
await diz(eu, 'ACEITAR')      // sem convite para este número → aviso
await diz(eu, '8')            // encerrar

// Grupo
await diz('120363999@g.us', 'bom dia pessoal')   // ignorado
await diz('120363999@g.us', '!alertas id')
await diz('120363999@g.us', '!alertas vincular Taubate', { author: 'comum@c.us' })
await diz('120363999@g.us', '!alertas vincular Taubate', { author: 'adm@c.us' })

// Envio da fila com um cliente falso
console.log('\n===== ENVIO DA FILA =====')
const enviados = []
const clienteFalso = {
  sendMessage: async (destino, conteudo, opcoes) => {
    if (destino.startsWith('551100000002')) throw new Error('número inválido (simulado)')
    enviados.push(destino)
    console.log(`   📤 ${destino} ${typeof conteudo === 'string' ? '(texto)' : '(foto + legenda)'} ${opcoes?.caption ? '' : ''}`)
  }
}
iniciarEnvioDeNotificacoes(clienteFalso)
await new Promise(r => setTimeout(r, 4000))
console.log(`\nEnviadas: ${enviados.length}`)
process.exit(0)
