import prisma from '../lib/prisma.js'
import { normalizarTexto } from '../lib/localizacao.js'
import { LIMITES } from '../lib/validacao.js'

const NOME_LONGO = `O nome da cidade deve ter no máximo ${LIMITES.nomeLocal} caracteres.`


// Formata a cidade para as respostas: estado em texto + contadores
function formatarCidade({ estado, _count, ...cidade }) {
  return {
    ...cidade,
    estado:      estado?.sigla ?? null,
    estadoNome:  estado?.nome ?? null,
    totalBairros: _count?.bairros ?? 0,
    totalAbrigos: _count?.abrigos ?? 0,
  }
}

const includeCidade = {
  estado: true,
  _count: { select: { bairros: true, abrigos: true } }
}

// Grupo de WhatsApp: formato "123456789@g.us" (ou vazio para remover)
function validarGrupo(grupoWhatsappId) {
  if (!grupoWhatsappId) return null
  if (!/^[\d-]+@g\.us$/.test(grupoWhatsappId.trim())) {
    return 'ID do grupo inválido. Ele termina com "@g.us" — envie "!alertas id" no grupo para descobrir.'
  }
  return null
}

// Link de convite do grupo: "https://chat.whatsapp.com/<código>" (ou vazio para remover).
// Devolve { link } já limpo ou { erro }.
export function validarLinkGrupo(link) {
  if (link === undefined) return { link: undefined }
  const texto = String(link ?? '').trim()
  if (!texto) return { link: null }
  const achado = texto.match(/^(?:https?:\/\/)?chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]{10,})/)
  if (!achado) {
    return { erro: 'Link do grupo inválido. Use o link de convite do WhatsApp, ex: https://chat.whatsapp.com/AbCdEf123456' }
  }
  return { link: `https://chat.whatsapp.com/${achado[1]}` }
}

