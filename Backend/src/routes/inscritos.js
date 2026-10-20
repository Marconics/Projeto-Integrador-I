// Rotas do painel admin para gerenciar os inscritos no sistema de alertas
// Todas exigem login de administrador (token JWT no cabeçalho Authorization)

import prisma from '../lib/prisma.js'
import { includeInscrito, formatarInscrito, emailValido } from '../lib/inscritos.js'
import { TIPOS_ALERTA, GRAVIDADES } from '../lib/alertas.js'
import { LIMITES, validarTamanhos } from '../lib/validacao.js'


export default async function inscritoRoutes(app) {

  app.addHook('onRequest', app.authenticateAdmin)


  //----- Listar -----
  // URL: GET http://localhost:3000/api/inscritos/listar
  // Filtros: ?busca=maria (nome, e-mail ou telefone) | ?cidadeId=1 | ?bairroId=2 | ?ativo=true
  // O filtro de bairro/cidade considera quem MORA ou ACOMPANHA o bairro
  app.get('/listar', async (request, reply) => {
    const { busca, cidadeId, bairroId, ativo } = request.query

    const filtros = []

    if (busca?.trim()) {
      filtros.push({
        OR: [
          { nome:     { contains: busca.trim(), mode: 'insensitive' } },
          { email:    { contains: busca.trim(), mode: 'insensitive' } },
          { telefone: { contains: busca.replace(/\D/g, '') || busca.trim() } },
        ]
      })
    }

    if (bairroId) {
      filtros.push({
        OR: [
          { bairroId: Number(bairroId) },
          { bairrosInteresse: { some: { bairroId: Number(bairroId) } } },
        ]
      })
    } else if (cidadeId) {
      filtros.push({
        OR: [
          { bairro: { cidadeId: Number(cidadeId) } },
          { bairrosInteresse: { some: { bairro: { cidadeId: Number(cidadeId) } } } },
        ]
      })
    }

    if (ativo === 'true' || ativo === 'false') {
      filtros.push({ ativo: ativo === 'true' })
    }

    const inscritos = await prisma.inscritoAlerta.findMany({
      where: { AND: filtros },
      orderBy: { createdAt: 'desc' },
      include: includeInscrito
    })

    return reply.status(200).send({
      mensagem: 'Lista de inscritos:',
      total: inscritos.length,
      inscritos: inscritos.map(formatarInscrito)
    })
  })


  //----- Detalhes -----
  // Inclui os últimos relatos enviados pela pessoa
  // URL: GET http://localhost:3000/api/inscritos/listar/:id
  app.get('/listar/:id', async (request, reply) => {
    const id = Number(request.params.id)

    const inscrito = await prisma.inscritoAlerta.findUnique({
      where: { id_inscrito: id },
      include: includeInscrito
    })

    if (!inscrito) return reply.status(404).send({ mensagem: 'Inscrito não encontrado.' })

    const relatos = await prisma.relatoAlerta.findMany({
      where: { inscritoId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        alerta: {
          select: {
            id_alerta: true, tipo: true, status: true,
            bairro: { select: { nome: true, cidade: { select: { nome: true } } } }
          }
        }
      }
    })

    return reply.status(200).send({
      ...formatarInscrito(inscrito),
      relatos: relatos.map(r => ({
        id_relato:      r.id_relato,
        createdAt:      r.createdAt,
        gravidade:      r.gravidade,
        gravidadeLabel: GRAVIDADES[r.gravidade]?.label ?? r.gravidade,
        fotoRelato:     r.fotoRelato,
        alertaId:       r.alerta.id_alerta,
        tipo:           r.alerta.tipo,
        tipoLabel:      TIPOS_ALERTA[r.alerta.tipo]?.label ?? r.alerta.tipo,
        statusAlerta:   r.alerta.status,
        local:          `${r.alerta.bairro.nome} — ${r.alerta.bairro.cidade.nome}`,
      }))
    })
  })


  //----- Atualizar -----
  // URL: PUT http://localhost:3000/api/inscritos/atualizar/:id
  // Body: { nome?, email?, ativo?, bairroId?, bairrosInteresse?: [ids] }
  // O telefone NÃO é editável: ele vem do WhatsApp da pessoa e é usado para
  // identificá-la — trocar por engano mandaria os alertas para outra pessoa.
  // bairrosInteresse, quando enviado, SUBSTITUI a lista inteira
  app.put('/atualizar/:id', async (request, reply) => {
    const id = Number(request.params.id)
    const { nome, email, ativo, bairroId, bairrosInteresse } = request.body ?? {}

    const inscrito = await prisma.inscritoAlerta.findUnique({ where: { id_inscrito: id } })
    if (!inscrito) return reply.status(404).send({ mensagem: 'Inscrito não encontrado.' })

    if (nome !== undefined && nome.trim().length < 2) {
      return reply.status(400).send({ mensagem: 'Informe o nome.' })
    }
    if (email !== undefined && !emailValido(email)) {
      return reply.status(400).send({ mensagem: 'E-mail inválido.' })
    }
    const erroTamanho = validarTamanhos([['Nome', nome?.trim(), LIMITES.nomePessoa], ['E-mail', email?.trim(), LIMITES.email]])
    if (erroTamanho) {
      return reply.status(400).send({ mensagem: erroTamanho })
    }

    const novoBairroId = bairroId !== undefined ? Number(bairroId) : inscrito.bairroId
    if (bairroId !== undefined) {
      const bairro = await prisma.bairro.findUnique({ where: { id_bairro: novoBairroId } })
      if (!bairro) return reply.status(404).send({ mensagem: 'Bairro de residência não encontrado.' })
    }

    let idsInteresse
    if (bairrosInteresse !== undefined) {
      if (!Array.isArray(bairrosInteresse)) {
        return reply.status(400).send({ mensagem: 'bairrosInteresse deve ser uma lista de IDs.' })
      }
      // Remove repetidos e o próprio bairro de residência
      idsInteresse = [...new Set(bairrosInteresse.map(Number))].filter(b => b && b !== novoBairroId)

      const encontrados = await prisma.bairro.count({ where: { id_bairro: { in: idsInteresse } } })
      if (encontrados !== idsInteresse.length) {
        return reply.status(400).send({ mensagem: 'Algum dos bairros acompanhados não existe.' })
      }
    }

    const atualizado = await prisma.$transaction(async (tx) => {
      await tx.inscritoAlerta.update({
        where: { id_inscrito: id },
        data: {
          nome:     nome     !== undefined ? nome.trim()                 : undefined,
          email:    email    !== undefined ? email.trim().toLowerCase()  : undefined,
          ativo:    ativo    !== undefined ? Boolean(ativo)              : undefined,
          bairroId: novoBairroId,
        }
      })

      if (idsInteresse) {
        await tx.inscritoBairro.deleteMany({ where: { inscritoId: id } })
        await tx.inscritoBairro.createMany({
          data: idsInteresse.map(bairroId => ({ inscritoId: id, bairroId }))
        })
      } else if (bairroId !== undefined) {
        // Se mudou de residência, o novo bairro não precisa estar também na lista de acompanhados
        await tx.inscritoBairro.deleteMany({ where: { inscritoId: id, bairroId: novoBairroId } })
      }

      return tx.inscritoAlerta.findUnique({ where: { id_inscrito: id }, include: includeInscrito })
    })

    return reply.status(200).send({
      mensagem: 'Inscrito atualizado com sucesso!',
      inscrito: formatarInscrito(atualizado)
    })
  })


  //----- Excluir -----
  // Remove o inscrito. Os relatos dele continuam contando nos alertas,
  // mas ficam sem autor.
  // URL: DELETE http://localhost:3000/api/inscritos/excluir/:id
  app.delete('/excluir/:id', async (request, reply) => {
    const id = Number(request.params.id)

    const inscrito = await prisma.inscritoAlerta.findUnique({ where: { id_inscrito: id } })
    if (!inscrito) return reply.status(404).send({ mensagem: 'Inscrito não encontrado.' })

    await prisma.$transaction([
      // Não envia mais nada para quem foi excluído
      prisma.notificacao.updateMany({
        where: { inscritoId: id, status: { in: ['pendente', 'falha'] } },
        data: { status: 'cancelada' }
      }),
      prisma.inscritoAlerta.delete({ where: { id_inscrito: id } }),
    ])

    return reply.status(200).send({ mensagem: 'Inscrito excluído com sucesso!' })
  })
}
