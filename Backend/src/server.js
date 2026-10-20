//Os imports necessários para o servidor

import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyJwt from '@fastify/jwt'
import { timingSafeEqual } from 'node:crypto'
import authRoutes from './routes/auth.js'
import abrigoRoutes from './routes/abrigos.js'
import estadoRoutes from './routes/estado.js'
import cidadeRoutes from './routes/cidade.js'
import bairroRoutes from './routes/bairro.js'
import vitimaRoutes from './routes/vitima.js'
import solicitacaoAbrigoRoutes from './routes/solicitacao_abrigo.js'
import voluntarioRoutes from './routes/voluntario.js'
import solicitacaoAjudaRoutes from './routes/solicitacao_ajuda.js'
import alertaRoutes from './routes/alertas.js'
import inscritoRoutes from './routes/inscritos.js'
import botRoutes from './routes/bot.js'
import mapaRoutes from './routes/mapa.js'
import 'dotenv/config' // Garante que o process.env funcione

//cria a instância
const app = Fastify({ logger: true })

// registra o CORS (necessário para conectar com o frontend)
await app.register(cors, { 
  origin: true 
})

// Registra o JWT usando a sua chave do .env
app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET
})

// Qualquer usuário logado (admin ou voluntário)
app.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify()
  } catch (err) {
    return reply.status(401).send({ mensagem: 'Token inválido ou expirado.' })
  }
})

// Somente administradores (token gerado em /api/auth/login)
app.decorate('authenticateAdmin', async (request, reply) => {
  try {
    await request.jwtVerify()
  } catch (err) {
    return reply.status(401).send({ mensagem: 'Faça login como administrador para continuar.' })
  }

  if (request.user?.tipo !== 'admin') {
    return reply.status(403).send({ mensagem: 'Acesso restrito a administradores.' })
  }
})

// Somente o ChatBot: compara o cabeçalho x-bot-key com o BOT_API_KEY do .env
app.decorate('authenticateBot', async (request, reply) => {
  const chaveEsperada = process.env.BOT_API_KEY
  if (!chaveEsperada) {
    return reply.status(500).send({ mensagem: 'BOT_API_KEY não configurada no .env do Backend.' })
  }

  const recebida = Buffer.from(String(request.headers['x-bot-key'] ?? ''))
  const esperada = Buffer.from(chaveEsperada)

  // timingSafeEqual evita descobrir a chave medindo o tempo de resposta
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) {
    return reply.status(401).send({ mensagem: 'Chave do bot inválida.' })
  }
})

// Erros que as rotas não trataram (foto grande demais, JSON inválido, falha no banco...)
// O Fastify responderia { message } em inglês; as telas leem { mensagem }.
app.setErrorHandler((erro, request, reply) => {
  const status = erro.statusCode ?? 500

  let mensagem = erro.message
  if (status === 413) {
    mensagem = 'O arquivo enviado é grande demais. Envie uma foto de até 2 MB.'
  } else if (status >= 500) {
    request.log.error(erro)
    mensagem = 'Erro interno no servidor. Tente novamente.'
  }

  return reply.status(status).send({ mensagem })
})

// Registra as suas rotas
app.register(authRoutes, { prefix: '/api/auth' })
app.register(abrigoRoutes, { prefix: '/api/abrigos' })
app.register(estadoRoutes, { prefix: '/api/estados' })
app.register(cidadeRoutes, { prefix: '/api/cidades' })
app.register(bairroRoutes, { prefix: '/api/bairros' })
app.register(vitimaRoutes, { prefix: '/api/vitimas' })
app.register(solicitacaoAbrigoRoutes, { prefix: '/api/solicitacoes'})
app.register(voluntarioRoutes, { prefix: '/api/voluntarios' })
app.register(solicitacaoAjudaRoutes, { prefix: '/api/solicitacoes-ajuda' })
app.register(alertaRoutes, { prefix: '/api/alertas' })
app.register(inscritoRoutes, { prefix: '/api/inscritos' })
app.register(botRoutes, { prefix: '/api/bot' })
app.register(mapaRoutes, { prefix: '/api/mapa' })


// Inicia o servidor
const start = async () => {
  try {
    await app.listen({ port: Number(process.env.PORT) || 3000 })
    console.log(`Servidor rodando em http://localhost:${Number(process.env.PORT) || 3000}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
