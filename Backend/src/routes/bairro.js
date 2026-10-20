import prisma from '../lib/prisma.js'
import { consultarCep, normalizarTexto, obterOuCriarBairroPorCep } from '../lib/localizacao.js'
import { LIMITES } from '../lib/validacao.js'

const NOME_LONGO = `O nome do bairro deve ter no máximo ${LIMITES.nomeLocal} caracteres.`


const NIVEIS_RISCO = ['baixo', 'medio', 'alto', 'critico']

const includeBairro = {
  cidade: { include: { estado: true } },
  _count: {
    select: {
      abrigos: true,
      moradores: true,
      inscritosInteressados: true,
      alertas: { where: { status: { in: ['em_verificacao', 'ativo'] } } },
    }
  }
}

// Formata o bairro: cidade/estado em texto + contadores
function formatarBairro({ cidade, _count, ...bairro }) {
  return {
    ...bairro,
    cidade:          cidade?.nome ?? null,
    estadoId:        cidade?.estadoId ?? null,
    estado:          cidade?.estado?.sigla ?? null,
    totalAbrigos:    _count?.abrigos ?? 0,
    totalMoradores:  _count?.moradores ?? 0,
    totalInteressados: _count?.inscritosInteressados ?? 0,
    alertasAbertos:  _count?.alertas ?? 0,
  }
}

// Valida os campos numéricos e o nível de risco. Retorna mensagem de erro ou null.
function validarCampos({ populacaoEstimada, areaKm2, nivelRisco }) {
  if (populacaoEstimada != null && (isNaN(populacaoEstimada) || Number(populacaoEstimada) < 0)) {
    return 'População estimada inválida.'
  }
  if (areaKm2 != null && (isNaN(areaKm2) || Number(areaKm2) < 0)) {
    return 'Área inválida.'
  }
  if (nivelRisco != null && !NIVEIS_RISCO.includes(nivelRisco)) {
    return 'Nível de risco inválido. Use baixo, medio, alto ou critico.'
  }
  return null
}

// Converte "" em null e texto em número
const numeroOuNulo = (valor) => (valor === '' || valor == null ? null : Number(valor))

