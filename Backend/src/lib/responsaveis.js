// Responsáveis do abrigo no WhatsApp: convites, vínculo e avisos
//
// Como funciona:
// 1. O admin confere quem é o responsável (ligação para o contato oficial,
//    prefeitura, visita...) e cria um CONVITE dizendo como conferiu.
//    Quando uma solicitação de abrigo feita pelo bot é aprovada, o convite
//    é criado sozinho para quem pediu (se a pessoa aceitou receber avisos).
// 2. O convite chega de um destes jeitos:
//    - mensagem do bot para o celular → a pessoa responde ACEITAR ou RECUSAR;
//    - link/código que o admin repassa → a pessoa envia "vincular 123456".
// 3. Só quando a própria pessoa responde DO NÚMERO DELA o vínculo é criado
//    (ResponsavelAbrigo). Assim o número fica comprovado.
// 4. Os avisos do abrigo (voluntário interessado, novo responsável...) entram
//    na mesma fila de notificações dos alertas e o bot envia.
import { createHash, randomInt, timingSafeEqual } from 'node:crypto'


// Quanto tempo o convite vale
export const VALIDADE_CONVITE_HORAS = 72

// Como o admin conferiu a pessoa (o "solicitacao_aprovada" é só automático)
export const METODOS_CONFERENCIA = {
  solicitacao_aprovada:    'Pediu o abrigo pelo bot e declarou ser o responsável (solicitação aprovada)',
  numero_do_cadastro:      'Celular que já estava no cadastro do abrigo',
  ligacao_contato_oficial: 'Ligação para um contato oficial do local',
  orgao_publico:           'Confirmado com a prefeitura / Defesa Civil',
  presencial:              'Código entregue pessoalmente no abrigo',
}
export const METODOS_DO_ADMIN = Object.keys(METODOS_CONFERENCIA).filter(m => m !== 'solicitacao_aprovada')

// Métodos em que o admin precisa anotar com quem confirmou
export const METODOS_COM_OBSERVACAO = ['ligacao_contato_oficial', 'orgao_publico']


// ─── TELEFONE ────────────────────────────────────────────────────

const digitos = (texto) => String(texto ?? '').replace(/\D/g, '')

// "(12) 99999-0000" ou "5512999990000" → "5512999990000" (só celular; fixo não tem WhatsApp)
export function normalizarCelular(texto) {
  let d = digitos(texto)
  if (d.length === 13 && d.startsWith('55')) d = d.slice(2)
  if (d.length !== 11 || d[2] !== '9') return null
  return `55${d}`
}

// Chave para comparar números: DDD + últimos 8 dígitos.
// O WhatsApp às vezes devolve números antigos sem o 9 da frente
// (551299990000 em vez de 5512999990000) — assim os dois batem.
export function chaveTelefone(texto) {
  let d = digitos(texto)
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
  if (d.length < 10) return null
  return d.slice(0, 2) + d.slice(-8)
}

export const mesmoTelefone = (a, b) => {
  const ca = chaveTelefone(a)
  return Boolean(ca) && ca === chaveTelefone(b)
}

// Destino do WhatsApp para um celular normalizado
export const whatsappDoCelular = (celular) => `${celular}@c.us`

