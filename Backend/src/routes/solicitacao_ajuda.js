import prisma from '../lib/prisma.js'
import { selectLocalizacao, achatarLocalizacao } from '../lib/localizacao.js'
import { LIMITES, validarTamanhos } from '../lib/validacao.js'

// Tamanho máximo dos textos da solicitação
const erroTextos = ({ titulo, descricao, observacaoFechamento }) => validarTamanhos([
  ['Título', titulo, LIMITES.titulo], ['Descrição', descricao, LIMITES.descricao],
  ['Observação', observacaoFechamento, LIMITES.observacao],
])


// Devolve cidade/estado/bairro do abrigo como texto (formato usado pelas telas)
const comAbrigoAchatado = (solicitacao) => ({
  ...solicitacao,
  abrigo: achatarLocalizacao(solicitacao.abrigo)
})

export default async function solicitacaoAjudaRoutes(app) {

  // Rotas do voluntário: exige o token de voluntário (o id vem dele, não do front)
  // Antes a tela mandava "voluntarioId: 1" fixo e todo interesse ia para o voluntário 1
  async function apenasVoluntario(request, reply) {
    if (request.user?.tipo !== 'voluntario') {
      return reply.status(403).send({ mensagem: 'Apenas voluntários podem marcar interesse.' })
    }
  }
  const rotaVoluntario = { onRequest: [app.authenticate, apenasVoluntario] }
  const rotaAdmin      = { onRequest: [app.authenticateAdmin] }

  // ─── CADASTRAR ────────────────────────────────────────────────
  // Rota POST para o ADM criar uma nova solicitação de ajuda para um abrigo
  // URL: http://localhost:3000/api/solicitacoes-ajuda/cadastrar
  // Somente administradores — quem criou vem do token (antes era "criadoPorId: 1" fixo na tela)
  app.post('/cadastrar', rotaAdmin, async (request, reply) => {
    try {
      const {
        titulo,
        descricao,
        categoria,      // doacao | medicamento | voluntariado | infraestrutura | outro
        urgencia,       // baixa | media | alta | critica
        abrigoId,
      } = request.body
      const criadoPorId = request.user.id   // id do Admin logado que está criando

      if (!titulo || !descricao || !categoria || !abrigoId) {
        return reply.status(400).send({
          mensagem: 'titulo, descricao, categoria e abrigoId são obrigatórios.'
        })
      }

      const erroTamanho = erroTextos({ titulo, descricao })
      if (erroTamanho) {
        return reply.status(400).send({ mensagem: erroTamanho })
      }

      // Verifica se o abrigo existe
      const abrigo = await prisma.abrigo.findUnique({
        where: { id_abrigo: Number(abrigoId) }
      })
      if (!abrigo) {
        return reply.status(404).send({ mensagem: 'Abrigo não encontrado.' })
      }

      // Verifica se o admin existe
      const admin = await prisma.admin.findUnique({
        where: { id: Number(criadoPorId) }
      })
      if (!admin) {
        return reply.status(404).send({ mensagem: 'Administrador não encontrado.' })
      }

      const solicitacao = await prisma.solicitacaoAjuda.create({
        data: {
          titulo,
          descricao,
          categoria,
          urgencia:    urgencia ?? 'media',
          abrigoId:    Number(abrigoId),
          criadoPorId: Number(criadoPorId),
        }
      })

      return reply.status(201).send({
        mensagem:    'Solicitação de ajuda criada com sucesso!',
        solicitacao,
      })

    } catch (erro) {
      console.error('ERRO DETALHADO:', erro)
      return reply.status(500).send({ mensagem: erro.message })
    }
  })


  // ─── LISTAR TODAS ────────────────────────────────────────────
  // Query params opcionais: abrigoId, status, categoria, urgencia
  // URL: http://localhost:3000/api/solicitacoes-ajuda/listar
  // Somente administradores (traz contato dos voluntários)
  app.get('/listar', rotaAdmin, async (request, reply) => {
    try {
      const { abrigoId, status, categoria, urgencia } = request.query

      const solicitacoes = await prisma.solicitacaoAjuda.findMany({
        where: {
          abrigoId:  abrigoId  ? Number(abrigoId) : undefined,
          status:    status    ?? undefined,
          categoria: categoria ?? undefined,
          urgencia:  urgencia  ?? undefined,
        },
        include: {
          abrigo:     { select: { nome: true, telefone: true, ...selectLocalizacao } },
          criadoPor:  { select: { nome: true, email: true } },
          voluntario: { select: { nome: true, telefone: true, email: true } },
          _count:     { select: { interesses: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      return reply.status(200).send({
        mensagem: 'Lista:',
        solicitacoes: solicitacoes.map(comAbrigoAchatado),
      })

    } catch (erro) {
      console.error('ERRO DETALHADO:', erro)
      return reply.status(500).send({ mensagem: erro.message })
    }
  })


  // ─── LISTAR POR ABRIGO ───────────────────────────────────────
  // Usada na tela "Solicitações de Ajuda do Abrigo" (front)
  // URL: http://localhost:3000/api/solicitacoes-ajuda/abrigo/:id
  // Somente administradores
  app.get('/abrigo/:id', rotaAdmin, async (request, reply) => {
    try {
      const { id } = request.params

      const abrigo = await prisma.abrigo.findUnique({
        where: { id_abrigo: Number(id) }
      })
      if (!abrigo) {
        return reply.status(404).send({ mensagem: 'Abrigo não encontrado.' })
      }

      const solicitacoes = await prisma.solicitacaoAjuda.findMany({
        where: { abrigoId: Number(id) },
        include: {
          criadoPor:  { select: { nome: true, email: true } },
          voluntario: { select: { nome: true, telefone: true, email: true } },
          _count:     { select: { interesses: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      return reply.status(200).send({
        mensagem: 'Lista:',
        solicitacoes,
      })

    } catch (erro) {
      console.error('ERRO DETALHADO:', erro)
      return reply.status(500).send({ mensagem: erro.message })
    }
  })


  // ─── LISTAR PÚBLICO (VOLUNTÁRIO) ──────────────────────────────
  // Usada na tela de Solicitações do módulo Voluntário — mostra só o que
  // ainda está aberto ou em andamento, com dados do abrigo pra contato.
  // URL: http://localhost:3000/api/solicitacoes-ajuda/publico
  // Pública de propósito (só pedidos abertos + contato do abrigo, nada pessoal)
  app.get('/publico', async (request, reply) => {
    try {
      const solicitacoes = await prisma.solicitacaoAjuda.findMany({
        where: { status: { in: ['aberto', 'em_andamento'] } },
        include: {
          abrigo: { select: { nome: true, telefone: true, ...selectLocalizacao } },
        },
        orderBy: { createdAt: 'desc' },
      })

      return reply.status(200).send({
        mensagem: 'Lista:',
        solicitacoes: solicitacoes.map(comAbrigoAchatado),
      })

    } catch (erro) {
      console.error('ERRO DETALHADO:', erro)
      return reply.status(500).send({ mensagem: erro.message })
    }
  })


  // ─── MEUS INTERESSES (VOLUNTÁRIO) ─────────────────────────────
  // Retorna os IDs de solicitação em que o voluntário logado já marcou
  // interesse, pra tela pintar o coração preenchido.
  // URL: http://localhost:3000/api/solicitacoes-ajuda/meus-interesses
  // O voluntário vem do token (cabeçalho Authorization)
  app.get('/meus-interesses', rotaVoluntario, async (request, reply) => {
    try {
      const voluntarioId = request.user.id

      const interesses = await prisma.solicitacaoAjudaInteresse.findMany({
        where: { voluntarioId },
        select: { solicitacaoId: true }
      })

      return reply.status(200).send({ interesses })

    } catch (erro) {
      console.error('ERRO DETALHADO:', erro)
      return reply.status(500).send({ mensagem: erro.message })
    }
  })


  // ─── LISTAR UMA SÓ ───────────────────────────────────────────
  // URL: http://localhost:3000/api/solicitacoes-ajuda/listar/:id
  // Somente administradores (traz os voluntários interessados e seus contatos)
  app.get('/listar/:id', rotaAdmin, async (request, reply) => {
    try {
      const { id } = request.params

      const solicitacao = await prisma.solicitacaoAjuda.findUnique({
        where: { id_solicitacao: Number(id) },
        include: {
          abrigo: {
            select: {
              id_abrigo: true, nome: true, endereco: true,
              telefone: true, responsavel: true, ...selectLocalizacao,
            }
          },
          criadoPor:  { select: { id: true, nome: true, email: true } },
          voluntario: { select: { id_voluntario: true, nome: true, telefone: true, email: true } },
          interesses: {
            include: { voluntario: { select: { id_voluntario: true, nome: true, telefone: true, email: true } } }
          },
        }
      })

      if (!solicitacao) {
        return reply.status(404).send({ mensagem: 'Solicitação não encontrada.' })
      }

      return reply.status(200).send(comAbrigoAchatado(solicitacao))

    } catch (erro) {
      console.error('ERRO DETALHADO:', erro)
      return reply.status(500).send({ mensagem: erro.message })
    }
  })


  // ─── ATUALIZAR (ADM) ─────────────────────────────────────────
  // Edita dados da solicitação, muda status, marca voluntário responsável
  // e/ou preenche a observação de fechamento (ao concluir/cancelar).
  // URL: http://localhost:3000/api/solicitacoes-ajuda/atualizar/:id
  // Somente administradores
  app.put('/atualizar/:id', rotaAdmin, async (request, reply) => {
    try {
      const { id } = request.params
      const {
        titulo,
        descricao,
        categoria,
        urgencia,
        status,               // aberto | em_andamento | concluido | cancelado
        observacaoFechamento,
        voluntarioId,         // opcional — ADM marca quem atendeu ao concluir
      } = request.body

      const solicitacaoExistente = await prisma.solicitacaoAjuda.findUnique({
        where: { id_solicitacao: Number(id) }
      })

      if (!solicitacaoExistente) {
        return reply.status(404).send({ mensagem: 'Solicitação não encontrada.' })
      }

      const erroTamanho = erroTextos({ titulo, descricao, observacaoFechamento })
      if (erroTamanho) {
        return reply.status(400).send({ mensagem: erroTamanho })
      }

      if (voluntarioId) {
        const voluntario = await prisma.voluntario.findUnique({
          where: { id_voluntario: Number(voluntarioId) }
        })
        if (!voluntario) {
          return reply.status(404).send({ mensagem: 'Voluntário não encontrado.' })
        }
      }

      const solicitacaoAtualizada = await prisma.solicitacaoAjuda.update({
        where: { id_solicitacao: Number(id) },
        data: {
          titulo:               titulo               ?? solicitacaoExistente.titulo,
          descricao:            descricao            ?? solicitacaoExistente.descricao,
          categoria:            categoria            ?? solicitacaoExistente.categoria,
          urgencia:             urgencia             ?? solicitacaoExistente.urgencia,
          status:               status               ?? solicitacaoExistente.status,
          observacaoFechamento: observacaoFechamento ?? solicitacaoExistente.observacaoFechamento,
          // voluntarioId: null = mantém o anterior; undefined = não veio no body
          voluntarioId: voluntarioId !== undefined
            ? (voluntarioId ? Number(voluntarioId) : null)
            : solicitacaoExistente.voluntarioId,
        },
        include: {
          abrigo:     { select: { nome: true, ...selectLocalizacao } },
          voluntario: { select: { nome: true, telefone: true, email: true } },
        }
      })

      return reply.status(200).send({
        mensagem:    'Solicitação atualizada com sucesso!',
        solicitacao: comAbrigoAchatado(solicitacaoAtualizada),
      })

    } catch (erro) {
      console.error('ERRO DETALHADO:', erro)
      return reply.status(500).send({ mensagem: erro.message })
    }
  })


  // ─── MARCAR INTERESSE (VOLUNTÁRIO) ───────────────────────────
  // Cria um registro em SolicitacaoAjudaInteresse — apenas visual,
  // não muda o status nem atribui o voluntário responsável.
  // Um voluntário não pode marcar interesse duas vezes na mesma solicitação.
  // URL: http://localhost:3000/api/solicitacoes-ajuda/interesse/:id
  // O voluntário vem do token (cabeçalho Authorization)
  app.post('/interesse/:id', rotaVoluntario, async (request, reply) => {
    try {
      const { id } = request.params
      const voluntarioId = request.user.id

      const solicitacao = await prisma.solicitacaoAjuda.findUnique({
        where: { id_solicitacao: Number(id) }
      })

      if (!solicitacao) {
        return reply.status(404).send({ mensagem: 'Solicitação não encontrada.' })
      }

      if (solicitacao.status !== 'aberto') {
        return reply.status(409).send({ mensagem: 'Esta solicitação não está mais aberta.' })
      }

      const jaExiste = await prisma.solicitacaoAjudaInteresse.findUnique({
        where: {
          solicitacaoId_voluntarioId: {
            solicitacaoId: Number(id),
            voluntarioId:  Number(voluntarioId),
          }
        }
      })

      if (jaExiste) {
        return reply.status(409).send({ mensagem: 'Você já demonstrou interesse nesta solicitação.' })
      }

      const interesse = await prisma.solicitacaoAjudaInteresse.create({
        data: {
          solicitacaoId: Number(id),
          voluntarioId:  Number(voluntarioId),
        }
      })

      return reply.status(201).send({
        mensagem:   'Interesse registrado! O abrigo entrará em contato.',
        interesse,
      })

    } catch (erro) {
      console.error('ERRO DETALHADO:', erro)
      return reply.status(500).send({ mensagem: erro.message })
    }
  })


  // ─── REMOVER INTERESSE (VOLUNTÁRIO) ──────────────────────────
  // URL: http://localhost:3000/api/solicitacoes-ajuda/interesse/:id  (DELETE)
  // O voluntário vem do token (cabeçalho Authorization)
  app.delete('/interesse/:id', rotaVoluntario, async (request, reply) => {
    try {
      const { id } = request.params
      const voluntarioId = request.user.id

      // deleteMany não dá erro se o interesse já não existia
      await prisma.solicitacaoAjudaInteresse.deleteMany({
        where: { solicitacaoId: Number(id), voluntarioId }
      })

      return reply.status(200).send({ mensagem: 'Interesse removido.' })

    } catch (erro) {
      console.error('ERRO DETALHADO:', erro)
      return reply.status(500).send({ mensagem: erro.message })
    }
  })


  // ─── EXCLUIR ─────────────────────────────────────────────────
  // URL: http://localhost:3000/api/solicitacoes-ajuda/excluir/:id
  // Somente administradores
  app.delete('/excluir/:id', rotaAdmin, async (request, reply) => {
    try {
      const { id } = request.params

      const solicitacaoExistente = await prisma.solicitacaoAjuda.findUnique({
        where: { id_solicitacao: Number(id) }
      })

      if (!solicitacaoExistente) {
        return reply.status(404).send({ mensagem: 'Solicitação não encontrada.' })
      }

      // Remove primeiro os interesses vinculados (evita erro de FK)
      await prisma.solicitacaoAjudaInteresse.deleteMany({
        where: { solicitacaoId: Number(id) }
      })

      await prisma.solicitacaoAjuda.delete({
        where: { id_solicitacao: Number(id) }
      })

      return reply.status(200).send({ mensagem: 'Solicitação excluída com sucesso!' })

    } catch (erro) {
      console.error('ERRO DETALHADO:', erro)
      return reply.status(500).send({ mensagem: erro.message })
    }
  })
}