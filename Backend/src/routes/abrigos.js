import prisma from '../lib/prisma.js'
import supabase from '../supabase.js'
import { selectLocalizacao, achatarLocalizacao, validarCidadeBairro } from '../lib/localizacao.js'
import { LIMITE_CORPO_COM_FOTO, LIMITES, capacidadeValida, validarTamanhos, validarFormatos } from '../lib/validacao.js'


// Capacidade total e ocupada: inteiros de 0 a 99.999 e ocupada <= total
// Retorna a mensagem de erro ou null
function erroCapacidade(total, ocupada) {
  if (!capacidadeValida(total)) return 'A capacidade total deve ser um número inteiro de 0 a 99.999.'
  if (!capacidadeValida(ocupada)) return 'A capacidade ocupada deve ser um número inteiro de 0 a 99.999.'
  if (Number(ocupada) > Number(total)) return 'A capacidade ocupada não pode ser maior que a total.'
  return null
}

// Tamanho dos textos + formato do telefone e do CEP
// "atuais" = abrigo do banco (na edição): o que não mudou não é conferido
function erroTextosAbrigo({ nome, endereco, responsavel, telefone, cep }, atuais) {
  return validarTamanhos([
    ['Nome do abrigo', nome, LIMITES.nomeLocal], ['Endereço', endereco, LIMITES.endereco],
    ['Responsável', responsavel, LIMITES.nomePessoa], ['Telefone', telefone, LIMITES.telefone], ['CEP', cep, LIMITES.cep],
  ]) ?? validarFormatos({ telefone, cep }, atuais)
}