export default async function bairroRoutes(app) {

  //----- Listar -----
  // URL: GET http://localhost:3000/api/bairros/listar
  // Filtros: ?cidadeId=1 | ?nome=centro
  app.get('/listar', async (request, reply) => {
    const { cidadeId, nome } = request.query

    const bairros = await prisma.bairro.findMany({
      where: {
        cidadeId: cidadeId ? Number(cidadeId) : undefined,
        nome:     nome     ? { contains: nome, mode: 'insensitive' } : undefined,
      },
      orderBy: { nome: 'asc' },
      include: includeBairro
    })

    return reply.status(200).send({
      mensagem: 'Lista:',
      bairros: bairros.map(formatarBairro)
    })
  })


  //----- Listar um só -----
  // URL: GET http://localhost:3000/api/bairros/listar/:id
  app.get('/listar/:id', async (request, reply) => {
    const bairro = await prisma.bairro.findUnique({
      where: { id_bairro: Number(request.params.id) },
      include: includeBairro
    })

    if (!bairro) return reply.status(404).send({ mensagem: 'Bairro não encontrado.' })

    return reply.status(200).send(formatarBairro(bairro))
  })


  //----- Consultar CEP -----
  // Consulta o ViaCEP e informa se a cidade e o bairro já estão cadastrados.
  // Não cria nada — só consulta (usado para preencher formulários).
  // URL: GET http://localhost:3000/api/bairros/cep/12070610
  app.get('/cep/:cep', async (request, reply) => {
    let dadosCep
    try {
      dadosCep = await consultarCep(request.params.cep)
    } catch (erro) {
      request.log.error(erro)
      return reply.status(502).send({ mensagem: 'Não foi possível consultar o CEP agora. Tente novamente.' })
    }

    if (!dadosCep) return reply.status(404).send({ mensagem: 'CEP não encontrado.' })

    const estado = await prisma.estado.findUnique({
      where: { sigla: dadosCep.uf },
      include: { cidades: { include: { bairros: true } } }
    })

    const cidade = estado?.cidades.find(c => normalizarTexto(c.nome) === normalizarTexto(dadosCep.cidade)) ?? null
    const bairro = dadosCep.bairro
      ? cidade?.bairros.find(b => normalizarTexto(b.nome) === normalizarTexto(dadosCep.bairro)) ?? null
      : null

    return reply.status(200).send({
      ...dadosCep,
      estadoId: estado?.id_estado ?? null,
      cidadeId: cidade?.id_cidade ?? null,
      bairroId: bairro?.id_bairro ?? null,
    })
  })


  //----- Encontrar ou cadastrar o bairro pelo CEP (ADM) -----
  // Usado no cadastro de abrigo: se o bairro do CEP ainda não existe,
  // cadastra o bairro (e a cidade, se for nova) na hora.
  // URL: POST http://localhost:3000/api/bairros/cep
  // Body: { cep }
  app.post('/cep', { onRequest: [app.authenticateAdmin] }, async (request, reply) => {
    let dadosCep
    try {
      dadosCep = await consultarCep(request.body?.cep)
    } catch (erro) {
      request.log.error(erro)
      return reply.status(502).send({ mensagem: 'Não foi possível consultar o CEP agora. Tente novamente.' })
    }

    if (!dadosCep) return reply.status(404).send({ mensagem: 'CEP não encontrado.' })

    try {
      const { bairro, cidade, criouBairro, criouCidade } = await obterOuCriarBairroPorCep(prisma, dadosCep)

      return reply.status(criouBairro ? 201 : 200).send({
        mensagem: criouBairro ? `Bairro ${bairro.nome} cadastrado a partir do CEP.` : 'Bairro encontrado.',
        bairro: {
          id_bairro: bairro.id_bairro,
          nome:      bairro.nome,
          cidadeId:  cidade.id_cidade,
          cidade:    cidade.nome,
          estadoId:  cidade.estado.id_estado,
          estado:    cidade.estado.sigla,
        },
        criouBairro,
        criouCidade,
      })
    } catch (erro) {
      return reply.status(erro.statusCode ?? 500).send({ mensagem: erro.message })
    }
  })


  //----- Cadastrar (ADM) -----
  // URL: POST http://localhost:3000/api/bairros/cadastrar
  // Body: { nome, cidadeId, populacaoEstimada?, areaKm2?, nivelRisco? }
  app.post('/cadastrar', { onRequest: [app.authenticateAdmin] }, async (request, reply) => {
    const { nome, cidadeId, populacaoEstimada, areaKm2, nivelRisco } = request.body ?? {}

    if (!nome?.trim()) return reply.status(400).send({ mensagem: 'Informe o nome do bairro.' })
    if (nome.trim().length > LIMITES.nomeLocal) return reply.status(400).send({ mensagem: NOME_LONGO })
    if (!cidadeId)     return reply.status(400).send({ mensagem: 'Selecione a cidade.' })

    const dados = {
      populacaoEstimada: numeroOuNulo(populacaoEstimada),
      areaKm2:           numeroOuNulo(areaKm2),
      nivelRisco:        nivelRisco || 'baixo',
    }

    const erroCampos = validarCampos(dados)
    if (erroCampos) return reply.status(400).send({ mensagem: erroCampos })

    const cidade = await prisma.cidade.findUnique({
      where: { id_cidade: Number(cidadeId) },
      include: { bairros: true }
    })
    if (!cidade) return reply.status(404).send({ mensagem: 'Cidade não encontrada.' })

    if (cidade.bairros.some(b => normalizarTexto(b.nome) === normalizarTexto(nome))) {
      return reply.status(400).send({ mensagem: 'Bairro já cadastrado nesta cidade.' })
    }

    const bairro = await prisma.bairro.create({
      data: { nome: nome.trim(), cidadeId: cidade.id_cidade, ...dados },
      include: includeBairro
    })

    return reply.status(201).send({
      mensagem: 'Bairro cadastrado com sucesso!',
      bairro: formatarBairro(bairro)
    })
  })


  //----- Atualizar (ADM) -----
  // URL: PUT http://localhost:3000/api/bairros/atualizar/:id
  app.put('/atualizar/:id', { onRequest: [app.authenticateAdmin] }, async (request, reply) => {
    const id = Number(request.params.id)
    const { nome, populacaoEstimada, areaKm2, nivelRisco } = request.body ?? {}

    const bairro = await prisma.bairro.findUnique({ where: { id_bairro: id } })
    if (!bairro) return reply.status(404).send({ mensagem: 'Bairro não encontrado.' })

    const dados = {
      nome:              nome !== undefined ? nome.trim() : undefined,
      populacaoEstimada: populacaoEstimada !== undefined ? numeroOuNulo(populacaoEstimada) : undefined,
      areaKm2:           areaKm2 !== undefined ? numeroOuNulo(areaKm2) : undefined,
      nivelRisco:        nivelRisco || undefined,
    }

    if (dados.nome === '') return reply.status(400).send({ mensagem: 'Informe o nome do bairro.' })
    if (dados.nome?.length > LIMITES.nomeLocal) return reply.status(400).send({ mensagem: NOME_LONGO })

    const erroCampos = validarCampos(dados)
    if (erroCampos) return reply.status(400).send({ mensagem: erroCampos })

    if (dados.nome) {
      const outros = await prisma.bairro.findMany({
        where: { cidadeId: bairro.cidadeId, NOT: { id_bairro: id } }
      })
      if (outros.some(b => normalizarTexto(b.nome) === normalizarTexto(dados.nome))) {
        return reply.status(400).send({ mensagem: 'Já existe outro bairro com este nome na cidade.' })
      }
    }

    const bairroAtualizado = await prisma.bairro.update({
      where: { id_bairro: id },
      data: dados,
      include: includeBairro
    })

    return reply.status(200).send({
      mensagem: 'Bairro atualizado com sucesso!',
      bairro: formatarBairro(bairroAtualizado)
    })
  })


  //----- Excluir (ADM) -----
  // Bloqueia a exclusão se houver abrigos, moradores inscritos ou alertas no bairro
  // URL: DELETE http://localhost:3000/api/bairros/excluir/:id
  app.delete('/excluir/:id', { onRequest: [app.authenticateAdmin] }, async (request, reply) => {
    const id = Number(request.params.id)

    const bairro = await prisma.bairro.findUnique({
      where: { id_bairro: id },
      include: { _count: { select: { abrigos: true, moradores: true, alertas: true, solicitacoesAbrigo: true } } }
    })

    if (!bairro) return reply.status(404).send({ mensagem: 'Bairro não encontrado.' })

    const { abrigos, moradores, alertas, solicitacoesAbrigo } = bairro._count
    if (abrigos || moradores || alertas || solicitacoesAbrigo) {
      return reply.status(400).send({
        mensagem: `Não é possível excluir: o bairro possui ${abrigos} abrigo(s), ${moradores} morador(es) inscrito(s), ${alertas} alerta(s) e ${solicitacoesAbrigo} solicitação(ões) de abrigo vinculados.`
      })
    }

    // Inscritos que só acompanhavam o bairro perdem o vínculo (cascade)
    await prisma.bairro.delete({ where: { id_bairro: id } })

    return reply.status(200).send({ mensagem: 'Bairro excluído com sucesso!' })
  })
}
