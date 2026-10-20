// Voluntários do abrigo pelo WhatsApp (sem conta no painel)
//
// Quem indica um local pelo bot e diz que NÃO é o responsável pode se oferecer
// como voluntário. Quando a solicitação é aprovada, a pessoa entra na lista de
// voluntários do abrigo e passa a receber pelo WhatsApp cada novo pedido de
// ajuda (SolicitacaoAjuda) que o admin cria para ele.
// Para sair: "sair voluntario" no bot, ou o admin remove em Detalhes do abrigo.
// As mensagens vão pela mesma fila dos alertas (tipoDestino: voluntario).
import { SEPARADOR, formatarTelefone, normalizarCelular } from './responsaveis.js'

const CATEGORIAS = {
  doacao:         '📦 Doação',
  medicamento:    '💊 Medicamento',
  voluntariado:   '🙋 Voluntariado (mão de obra)',
  infraestrutura: '🛠️ Infraestrutura',
  outro:          '📝 Outro',
}
const URGENCIAS = {
  baixa:   '🟢 Baixa',
  media:   '🟡 Média',
  alta:    '🟠 Alta',
  critica: '🔴 Crítica',
}

const RODAPE_SAIR = `_Para não receber mais os pedidos de ajuda, envie *sair voluntario*._`


// ─── TEXTOS ──────────────────────────────────────────────────────

function mensagemBoasVindas(abrigo) {
  return [
    `🙋 *VOLUNTÁRIO DO ABRIGO*`,
    SEPARADOR,
    ``,
    `O local *${abrigo.nome}* que você indicou foi *aprovado* como abrigo. 🎉`,
    ``,
    `Como você se ofereceu para ajudar, vai receber aqui os *pedidos de ajuda* do abrigo (doações, medicamentos, mão de obra).`,
    ``,
    RODAPE_SAIR,
  ].join('\n')
}

export function mensagemPedidoAjuda(abrigo, solicitacao) {
  const contato = [
    abrigo.responsavel ? `👤 ${abrigo.responsavel}` : null,
    abrigo.telefone ? `📞 ${abrigo.telefone}` : null,
  ].filter(Boolean)

  return [
    `🆘 *PEDIDO DE AJUDA*`,
    SEPARADOR,
    ``,
    `🏠 *${abrigo.nome}*`,
    abrigo.endereco ? `📍 ${abrigo.endereco}` : null,
    ``,
    `📋 *${solicitacao.titulo}*`,
    solicitacao.descricao,
    ``,
    `${CATEGORIAS[solicitacao.categoria] ?? solicitacao.categoria} · Urgência: ${URGENCIAS[solicitacao.urgencia] ?? solicitacao.urgencia}`,
    ...(contato.length ? [``, `Pode ajudar? Fale com o abrigo:`, ...contato] : []),
    ``,
    RODAPE_SAIR,
  ].filter(linha => linha !== null).join('\n')
}

export function mensagemSaiu(abrigos) {
  return [
    `👍 *Pronto!*`,
    ``,
    `Você não recebe mais os pedidos de ajuda de: ${abrigos.map(a => `*${a.nome}*`).join(', ')}.`,
  ].join('\n')
}

export function mensagemRemovido(abrigo) {
  return [
    `🙋 *VOLUNTÁRIO DO ABRIGO*`,
    SEPARADOR,
    ``,
    `Você não recebe mais os pedidos de ajuda do abrigo *${abrigo.nome}* pelo S.O.S Vale.`,
    ``,
    `Se foi engano, fale com a equipe do S.O.S Vale.`,
  ].join('\n')
}


// ─── REGRAS ──────────────────────────────────────────────────────

// Coloca a pessoa na lista de voluntários do abrigo (ou reativa, se já esteve)
// e manda as boas-vindas. Usado quando a solicitação de abrigo é aprovada.
export async function adicionarVoluntario(tx, { abrigo, nome, whatsappId, telefone, solicitacaoId }) {
  const dados = {
    nome: (nome || 'Voluntário').slice(0, 100),
    telefone: normalizarCelular(telefone),
    ativo: true,
    desativadoEm: null,
    solicitacaoId: solicitacaoId ?? null,
  }

  const voluntario = await tx.voluntarioWhatsapp.upsert({
    where: { abrigoId_whatsappId: { abrigoId: abrigo.id_abrigo, whatsappId } },
    create: { abrigoId: abrigo.id_abrigo, whatsappId, ...dados },
    update: dados,
  })

  await tx.notificacao.create({
    data: {
      evento: 'aviso_voluntario', tipoDestino: 'voluntario',
      destino: whatsappId, mensagem: mensagemBoasVindas(abrigo),
    }
  })

  return voluntario
}

// Novo pedido de ajuda → mensagem para cada voluntário ativo do abrigo
export async function avisarVoluntarios(tx, abrigo, solicitacao) {
  const voluntarios = await tx.voluntarioWhatsapp.findMany({
    where: { abrigoId: abrigo.id_abrigo, ativo: true },
    select: { whatsappId: true }
  })
  if (voluntarios.length === 0) return 0

  const mensagem = mensagemPedidoAjuda(abrigo, solicitacao)
  await tx.notificacao.createMany({
    data: voluntarios.map(v => ({
      evento: 'pedido_ajuda', tipoDestino: 'voluntario', destino: v.whatsappId, mensagem,
    }))
  })
  return voluntarios.length
}

export function formatarVoluntarioWhatsapp(voluntario) {
  return {
    id_voluntario_whatsapp: voluntario.id_voluntario_whatsapp,
    nome:                   voluntario.nome,
    telefone:               formatarTelefone(voluntario.telefone) || null,
    origem:                 voluntario.solicitacaoId ? 'Indicou este abrigo pelo bot' : 'WhatsApp',
    createdAt:              voluntario.createdAt,
  }
}
