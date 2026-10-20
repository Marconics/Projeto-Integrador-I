import prisma from '../lib/prisma.js'
import supabase from '../supabase.js'
import { selectLocalizacao, achatarLocalizacao, validarCidadeBairro } from '../lib/localizacao.js'
import { LIMITE_CORPO_COM_FOTO, LIMITES } from '../lib/validacao.js'


export default async function solicitacaoAbrigoRoutes(app) {

  // ----- Criar Solicitação -----
  // URL: POST http://localhost:3000/api/solicitacoes/criar
  // Pública de propósito: é por aqui que o ChatBot envia os pedidos de abrigo
  app.post('/criar', { bodyLimit: LIMITE_CORPO_COM_FOTO }, async (request, reply) => {
    const {
      nome, cep, endereco, cidadeId, bairroId, telefone, responsavel,
      tipoAbrigo, capacidadeTotal, possuiAtendimentoMedico, possuiEnfermagem,
      possuiPets, possuiAcessibilidade, possuiCozinha, fotoAbrigo,
      solicitanteNome, solicitanteEmail, solicitanteTelefone
    } = request.body

    // A cidade é obrigatória; o bairro, se vier, precisa ser da mesma cidade
    const erroLocalizacao = await validarCidadeBairro(prisma, cidadeId, bairroId)
    if (erroLocalizacao) {
      return reply.status(400).send({ mensagem: erroLocalizacao })
    }

    // Cria a solicitação primeiro sem foto para obter o ID
    const solicitacao = await prisma.solicitacaoAbrigo.create({
      data: {
        nome, cep, endereco,
        cidadeId: Number(cidadeId),
        bairroId: bairroId ? Number(bairroId) : null,
        telefone: telefone ?? null,
        responsavel, tipoAbrigo, capacidadeTotal,
        possuiAtendimentoMedico: possuiAtendimentoMedico ?? false,
        possuiEnfermagem:        possuiEnfermagem        ?? false,
        possuiPets:              possuiPets              ?? false,
        possuiAcessibilidade:    possuiAcessibilidade    ?? false,
        possuiCozinha:           possuiCozinha           ?? false,
        fotoAbrigo: null,
        solicitanteNome, solicitanteEmail,
        solicitanteTelefone: solicitanteTelefone ?? null,
        status: 'pendente',
      }
    })

    // Upload da foto se vier em base64
    if (fotoAbrigo) {
      const buffer = Buffer.from(fotoAbrigo, 'base64')
      const nomeArquivo = `solicitacao-${solicitacao.id_solicitacao}-${Date.now()}.jpg`

      const { data, error } = await supabase.storage
        .from('fotos-abrigo')
        .upload(nomeArquivo, buffer, { contentType: 'image/jpeg', upsert: false })

      if (error) {
        return reply.status(500).send({ mensagem: 'Solicitação criada, mas erro ao salvar a foto.' })
      }

      const { data: urlData } = supabase.storage
        .from('fotos-abrigo')
        .getPublicUrl(data.path)

      await prisma.solicitacaoAbrigo.update({
        where: { id_solicitacao: solicitacao.id_solicitacao },
        data: { fotoAbrigo: urlData.publicUrl }
      })

      solicitacao.fotoAbrigo = urlData.publicUrl
    }

    return reply.status(201).send({
      mensagem: 'Solicitação enviada com sucesso! Aguarde a análise.',
      solicitacao
    })
  })


  // ----- Listar todas -----
  // URL: GET http://localhost:3000/api/solicitacoes/listar
  // Filtros: ?status=pendente | ?status=aprovado | ?status=recusado | ?solicitanteEmail=
  //          ?cidadeId=1 | ?cidade=taubaté | ?estado=SP
  // Somente administradores (traz nome, e-mail e telefone de quem pediu)
  app.get('/listar', { onRequest: [app.authenticateAdmin] }, async (request, reply) => {
    const { status, solicitanteEmail, cidade, estado, cidadeId } = request.query

    const solicitacoes = await prisma.solicitacaoAbrigo.findMany({
      where: {
        status:          status          ? { equals: status }                               : undefined,
        solicitanteEmail: solicitanteEmail ? { contains: solicitanteEmail, mode: 'insensitive' } : undefined,
        cidadeId:        cidadeId        ? Number(cidadeId)                                 : undefined,
        cidade: (cidade || estado) ? {
          nome:   cidade ? { contains: cidade, mode: 'insensitive' } : undefined,
          estado: estado ? { sigla: { equals: estado, mode: 'insensitive' } } : undefined,
        } : undefined,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        ...selectLocalizacao,
        analisadoPor: {
          select: { id: true, nome: true, email: true }
        }
      }
    })

    return reply.status(200).send({
      mensagem: 'Lista de solicitações:',
      total: solicitacoes.length,
      // cidade, estado e bairro voltam como texto (+ cidadeId e bairroId)
      solicitacoes: solicitacoes.map(achatarLocalizacao)
    })
  })


  // ----- Listar uma só -----
  // URL: GET http://localhost:3000/api/solicitacoes/listar/:id
  // Somente administradores
  app.get('/listar/:id', { onRequest: [app.authenticateAdmin] }, async (request, reply) => {
    const { id } = request.params

    const solicitacao = await prisma.solicitacaoAbrigo.findUnique({
      where: { id_solicitacao: Number(id) },
      include: {
        ...selectLocalizacao,
        analisadoPor: {
          select: { id: true, nome: true, email: true }
        },
        abrigo: true // retorna o abrigo criado, se já foi aprovado
      }
    })

    if (!solicitacao) {
      return reply.status(404).send({ mensagem: 'Solicitação não encontrada.' })
    }

    return reply.status(200).send(achatarLocalizacao(solicitacao))
  })


  // ----- Analisar (aprovar ou recusar) -----
  // Essa é a rota mais importante — é onde o Admin toma a decisão
  // URL: PATCH http://localhost:3000/api/solicitacoes/analisar/:id
  // Body: { status: "aprovado" | "recusado", motivoRecusa?: string }
  // Somente administradores — quem analisou vem do token (antes era "adminId: 1" fixo na tela)
  app.patch('/analisar/:id', { onRequest: [app.authenticateAdmin] }, async (request, reply) => {
    try {
      const { id } = request.params
      const { status, motivoRecusa } = request.body
      const adminId = request.user.id

      if (!['aprovado', 'recusado'].includes(status)) {
        return reply.status(400).send({ mensagem: 'Status inválido. Use "aprovado" ou "recusado".' })
      }

      if (status === 'recusado' && !motivoRecusa?.trim()) {
        return reply.status(400).send({ mensagem: 'Informe o motivo da recusa.' })
      }
      if (motivoRecusa && motivoRecusa.length > LIMITES.observacao) {
        return reply.status(400).send({ mensagem: `O motivo da recusa deve ter no máximo ${LIMITES.observacao} caracteres.` })
      }

      const solicitacao = await prisma.solicitacaoAbrigo.findUnique({
        where: { id_solicitacao: Number(id) }
      })

      if (!solicitacao) {
        return reply.status(404).send({ mensagem: 'Solicitação não encontrada.' })
      }

      if (solicitacao.status !== 'pendente') {
        return reply.status(400).send({ mensagem: 'Essa solicitação já foi analisada.' })
      }

      // Tudo numa transação: marcar como analisada, criar o abrigo e ligar os dois.
      // Antes o abrigo era criado primeiro e fora de transação: se a atualização
      // da solicitação falhasse, ela continuava "pendente" e aprovar de novo
      // duplicava o abrigo.
      const resultado = await prisma.$transaction(async (tx) => {

        // Só marca se AINDA estiver pendente. Se outro clique/admin já analisou
        // nesse meio-tempo, count vem 0 e nada é criado.
        const { count } = await tx.solicitacaoAbrigo.updateMany({
          where: { id_solicitacao: Number(id), status: 'pendente' },
          data: {
            status,
            motivoRecusa:   motivoRecusa ?? null,
            analisadoPorId: adminId,
            dataAnalise:    new Date(),
          }
        })
        if (count === 0) return null

        // Se aprovado: cria o Abrigo real com os dados da solicitação
        let abrigoCriado = null

        if (status === 'aprovado') {
          abrigoCriado = await tx.abrigo.create({
            data: {
              nome:                    solicitacao.nome,
              cep:                     solicitacao.cep,
              endereco:                solicitacao.endereco,
              cidadeId:                solicitacao.cidadeId,
              bairroId:                solicitacao.bairroId,
              telefone:                solicitacao.telefone,
              responsavel:             solicitacao.responsavel,
              tipoAbrigo:              solicitacao.tipoAbrigo,
              capacidadeTotal:         solicitacao.capacidadeTotal,
              capacidadeOcupada:       0,
              possuiAtendimentoMedico: solicitacao.possuiAtendimentoMedico,
              possuiEnfermagem:        solicitacao.possuiEnfermagem,
              possuiPets:              solicitacao.possuiPets,
              possuiAcessibilidade:    solicitacao.possuiAcessibilidade,
              possuiCozinha:           solicitacao.possuiCozinha,
              fotoAbrigo:              solicitacao.fotoAbrigo,
              status:                  'ativo',
            }
          })
        }

        // Liga a solicitação ao abrigo criado (null se recusada)
        const solicitacaoAtualizada = await tx.solicitacaoAbrigo.update({
          where: { id_solicitacao: Number(id) },
          data: { abrigo_id: abrigoCriado?.id_abrigo ?? null }
        })

        return { solicitacaoAtualizada, abrigoCriado }
      })

      if (!resultado) {
        return reply.status(400).send({ mensagem: 'Essa solicitação já foi analisada.' })
      }

      return reply.status(200).send({
        mensagem: status === 'aprovado'
          ? 'Solicitação aprovada e abrigo criado com sucesso!'
          : 'Solicitação recusada.',
        solicitacao: resultado.solicitacaoAtualizada,
        abrigoCriado: resultado.abrigoCriado // null se recusado
      })

    } catch (erro) {
      console.error('ERRO DETALHADO:', erro)
      return reply.status(500).send({ mensagem: erro.message })
    }
  })


  // ----- Excluir -----
  // URL: DELETE http://localhost:3000/api/solicitacoes/excluir/:id
  // Somente administradores
  app.delete('/excluir/:id', { onRequest: [app.authenticateAdmin] }, async (request, reply) => {
    const { id } = request.params

    const solicitacao = await prisma.solicitacaoAbrigo.findUnique({
      where: { id_solicitacao: Number(id) }
    })

    if (!solicitacao) {
      return reply.status(404).send({ mensagem: 'Solicitação não encontrada.' })
    }

    await prisma.solicitacaoAbrigo.delete({
      where: { id_solicitacao: Number(id) }
    })

    // Remove a foto do Storage depois de excluir o registro.
    // Se a solicitação foi aprovada, o abrigo criado usa a MESMA foto — aí ela fica.
    if (solicitacao.fotoAbrigo && !solicitacao.abrigo_id) {
      const nomeArquivo = solicitacao.fotoAbrigo.split('/').pop().split('?')[0]
      await supabase.storage.from('fotos-abrigo').remove([nomeArquivo])
    }

    return reply.status(200).send({ mensagem: 'Solicitação excluída com sucesso!' })
  })
}