export default async function cidadeRoutes(app) {

  //----- Listar -----
  // URL: GET http://localhost:3000/api/cidades/listar
  // Filtros: ?estadoId=25 | ?nome=taub
  app.get('/listar', async (request, reply) => {
    const { estadoId, nome } = request.query

    const cidades = await prisma.cidade.findMany({
      where: {
        estadoId: estadoId ? Number(estadoId) : undefined,
        nome:     nome     ? { contains: nome, mode: 'insensitive' } : undefined,
      },
      orderBy: { nome: 'asc' },
      include: includeCidade
    })

    return reply.status(200).send({
      mensagem: 'Lista:',
      cidades: cidades.map(formatarCidade)
    })
  })


  //----- Listar uma só -----
  // URL: GET http://localhost:3000/api/cidades/listar/:id
  app.get('/listar/:id', async (request, reply) => {
    const cidade = await prisma.cidade.findUnique({
      where: { id_cidade: Number(request.params.id) },
      include: includeCidade
    })

    if (!cidade) {
      return reply.status(404).send({ mensagem: 'Cidade não encontrada.' })
    }

    return reply.status(200).send(formatarCidade(cidade))
  })


  //----- Cadastrar (ADM) -----
  // URL: POST http://localhost:3000/api/cidades/cadastrar
  // Body: { nome, estadoId, grupoWhatsappId?, grupoWhatsappLink? }
  app.post('/cadastrar', { onRequest: [app.authenticateAdmin] }, async (request, reply) => {
    const { nome, estadoId, grupoWhatsappId, grupoWhatsappLink } = request.body ?? {}

    if (!nome?.trim()) return reply.status(400).send({ mensagem: 'Informe o nome da cidade.' })
    if (nome.trim().length > LIMITES.nomeLocal) return reply.status(400).send({ mensagem: NOME_LONGO })
    if (!estadoId)     return reply.status(400).send({ mensagem: 'Selecione o estado.' })

    const erroGrupo = validarGrupo(grupoWhatsappId)
    if (erroGrupo) return reply.status(400).send({ mensagem: erroGrupo })

    const linkGrupo = validarLinkGrupo(grupoWhatsappLink)
    if (linkGrupo.erro) return reply.status(400).send({ mensagem: linkGrupo.erro })

    const estado = await prisma.estado.findUnique({ where: { id_estado: Number(estadoId) } })
    if (!estado) return reply.status(404).send({ mensagem: 'Estado não encontrado.' })

    // Compara sem acento/maiúscula para não criar "Taubate" e "Taubaté"
    const existentes = await prisma.cidade.findMany({ where: { estadoId: estado.id_estado } })
    if (existentes.some(c => normalizarTexto(c.nome) === normalizarTexto(nome))) {
      return reply.status(400).send({ mensagem: 'Cidade já cadastrada neste estado.' })
    }

    const cidade = await prisma.cidade.create({
      data: {
        nome: nome.trim(),
        estadoId: estado.id_estado,
        grupoWhatsappId: grupoWhatsappId?.trim() || null,
        grupoWhatsappLink: linkGrupo.link ?? null,
      },
      include: includeCidade
    })

    return reply.status(201).send({
      mensagem: 'Cidade cadastrada com sucesso!',
      cidade: formatarCidade(cidade)
    })
  })


  //----- Atualizar (ADM) -----
  // URL: PUT http://localhost:3000/api/cidades/atualizar/:id
  // Body: { nome?, grupoWhatsappId?, grupoWhatsappLink? }  (null ou "" remove o grupo / o link)
  app.put('/atualizar/:id', { onRequest: [app.authenticateAdmin] }, async (request, reply) => {
    const id = Number(request.params.id)
    const { nome, grupoWhatsappId, grupoWhatsappLink } = request.body ?? {}

    const cidade = await prisma.cidade.findUnique({ where: { id_cidade: id } })
    if (!cidade) return reply.status(404).send({ mensagem: 'Cidade não encontrada.' })

    if (nome !== undefined) {
      if (!nome.trim()) return reply.status(400).send({ mensagem: 'Informe o nome da cidade.' })
      if (nome.trim().length > LIMITES.nomeLocal) return reply.status(400).send({ mensagem: NOME_LONGO })

      const existentes = await prisma.cidade.findMany({
        where: { estadoId: cidade.estadoId, NOT: { id_cidade: id } }
      })
      if (existentes.some(c => normalizarTexto(c.nome) === normalizarTexto(nome))) {
        return reply.status(400).send({ mensagem: 'Já existe outra cidade com este nome no estado.' })
      }
    }

    const erroGrupo = validarGrupo(grupoWhatsappId)
    if (erroGrupo) return reply.status(400).send({ mensagem: erroGrupo })

    const linkGrupo = validarLinkGrupo(grupoWhatsappLink)
    if (linkGrupo.erro) return reply.status(400).send({ mensagem: linkGrupo.erro })

    const cidadeAtualizada = await prisma.cidade.update({
      where: { id_cidade: id },
      data: {
        nome: nome !== undefined ? nome.trim() : undefined,
        // undefined = não veio no body (mantém) | null/"" = remove o grupo
        grupoWhatsappId: grupoWhatsappId !== undefined ? (grupoWhatsappId?.trim() || null) : undefined,
        grupoWhatsappLink: linkGrupo.link,
      },
      include: includeCidade
    })

    return reply.status(200).send({
      mensagem: 'Cidade atualizada com sucesso!',
      cidade: formatarCidade(cidadeAtualizada)
    })
  })


  //----- Excluir (ADM) -----
  // Só permite excluir cidades sem bairros e sem abrigos
  // URL: DELETE http://localhost:3000/api/cidades/excluir/:id
  app.delete('/excluir/:id', { onRequest: [app.authenticateAdmin] }, async (request, reply) => {
    const id = Number(request.params.id)

    const cidade = await prisma.cidade.findUnique({
      where: { id_cidade: id },
      include: { _count: { select: { bairros: true, abrigos: true, solicitacoesAbrigo: true } } }
    })

    if (!cidade) return reply.status(404).send({ mensagem: 'Cidade não encontrada.' })

    const { bairros, abrigos, solicitacoesAbrigo } = cidade._count
    if (bairros || abrigos || solicitacoesAbrigo) {
      return reply.status(400).send({
        mensagem: `Não é possível excluir: a cidade possui ${bairros} bairro(s), ${abrigos} abrigo(s) e ${solicitacoesAbrigo} solicitação(ões) de abrigo vinculados.`
      })
    }

    await prisma.cidade.delete({ where: { id_cidade: id } })

    return reply.status(200).send({ mensagem: 'Cidade excluída com sucesso!' })
  })
}