export default async function abrigoRoutes(app) {

  //----- Cadastrar ----- 
  //Método POST para cadastrar um novo abrigo
  //URL: http://localhost:3000/api/abrigos/cadastrar
  //Somente administradores
  app.post('/cadastrar', { onRequest: [app.authenticateAdmin], bodyLimit: LIMITE_CORPO_COM_FOTO }, async (request, reply) => {

    const { nome, cep, cidadeId, bairroId, endereco, telefone, responsavel, tipoAbrigo,
      capacidadeTotal, capacidadeOcupada, possuiAtendimentoMedico,
      possuiEnfermagem, possuiPets, possuiAcessibilidade, possuiCozinha,
      status, fotoAbrigo, latitude, longitude } = request.body

    if (!nome?.trim() || !cep || !endereco?.trim() || !tipoAbrigo) {
      return reply.status(400).send({ mensagem: 'Nome, CEP, endereço e tipo do abrigo são obrigatórios.' })
    }

    const erroCampos = erroTextosAbrigo({ nome, endereco, responsavel, telefone, cep })
    if (erroCampos) {
      return reply.status(400).send({ mensagem: erroCampos })
    }

    // Capacidade ocupada não informada = 0
    const erroCap = erroCapacidade(capacidadeTotal, capacidadeOcupada ?? 0)
    if (erroCap) {
      return reply.status(400).send({ mensagem: erroCap })
    }

    // A cidade é obrigatória; o bairro, se vier, precisa ser da mesma cidade
    const erroLocalizacao = await validarCidadeBairro(prisma, cidadeId, bairroId)
    if (erroLocalizacao) {
      return reply.status(400).send({ mensagem: erroLocalizacao })
    }

    // Verifica se já existe um abrigo com o mesmo nome e endereço
    const abrigoExistente = await prisma.abrigo.findFirst({
      where: { nome, endereco }
    })

    if (abrigoExistente) {
      return reply.status(400).send({ mensagem: 'Abrigo já cadastrado.' })
    }

    // Cria o abrigo primeiro sem foto para gerar o ID
    // O ID é necessário para nomear o arquivo no Storage
    const abrigo = await prisma.abrigo.create({
      data: {
        nome,
        cep,
        cidadeId: Number(cidadeId),
        bairroId: bairroId ? Number(bairroId) : null,
        endereco,
        telefone,
        responsavel,
        tipoAbrigo,
        capacidadeTotal: Number(capacidadeTotal),
        capacidadeOcupada: Number(capacidadeOcupada ?? 0),
        possuiAtendimentoMedico: possuiAtendimentoMedico ?? false,
        possuiEnfermagem: possuiEnfermagem ?? false,
        possuiPets: possuiPets ?? false,
        possuiAcessibilidade: possuiAcessibilidade ?? false,
        possuiCozinha: possuiCozinha ?? false,
        status: status ?? 'ativo',
        fotoAbrigo: null,
        // Coordenadas vindas do geocoding feito na página de cadastro
        // Podem ser null se o geocoding falhou ou o usuário não preencheu o endereço
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      },
      include: selectLocalizacao
    })

    // Se veio uma foto em base64, faz o upload usando o ID do abrigo + timestamp como nome do arquivo
    // O timestamp é necessário para quebrar o cache do CDN do Supabase:
    // Como a URL pública não muda quando o arquivo é sobrescrito, o navegador servia a foto antiga.
    // Agora cada upload gera um nome único (abrigo-{id}-{timestamp}.jpg), forçando uma URL nova.
    if (fotoAbrigo) {
      const buffer = Buffer.from(fotoAbrigo, 'base64')
      const nomeArquivo = `abrigo-${abrigo.id_abrigo}-${Date.now()}.jpg`

      const { data, error } = await supabase.storage
        .from('fotos-abrigo')
        .upload(nomeArquivo, buffer, {
          contentType: 'image/jpeg',
          upsert: false // cada upload tem nome único, não precisa sobrescrever
        })

      if (error) {
        return reply.status(500).send({ mensagem: 'Abrigo criado, mas erro ao salvar a foto.' })
      }

      const { data: urlData } = supabase.storage
        .from('fotos-abrigo')
        .getPublicUrl(data.path)

      // Atualiza o abrigo com a URL pública da foto
      await prisma.abrigo.update({
        where: { id_abrigo: abrigo.id_abrigo },
        data: { fotoAbrigo: urlData.publicUrl }
      })

      abrigo.fotoAbrigo = urlData.publicUrl
    }

    const local = achatarLocalizacao(abrigo)

    return reply.status(201).send({
      mensagem: 'Abrigo cadastrado com sucesso!',
      id: abrigo.id_abrigo,
      nome: abrigo.nome,
      cep: abrigo.cep,
      estado: local.estado,
      cidade: local.cidade,
      bairro: local.bairro,
      cidadeId: local.cidadeId,
      bairroId: local.bairroId,
      endereco: abrigo.endereco,
      telefone: abrigo.telefone,
      responsavel: abrigo.responsavel,
      tipoAbrigo: abrigo.tipoAbrigo,
      capacidadeTotal: abrigo.capacidadeTotal,
      capacidadeOcupada: abrigo.capacidadeOcupada,
      possuiAtendimentoMedico: abrigo.possuiAtendimentoMedico,
      possuiEnfermagem: abrigo.possuiEnfermagem,
      possuiPets: abrigo.possuiPets,
      possuiAcessibilidade: abrigo.possuiAcessibilidade,
      possuiCozinha: abrigo.possuiCozinha,
      status: abrigo.status,
      fotoAbrigo: abrigo.fotoAbrigo,
      latitude: abrigo.latitude,
      longitude: abrigo.longitude,
    })
  })


  //----- Listar -----
  //Método GET para listar todos os abrigos, com filtros opcionais via query params
  //URL: http://localhost:3000/api/abrigos/listar
  //URL: http://localhost:3000/api/abrigos/listar?nome=
  //URL: http://localhost:3000/api/abrigos/listar?cidade=
  //URL: http://localhost:3000/api/abrigos/listar?endereco=
  //URL: http://localhost:3000/api/abrigos/listar?cidadeId=1&bairroId=2&status=ativo
  //Pública de propósito: o ChatBot e o módulo do voluntário usam esta rota,
  //e ela só traz os dados do abrigo (nada de vítimas)
  app.get('/listar', async (request, reply) => {

    const { id, nome, cep, endereco, cidade, estado, bairro, cidadeId, bairroId, status } = request.query

    const abrigos = await prisma.abrigo.findMany({
      where: {
        // O contains busca por partes do texto (ex: "escola" acha "Escola Municipal")
        // O mode: 'insensitive' ignora maiúsculas e minúsculas
        // undefined remove o filtro se o query param não for informado
        nome:     nome     ? { contains: nome,     mode: 'insensitive' } : undefined,
        endereco: endereco ? { contains: endereco, mode: 'insensitive' } : undefined,
        cep:      cep      ? { contains: cep }                           : undefined,
        status:   status   || undefined,
        id_abrigo: id      ? { equals: Number(id) }                      : undefined,
        cidadeId: cidadeId ? Number(cidadeId)                            : undefined,
        bairroId: bairroId ? Number(bairroId)                            : undefined,
        // Filtros por nome da cidade / sigla do estado / nome do bairro
        cidade: (cidade || estado) ? {
          nome:   cidade ? { contains: cidade, mode: 'insensitive' } : undefined,
          estado: estado ? { sigla: { equals: estado, mode: 'insensitive' } } : undefined,
        } : undefined,
        bairro: bairro ? { nome: { contains: bairro, mode: 'insensitive' } } : undefined,
      },
      include: {
        cidade: selectLocalizacao.cidade,
        // Nível de risco do bairro + quantos alertas ativos existem nele (para o mapa)
        bairro: {
          select: {
            id_bairro: true, nome: true, nivelRisco: true,
            _count: { select: { alertas: { where: { status: 'ativo' } } } }
          }
        }
      }
    })

    // Retorna apenas os campos necessários para a listagem
    // capacidadeTotal e capacidadeOcupada são usados para a barra de progresso na tela
    // latitude e longitude são usados pelo Mapa para plotar os marcadores
    const abrigosListados = abrigos.map((abrigo) => ({
      id:                abrigo.id_abrigo,
      nome:              abrigo.nome,
      cep:               abrigo.cep,
      estado:            abrigo.cidade.estado.sigla,
      cidade:            abrigo.cidade.nome,
      bairro:            abrigo.bairro?.nome ?? null,
      cidadeId:          abrigo.cidadeId,
      bairroId:          abrigo.bairroId,
      endereco:          abrigo.endereco,
      telefone:          abrigo.telefone,
      responsavel:       abrigo.responsavel,
      status:            abrigo.status,
      tipoAbrigo:        abrigo.tipoAbrigo,
      // Estrutura do abrigo — usada nos filtros da tela de Abrigos do voluntário
      possuiAtendimentoMedico: abrigo.possuiAtendimentoMedico,
      possuiEnfermagem:        abrigo.possuiEnfermagem,
      possuiPets:              abrigo.possuiPets,
      possuiAcessibilidade:    abrigo.possuiAcessibilidade,
      possuiCozinha:           abrigo.possuiCozinha,
      capacidadeTotal:   abrigo.capacidadeTotal,
      capacidadeOcupada: abrigo.capacidadeOcupada,
      fotoAbrigo:        abrigo.fotoAbrigo,
      // Incluídos agora para o Mapa plotar os marcadores sem precisar de geocoding
      latitude:          abrigo.latitude,
      longitude:         abrigo.longitude,
      // Dados do bairro para exibir nível de risco e alerta no mapa e nas listagens
      nivelRisco:        abrigo.bairro?.nivelRisco ?? null,
      statusAlerta:      (abrigo.bairro?._count.alertas ?? 0) > 0,
    }))

    return reply.status(200).send({
      mensagem: 'Lista:',
      abrigos: abrigosListados
    })
  })


  //----- Listar um só ----- (Importante para o Detalhes-abrigo)
  //Método GET para buscar um abrigo específico pelo ID
  //Retorna TODOS os campos — usado pela tela de Detalhes
  //URL: http://localhost:3000/api/abrigos/listar/:id
  //Somente administradores — traz as vítimas abrigadas (dados pessoais)
  app.get('/listar/:id', { onRequest: [app.authenticateAdmin] }, async (request, reply) => {

    const { id } = request.params

    const abrigo = await prisma.abrigo.findUnique({
      where: { id_abrigo: Number(id) },
      // Inclui os dados completos da região e a contagem de vítimas e voluntários vinculados
      include: {
        ...selectLocalizacao,
        vitimas: {
          select: {
            id_vitima:      true,
            nome:           true,
            dataNascimento: true, // ← necessário para calcular idade no frontend
            dataEntrada:    true, // ← necessário para exibir horário de entrada
            genero:         true, // ← necessário para exibir gênero no frontend
          }
        },
        voluntarios: { select: { id_voluntario: true, nome: true } },
        // Antes era "doacoes" (model removido do schema). Agora é "solicitacoesAjuda",
        // que substitui o antigo model de doações.
        solicitacoesAjuda: {
          select: { id_solicitacao: true, titulo: true, categoria: true, urgencia: true, status: true }
        },
      }
    })

    if (!abrigo) {
      return reply.status(404).send({ mensagem: 'Abrigo não encontrado.' })
    }

    // O Prisma já retorna todos os campos automaticamente com o findUnique
    // achatarLocalizacao devolve cidade, estado e bairro como texto (+ os IDs)
    return reply.status(200).send(achatarLocalizacao(abrigo))
  })


  //----- Atualizar -----
  //Método PUT para atualizar as informações de um abrigo
  //URL: http://localhost:3000/api/abrigos/atualizar/:id
  //Somente administradores
  app.put('/atualizar/:id', { onRequest: [app.authenticateAdmin], bodyLimit: LIMITE_CORPO_COM_FOTO }, async (request, reply) => {
    try {

    const { id } = request.params
    const { nome, cep, cidadeId, bairroId, endereco, telefone, responsavel, tipoAbrigo,
      capacidadeTotal, capacidadeOcupada, possuiAtendimentoMedico,
      possuiEnfermagem, possuiPets, possuiAcessibilidade, possuiCozinha,
      status, fotoAbrigo, latitude, longitude } = request.body

    const abrigoExistente = await prisma.abrigo.findUnique({
      where: { id_abrigo: Number(id) }
    })

    if (!abrigoExistente) {
      return reply.status(404).send({ mensagem: 'Abrigo não encontrado.' })
    }

    // Textos e formatos (telefone e CEP só se mudaram — cadastros antigos continuam editáveis)
    const erroCampos = erroTextosAbrigo({ nome, endereco, responsavel, telefone, cep }, abrigoExistente)
    if (erroCampos) {
      return reply.status(400).send({ mensagem: erroCampos })
    }

    // Confere a capacidade com os valores finais (o que não veio no body continua como está;
    // null — campo apagado na tela — conta como valor inválido)
    const erroCap = erroCapacidade(
      capacidadeTotal   === undefined ? abrigoExistente.capacidadeTotal   : capacidadeTotal,
      capacidadeOcupada === undefined ? abrigoExistente.capacidadeOcupada : capacidadeOcupada
    )
    if (erroCap) {
      return reply.status(400).send({ mensagem: erroCap })
    }

    // Se a cidade ou o bairro vieram no body, confere se combinam
    // (undefined = mantém o atual | bairroId null = remove o bairro)
    const novaCidadeId = cidadeId !== undefined ? Number(cidadeId) : abrigoExistente.cidadeId
    const novoBairroId = bairroId !== undefined ? (bairroId ? Number(bairroId) : null) : abrigoExistente.bairroId

    const erroLocalizacao = await validarCidadeBairro(prisma, novaCidadeId, novoBairroId)
    if (erroLocalizacao) {
      return reply.status(400).send({ mensagem: erroLocalizacao })
    }

    // Define a URL da foto que vai ser salva no banco
    // Por padrão mantém a foto atual, mas pode mudar dependendo do que veio no body
    let fotoUrl = abrigoExistente.fotoAbrigo

    if (fotoAbrigo === null) {
      // Usuário clicou em "Remover Foto" — apaga do Storage e do banco
      // O nome do arquivo é extraído da URL salva no banco, já que agora o nome tem timestamp
      // Exemplo: "https://...supabase.co/.../abrigo-24-1718323200000.jpg" → "abrigo-24-1718323200000.jpg"
      if (abrigoExistente.fotoAbrigo) {
        const nomeArquivo = abrigoExistente.fotoAbrigo.split('/').pop().split('?')[0]
        await supabase.storage
          .from('fotos-abrigo')
          .remove([nomeArquivo])
      }
      fotoUrl = null

    } else if (fotoAbrigo && !fotoAbrigo.startsWith('http')) {
      // Veio um novo base64 — apaga a foto anterior e sobe a nova com nome único
      //
      // Antes usávamos upsert com nome fixo (abrigo-{id}.jpg), mas o CDN do Supabase
      // fazia cache da URL e continuava servindo a foto antiga mesmo após o upload.
      // A solução foi:
      //   1. Apagar o arquivo anterior pelo nome extraído da URL do banco
      //   2. Subir o novo com timestamp no nome → URL nova → cache quebrado
      if (abrigoExistente.fotoAbrigo) {
        const nomeAntigo = abrigoExistente.fotoAbrigo.split('/').pop().split('?')[0]
        await supabase.storage
          .from('fotos-abrigo')
          .remove([nomeAntigo])
      }

      const buffer = Buffer.from(fotoAbrigo, 'base64')
      const nomeArquivo = `abrigo-${id}-${Date.now()}.jpg`

      const { data, error } = await supabase.storage
        .from('fotos-abrigo')
        .upload(nomeArquivo, buffer, {
          contentType: 'image/jpeg',
          upsert: false // nome único por timestamp, não precisa sobrescrever
        })

      if (error) {
        return reply.status(500).send({ mensagem: 'Erro ao fazer upload da foto.' })
      }

      const { data: urlData } = supabase.storage
        .from('fotos-abrigo')
        .getPublicUrl(data.path)

      fotoUrl = urlData.publicUrl

    }
    // Se fotoAbrigo vier como uma URL http, não faz nada — mantém a foto atual

    const abrigoAtualizado = await prisma.abrigo.update({
      where: { id_abrigo: Number(id) },
      data: {
        nome,
        cep,
        cidadeId: novaCidadeId,
        bairroId: novoBairroId,
        endereco,
        telefone,
        responsavel,
        tipoAbrigo,
        capacidadeTotal:   capacidadeTotal   !== undefined ? Number(capacidadeTotal)   : undefined,
        capacidadeOcupada: capacidadeOcupada !== undefined ? Number(capacidadeOcupada) : undefined,
        possuiAtendimentoMedico: possuiAtendimentoMedico ?? false,
        possuiEnfermagem:        possuiEnfermagem        ?? false,
        possuiPets:              possuiPets              ?? false,
        possuiAcessibilidade:    possuiAcessibilidade    ?? false,
        possuiCozinha:           possuiCozinha           ?? false,
        status:                  status                  ?? 'ativo',
        fotoAbrigo:              fotoUrl,
        // Atualiza as coordenadas se vieram no body
        // Se não vieram (undefined), mantém os valores anteriores do banco
        latitude:  latitude  ?? abrigoExistente.latitude,
        longitude: longitude ?? abrigoExistente.longitude,
      },
      include: selectLocalizacao
    })

    const local = achatarLocalizacao(abrigoAtualizado)

    return reply.status(200).send({
      mensagem: 'Informações do abrigo atualizadas com sucesso!',
      id_abrigo:               abrigoAtualizado.id_abrigo,
      nome:                    abrigoAtualizado.nome,
      cep:                     abrigoAtualizado.cep,
      estado:                  local.estado,
      cidade:                  local.cidade,
      bairro:                  local.bairro,
      cidadeId:                local.cidadeId,
      bairroId:                local.bairroId,
      endereco:                abrigoAtualizado.endereco,
      telefone:                abrigoAtualizado.telefone,
      responsavel:             abrigoAtualizado.responsavel,
      tipoAbrigo:              abrigoAtualizado.tipoAbrigo,
      capacidadeTotal:         abrigoAtualizado.capacidadeTotal,
      capacidadeOcupada:       abrigoAtualizado.capacidadeOcupada,
      possuiAtendimentoMedico: abrigoAtualizado.possuiAtendimentoMedico,
      possuiEnfermagem:        abrigoAtualizado.possuiEnfermagem,
      possuiPets:              abrigoAtualizado.possuiPets,
      possuiAcessibilidade:    abrigoAtualizado.possuiAcessibilidade,
      possuiCozinha:           abrigoAtualizado.possuiCozinha,
      status:                  abrigoAtualizado.status,
      fotoAbrigo:              abrigoAtualizado.fotoAbrigo,
      latitude:                abrigoAtualizado.latitude,
      longitude:               abrigoAtualizado.longitude,
    })

    } catch (erro) {
      console.error('ERRO DETALHADO:', erro)
      return reply.status(500).send({ mensagem: erro.message })
    }
  })


  // ─── EXCLUIR ─────────────────────────────────────────────────
  // Método DELETE para excluir um abrigo
  // URL: http://localhost:3000/api/abrigos/excluir/:id
  // Somente administradores
  app.delete('/excluir/:id', { onRequest: [app.authenticateAdmin] }, async (request, reply) => {

    const { id } = request.params

    const abrigoExistente = await prisma.abrigo.findUnique({
      where: { id_abrigo: Number(id) },
      include: { _count: { select: { solicitacoesAjuda: true } } }
    })

    if (!abrigoExistente) {
      return reply.status(404).send({ mensagem: 'Abrigo não encontrado.' })
    }

    // O banco não deixa excluir um abrigo que tem solicitações de ajuda (histórico).
    // Antes a API tentava mesmo assim: dava erro 500 e a foto já tinha sido apagada.
    const totalSolicitacoes = abrigoExistente._count.solicitacoesAjuda
    if (totalSolicitacoes > 0) {
      return reply.status(409).send({
        mensagem: `Não é possível excluir: este abrigo tem ${totalSolicitacoes} solicitação(ões) de ajuda vinculada(s). Exclua-as antes.`
      })
    }

    await prisma.abrigo.delete({
      where: { id_abrigo: Number(id) }
    })

    // Só apaga a foto do Storage depois que o registro foi excluído de verdade
    // O nome do arquivo é extraído da URL salva no banco, já que agora o nome tem timestamp
    // Exemplo: "https://...supabase.co/.../abrigo-24-1718323200000.jpg" → "abrigo-24-1718323200000.jpg"
    if (abrigoExistente.fotoAbrigo) {
      const nomeArquivo = abrigoExistente.fotoAbrigo.split('/').pop().split('?')[0]
      await supabase.storage
        .from('fotos-abrigo')
        .remove([nomeArquivo])
    }

    return reply.status(200).send({ mensagem: 'Abrigo excluído com sucesso!' })
  })
}