// "5512999990000" → "(12) 99999-0000"
export function formatarTelefone(texto) {
  const d = digitos(texto).replace(/^55(?=\d{10,11}$)/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return texto ?? ''
}


// ─── CÓDIGO DO LINK ──────────────────────────────────────────────

export const gerarCodigo = () => String(randomInt(0, 1_000_000)).padStart(6, '0')
export const hashCodigo = (codigo) => createHash('sha256').update(String(codigo)).digest('hex')

// Link que abre o WhatsApp do bot com a mensagem pronta (precisa do
// BOT_WHATSAPP_NUMERO no .env; sem ele, a tela mostra só o código)
export function linkDoCodigo(codigo) {
  const numero = digitos(process.env.BOT_WHATSAPP_NUMERO)
  if (!numero) return null
  return `https://wa.me/${numero}?text=${encodeURIComponent(`vincular ${codigo}`)}`
}


// ─── CHAVE DO BOT ────────────────────────────────────────────────

// true se a requisição veio do ChatBot (cabeçalho x-bot-key certo).
// Usado em rotas públicas que aceitam dados extras só do bot.
export function veioDoBot(request) {
  const esperada = process.env.BOT_API_KEY
  if (!esperada) return false
  const a = Buffer.from(String(request.headers['x-bot-key'] ?? ''))
  const b = Buffer.from(esperada)
  return a.length === b.length && timingSafeEqual(a, b)
}


// ─── TEXTOS DAS MENSAGENS ────────────────────────────────────────
// Mesmo padrão das mensagens do bot (título com emoji + separador)

export const SEPARADOR = '━━━━━━━━━━━━━━━━'

function mensagemConvite(abrigo, origem) {
  const motivo = origem === 'solicitacao'
    ? `O local *${abrigo.nome}* que você indicou foi *aprovado* como abrigo. 🎉\nNo pedido, você disse que é o responsável pelo local.`
    : `A equipe do S.O.S Vale indicou você como responsável pelo abrigo *${abrigo.nome}*.`

  return [
    `🏠 *ABRIGO ${abrigo.nome.toUpperCase()}*`,
    SEPARADOR,
    ``,
    motivo,
    ``,
    `Você é responsável por este abrigo e quer receber os avisos dele aqui no WhatsApp (voluntários interessados em ajudar, avisos da equipe)?`,
    ``,
    `✅ Responda *ACEITAR* para confirmar`,
    `❌ Responda *RECUSAR* se não for você`,
    ``,
    `_O convite vale por ${VALIDADE_CONVITE_HORAS / 24} dias._`,
  ].join('\n')
}

function mensagemNovoResponsavel(abrigo, responsavel) {
  return [
    `🏠 *ABRIGO ${abrigo.nome.toUpperCase()}*`,
    SEPARADOR,
    ``,
    `👤 *${responsavel.nome}* (${formatarTelefone(responsavel.telefone) || 'número não informado'}) agora recebe os avisos deste abrigo pelo S.O.S Vale.`,
    ``,
    `Não reconhece essa pessoa? Fale com a Defesa Civil (*199*) ou com a equipe do S.O.S Vale.`,
  ].join('\n')
}

export function mensagemDesvinculado(abrigo) {
  return [
    `🏠 *ABRIGO ${abrigo.nome.toUpperCase()}*`,
    SEPARADOR,
    ``,
    `Você não recebe mais os avisos deste abrigo pelo S.O.S Vale.`,
    ``,
    `Se foi engano, fale com a equipe do S.O.S Vale.`,
  ].join('\n')
}

export function mensagemInteresseVoluntario(abrigo, solicitacao, voluntario) {
  return [
    `🙋 *VOLUNTÁRIO QUER AJUDAR*`,
    SEPARADOR,
    ``,
    `🏠 ${abrigo.nome}`,
    `📋 Pedido: *${solicitacao.titulo}*`,
    ``,
    `👤 ${voluntario.nome}`,
    voluntario.telefone ? `📞 ${voluntario.telefone}` : null,
    `📧 ${voluntario.email}`,
    ``,
    `Entre em contato para combinar a ajuda.`,
  ].filter(linha => linha !== null).join('\n')
}

// Respostas que o bot manda na conversa (a API devolve o texto pronto)
export function mensagemBoasVindas(abrigo) {
  return [
    `✅ *TUDO CERTO!*`,
    SEPARADOR,
    ``,
    `Você agora é responsável pelo abrigo *${abrigo.nome}* no S.O.S Vale.`,
    ``,
    `Por aqui você vai receber:`,
    `🙋 voluntários interessados nos pedidos de ajuda do abrigo`,
    `📢 avisos da equipe do S.O.S Vale`,
    ``,
    `_Para deixar de receber, fale com a equipe do S.O.S Vale._`,
  ].join('\n')
}


// ─── CONVITE E VÍNCULO ───────────────────────────────────────────

// Convites que ainda podem ser aceitos
export const whereConviteValido = () => ({ status: 'pendente', expiraEm: { gt: new Date() } })

// Cria o convite e, se for por mensagem, coloca a pergunta na fila do bot.
// Devolve { convite, codigo } — o código (convite por link) só existe aqui.
export async function criarConvite(tx, {
  abrigo, nome, celular, whatsappId, forma, origem, metodoConferencia, observacao, criadoPorId
}) {
  const codigo = forma === 'link' ? gerarCodigo() : null

  const convite = await tx.conviteResponsavel.create({
    data: {
      abrigoId: abrigo.id_abrigo,
      nome: nome || null,
      telefone: celular ?? null,
      whatsappId: whatsappId ?? null,
      codigoHash: codigo ? hashCodigo(codigo) : null,
      origem,
      metodoConferencia,
      observacao: observacao || null,
      expiraEm: new Date(Date.now() + VALIDADE_CONVITE_HORAS * 60 * 60 * 1000),
      criadoPorId: criadoPorId ?? null,
    }
  })

  if (forma === 'mensagem') {
    await tx.notificacao.create({
      data: {
        conviteId: convite.id_convite,
        evento: 'convite_responsavel',
        tipoDestino: 'responsavel',
        destino: whatsappId ?? whatsappDoCelular(celular),
        mensagem: mensagemConvite(abrigo, origem),
      }
    })
  }

  return { convite, codigo }
}

// Avisa os responsáveis ativos do abrigo (menos os de `exceto`, uma lista de whatsappIds)
export async function avisarResponsaveis(tx, abrigoId, mensagem, { exceto = [] } = {}) {
  const responsaveis = await tx.responsavelAbrigo.findMany({
    where: { abrigoId, ativo: true, whatsappId: { notIn: exceto } },
    select: { whatsappId: true }
  })
  const destinos = [...new Set(responsaveis.map(r => r.whatsappId))]
  if (destinos.length === 0) return 0

  await tx.notificacao.createMany({
    data: destinos.map(destino => ({
      evento: 'aviso_responsavel', tipoDestino: 'responsavel', destino, mensagem,
    }))
  })
  return destinos.length
}

// A pessoa aceitou o convite pelo WhatsApp: cria o vínculo e avisa quem já
// cuidava do abrigo. Devolve { responsavel, abrigo } ou null se o convite já
// tinha sido respondido (duas mensagens ao mesmo tempo).
export async function aceitarConvite(tx, convite, { whatsappId, telefone, nome }) {
  // Só aceita se AINDA estiver pendente (evita vínculo duplicado)
  const { count } = await tx.conviteResponsavel.updateMany({
    where: { id_convite: convite.id_convite, ...whereConviteValido() },
    data: { status: 'aceito', respondidoEm: new Date() }
  })
  if (count === 0) return null

  const abrigo = await tx.abrigo.findUnique({ where: { id_abrigo: convite.abrigoId } })

  // Já era responsável por este abrigo com este WhatsApp: só confirma
  const existente = await tx.responsavelAbrigo.findFirst({
    where: { abrigoId: convite.abrigoId, whatsappId, ativo: true }
  })
  if (existente) return { responsavel: existente, abrigo, jaEra: true }

  const telefoneFinal = normalizarCelular(telefone) ?? convite.telefone
  const responsavel = await tx.responsavelAbrigo.create({
    data: {
      abrigoId: convite.abrigoId,
      nome: (convite.nome || nome || 'Responsável').slice(0, 100),
      whatsappId,
      telefone: telefoneFinal,
      conviteId: convite.id_convite,
    }
  })

  // Avisa quem já cuidava do abrigo e o celular do cadastro (se for outro número):
  // se alguém se vincular indevidamente, quem conhece o abrigo fica sabendo
  const aviso = mensagemNovoResponsavel(abrigo, responsavel)
  await avisarResponsaveis(tx, abrigo.id_abrigo, aviso, { exceto: [whatsappId] })

  const celularCadastro = normalizarCelular(abrigo.telefone)
  const outrosResponsaveis = await tx.responsavelAbrigo.findMany({
    where: { abrigoId: abrigo.id_abrigo, ativo: true }, select: { telefone: true }
  })
  const cadastroJaAvisado = outrosResponsaveis.some(r => mesmoTelefone(r.telefone, celularCadastro))
  if (celularCadastro && !mesmoTelefone(celularCadastro, telefoneFinal) && !cadastroJaAvisado) {
    await tx.notificacao.create({
      data: {
        evento: 'aviso_responsavel', tipoDestino: 'responsavel',
        destino: whatsappDoCelular(celularCadastro), mensagem: aviso,
      }
    })
  }

  return { responsavel, abrigo, jaEra: false }
}


// ─── FORMATO PARA AS TELAS ───────────────────────────────────────

export function formatarConvite(convite) {
  const expirado = convite.status === 'pendente' && convite.expiraEm <= new Date()
  return {
    id_convite:        convite.id_convite,
    nome:              convite.nome,
    telefone:          formatarTelefone(convite.telefone) || null,
    forma:             convite.codigoHash ? 'link' : 'mensagem',
    origem:            convite.origem,
    metodoConferencia: convite.metodoConferencia,
    metodoTexto:       METODOS_CONFERENCIA[convite.metodoConferencia],
    observacao:        convite.observacao,
    status:            expirado ? 'expirado' : convite.status,
    expiraEm:          convite.expiraEm,
    respondidoEm:      convite.respondidoEm,
    criadoPor:         convite.criadoPor?.nome ?? null,
    createdAt:         convite.createdAt,
  }
}

export function formatarResponsavel(responsavel) {
  return {
    id_responsavel:    responsavel.id_responsavel,
    nome:              responsavel.nome,
    telefone:          formatarTelefone(responsavel.telefone) || null,
    ativo:             responsavel.ativo,
    metodoConferencia: responsavel.convite?.metodoConferencia ?? null,
    metodoTexto:       METODOS_CONFERENCIA[responsavel.convite?.metodoConferencia] ?? null,
    observacao:        responsavel.convite?.observacao ?? null,
    conferidoPor:      responsavel.convite?.criadoPor?.nome ?? null,
    createdAt:         responsavel.createdAt,
  }
}
