// Responsáveis do abrigo no WhatsApp — rotas do painel (somente administradores)
// (também lista/remove os voluntários do abrigo no WhatsApp: lib/voluntariosWhatsapp.js)
//
// O admin confere quem é o responsável e cria um convite dizendo COMO conferiu.
// O vínculo só existe depois que a própria pessoa aceita pelo WhatsApp
// (rotas do bot em routes/bot.js). Regras e textos: lib/responsaveis.js.
import prisma from '../lib/prisma.js'
import { LIMITES, validarTamanhos } from '../lib/validacao.js'
import {
  METODOS_DO_ADMIN, METODOS_COM_OBSERVACAO, normalizarCelular, mesmoTelefone, criarConvite,
  linkDoCodigo, formatarConvite, formatarResponsavel, mensagemDesvinculado, whereConviteValido
} from '../lib/responsaveis.js'
import { formatarVoluntarioWhatsapp, mensagemRemovido } from '../lib/voluntariosWhatsapp.js'


export default async function responsavelRoutes(app) {

  app.addHook('onRequest', app.authenticateAdmin)


  // ----- Listar responsáveis e convites de um abrigo -----
  // URL: GET /api/responsaveis/listar?abrigoId=1
  app.get('/listar', async (request, reply) => {
    const abrigoId = Number(request.query.abrigoId)
    if (!abrigoId) return reply.status(400).send({ mensagem: 'Informe o abrigoId.' })

    const [responsaveis, convites, voluntarios] = await Promise.all([
      prisma.responsavelAbrigo.findMany({
        where: { abrigoId, ativo: true },
        orderBy: { createdAt: 'asc' },
        include: { convite: { include: { criadoPor: { select: { nome: true } } } } }
      }),
      // Convites ainda sem resposta + os últimos respondidos (histórico curto)
      prisma.conviteResponsavel.findMany({
        where: { abrigoId, status: { not: 'aceito' } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { criadoPor: { select: { nome: true } } }
      }),
      // Voluntários que recebem os pedidos de ajuda do abrigo pelo WhatsApp
      prisma.voluntarioWhatsapp.findMany({
        where: { abrigoId, ativo: true },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    return reply.status(200).send({
      responsaveis: responsaveis.map(formatarResponsavel),
      convites: convites.map(formatarConvite),
      voluntarios: voluntarios.map(formatarVoluntarioWhatsapp),
    })
  })


  // ----- Tirar um voluntário da lista do abrigo no WhatsApp -----
  // URL: PATCH /api/responsaveis/voluntarios/desativar/:id
  // A pessoa recebe uma mensagem dizendo que não recebe mais os pedidos de ajuda
  app.patch('/voluntarios/desativar/:id', async (request, reply) => {
    const id = Number(request.params.id)

    const voluntario = await prisma.voluntarioWhatsapp.findUnique({
      where: { id_voluntario_whatsapp: id }, include: { abrigo: true }
    })
    if (!voluntario || !voluntario.ativo) {
      return reply.status(404).send({ mensagem: 'Voluntário não encontrado.' })
    }

    await prisma.$transaction([
      prisma.voluntarioWhatsapp.update({
        where: { id_voluntario_whatsapp: id },
        data: { ativo: false, desativadoEm: new Date() }
      }),
      prisma.notificacao.create({
        data: {
          evento: 'aviso_voluntario', tipoDestino: 'voluntario',
          destino: voluntario.whatsappId, mensagem: mensagemRemovido(voluntario.abrigo),
        }
      }),
    ])

    return reply.status(200).send({ mensagem: `${voluntario.nome} não recebe mais os pedidos de ajuda do abrigo.` })
  })


  // ----- Convidar um responsável -----
  // URL: POST /api/responsaveis/convidar
  // Body: { abrigoId, nome, telefone?, forma: 'mensagem' | 'link', metodoConferencia, observacao? }
  //  - mensagem: o bot pergunta ao celular informado (a pessoa responde ACEITAR)
  //  - link: devolve um código/link para o admin repassar (a pessoa envia "vincular 123456")
  app.post('/convidar', async (request, reply) => {
    const { abrigoId, nome, telefone, forma, metodoConferencia, observacao } = request.body ?? {}

    if (!['mensagem', 'link'].includes(forma)) {
      return reply.status(400).send({ mensagem: 'Escolha como enviar o convite: mensagem ou link.' })
    }
    if (!METODOS_DO_ADMIN.includes(metodoConferencia)) {
      return reply.status(400).send({ mensagem: 'Informe como você conferiu que a pessoa é responsável pelo abrigo.' })
    }
    if (!nome?.trim()) {
      return reply.status(400).send({ mensagem: 'Informe o nome do responsável.' })
    }
    if (METODOS_COM_OBSERVACAO.includes(metodoConferencia) && !observacao?.trim()) {
      return reply.status(400).send({ mensagem: 'Anote com quem você confirmou (nome, cargo ou telefone do contato oficial).' })
    }
    const erroTamanho = validarTamanhos([
      ['Nome', nome, LIMITES.nomePessoa], ['Observação', observacao, LIMITES.observacao],
    ])
    if (erroTamanho) return reply.status(400).send({ mensagem: erroTamanho })

    const celular = telefone ? normalizarCelular(telefone) : null
    if (telefone && !celular) {
      return reply.status(400).send({ mensagem: 'Informe um celular com DDD, ex: (12) 99999-0000. Telefone fixo não tem WhatsApp.' })
    }
    if (forma === 'mensagem' && !celular) {
      return reply.status(400).send({ mensagem: 'Para enviar o convite por mensagem, informe o celular do responsável.' })
    }

    const abrigo = await prisma.abrigo.findUnique({ where: { id_abrigo: Number(abrigoId) } })
    if (!abrigo) return reply.status(404).send({ mensagem: 'Abrigo não encontrado.' })

    // "Número do cadastro" só vale se for mesmo o celular que já estava no abrigo
    if (metodoConferencia === 'numero_do_cadastro' && (forma !== 'mensagem' || !mesmoTelefone(celular, abrigo.telefone))) {
      return reply.status(400).send({
        mensagem: 'Esse método só vale para enviar a mensagem ao celular que já está no cadastro do abrigo. Para outro número, confira por outro meio.'
      })
    }

    if (celular) {
      const ativos = await prisma.responsavelAbrigo.findMany({ where: { abrigoId: abrigo.id_abrigo, ativo: true } })
      if (ativos.some(r => mesmoTelefone(r.telefone, celular))) {
        return reply.status(409).send({ mensagem: 'Esse celular já é responsável por este abrigo.' })
      }
    }

    const { convite, codigo } = await prisma.$transaction(tx => criarConvite(tx, {
      abrigo, nome: nome.trim(), celular, forma, origem: 'admin', metodoConferencia,
      observacao: observacao?.trim(), criadoPorId: request.user.id,
    }))

    return reply.status(201).send({
      mensagem: forma === 'mensagem'
        ? 'Convite na fila: o bot vai perguntar à pessoa se ela é responsável pelo abrigo.'
        : 'Convite criado. Envie o link (ou o código) para a pessoa.',
      convite: formatarConvite(convite),
      // O código só aparece agora: no banco fica apenas o hash
      codigo,
      link: codigo ? linkDoCodigo(codigo) : null,
    })
  })


  // ----- Cancelar um convite ainda sem resposta -----
  // URL: PATCH /api/responsaveis/convites/cancelar/:id
  app.patch('/convites/cancelar/:id', async (request, reply) => {
    const id = Number(request.params.id)

    const { count } = await prisma.conviteResponsavel.updateMany({
      where: { id_convite: id, ...whereConviteValido() },
      data: { status: 'cancelado', respondidoEm: new Date() }
    })
    if (count === 0) {
      return reply.status(409).send({ mensagem: 'Este convite não está mais pendente.' })
    }

    // Se a mensagem do convite ainda não saiu, ela não sai mais
    await prisma.notificacao.updateMany({
      where: { conviteId: id, status: 'pendente' },
      data: { status: 'cancelada' }
    })

    return reply.status(200).send({ mensagem: 'Convite cancelado.' })
  })


  // ----- Desvincular um responsável -----
  // URL: PATCH /api/responsaveis/desativar/:id
  // A pessoa recebe uma mensagem dizendo que não recebe mais os avisos
  app.patch('/desativar/:id', async (request, reply) => {
    const id = Number(request.params.id)

    const responsavel = await prisma.responsavelAbrigo.findUnique({
      where: { id_responsavel: id }, include: { abrigo: true }
    })
    if (!responsavel || !responsavel.ativo) {
      return reply.status(404).send({ mensagem: 'Responsável não encontrado.' })
    }

    await prisma.$transaction([
      prisma.responsavelAbrigo.update({
        where: { id_responsavel: id },
        data: { ativo: false, desativadoEm: new Date() }
      }),
      prisma.notificacao.create({
        data: {
          evento: 'aviso_responsavel', tipoDestino: 'responsavel',
          destino: responsavel.whatsappId, mensagem: mensagemDesvinculado(responsavel.abrigo),
        }
      }),
    ])

    return reply.status(200).send({ mensagem: `${responsavel.nome} não recebe mais os avisos do abrigo.` })
  })
}
