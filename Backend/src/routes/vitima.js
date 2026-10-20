// Importa o Prisma Client
import prisma from '../lib/prisma.js'
import supabase from '../supabase.js'
import { selectLocalizacao, achatarLocalizacao } from '../lib/localizacao.js'
import { LIMITE_CORPO_COM_FOTO, LIMITES, validarNascimento, dataParaTexto, textoOuNull, validarTamanhos, validarFormatos } from '../lib/validacao.js'


// Erro de valor duplicado no banco (P2002) — o telefone da vítima é único
function erroDuplicado(erro) {
  return erro?.code === 'P2002'
    ? 'Já existe uma vítima cadastrada com este telefone.'
    : null
}


// Exporta a função que define as rotas de vítima
export default async function vitimaRoutes(app) {

  // Todas as rotas de vítima exigem login de administrador:
  // elas trazem CPF, telefone e data de nascimento (dados pessoais — LGPD)
  app.addHook('onRequest', app.authenticateAdmin)

  //----- Cadastrar -----
  //Rota POST para cadastrar uma nova vítima
  //URL http://localhost:3000/api/vitimas/cadastrar
  app.post('/cadastrar', { bodyLimit: LIMITE_CORPO_COM_FOTO }, async (request, reply) => {

    // Extrai os dados do corpo da requisição
    const { nome, dataNascimento, genero, fotoVitima, abrigoId } = request.body
    // Campo vazio vira null — o telefone é único no banco, e "" repetido dava erro
    const cpf      = textoOuNull(request.body.cpf)
    const telefone = textoOuNull(request.body.telefone)

    if (!nome?.trim() || !genero?.trim()) {
      return reply.status(400).send({ mensagem: 'Nome e gênero são obrigatórios.' })
    }

    const nascimento = validarNascimento(dataNascimento)
    if (nascimento.erro) {
      return reply.status(400).send({ mensagem: nascimento.erro })
    }

    const erroTamanho = validarTamanhos([['Nome', nome, LIMITES.nomePessoa], ['CPF', cpf, LIMITES.cpf], ['Telefone', telefone, LIMITES.telefone]])
      ?? validarFormatos({ cpf, telefone })
    if (erroTamanho) {
      return reply.status(400).send({ mensagem: erroTamanho })
    }

    // Verifica se já existe uma vítima com o mesmo CPF
    const vitimaExistente = cpf && await prisma.vitima.findFirst({
      where: { cpf }
    })

    // Se já existir, retorna erro 400
    if (vitimaExistente) {
      return reply.status(400).send({ mensagem: 'CPF já cadastrado.' })
    }

    try {
      // Se veio um abrigoId, verifica se o abrigo existe e tem vaga antes de criar a vítima
      if (abrigoId) {
        const abrigo = await prisma.abrigo.findUnique({
          where: { id_abrigo: Number(abrigoId) }
        })

        if (!abrigo) {
          return reply.status(404).send({ mensagem: 'Abrigo não encontrado.' })
        }

        if (abrigo.capacidadeOcupada >= abrigo.capacidadeTotal) {
          return reply.status(409).send({ mensagem: `Abrigo "${abrigo.nome}" está lotado.` })
        }
      }

      // Cria o vitima primeiro sem foto para gerar o ID
      // O ID é necessário para nomear o arquivo no Storage
      const vitima = await prisma.vitima.create({
        data: {
          nome,
          cpf,
          telefone,
          dataNascimento: nascimento.data,
          genero,
          fotoVitima: null,
          abrigoId:   abrigoId ? Number(abrigoId) : null,
          // Se já cadastrou com abrigo, registra a entrada agora
          dataEntrada: abrigoId ? new Date() : null,
        }
      })

      // Se veio um abrigoId, incrementa a capacidade ocupada
      if (abrigoId) {
        await prisma.abrigo.update({
          where: { id_abrigo: Number(abrigoId) },
          data:  { capacidadeOcupada: { increment: 1 } }
        })
      }

      // Se veio uma foto em base64, faz o upload usando o ID do vitima + timestamp como nome do arquivo
      // O timestamp é necessário para quebrar o cache do CDN do Supabase:
      // Como a URL pública não muda quando o arquivo é sobrescrito, o navegador servia a foto antiga.
      // Agora cada upload gera um nome único (vitima-{id}-{timestamp}.jpg), forçando uma URL nova.
      if (fotoVitima) {
        const buffer = Buffer.from(fotoVitima, 'base64')
        const nomeArquivo = `vitima-${vitima.id_vitima}-${Date.now()}.jpg`

        const { data, error } = await supabase.storage
          .from('fotos-vitima')
          .upload(nomeArquivo, buffer, {
            contentType: 'image/jpeg',
            upsert: false // cada upload tem nome único, não precisa sobrescrever
          })

        if (error) {
          return reply.status(500).send({ mensagem: 'Vitima criado, mas erro ao salvar a foto.' })
        }

        const { data: urlData } = supabase.storage
          .from('fotos-vitima')
          .getPublicUrl(data.path)

        // Atualiza o vitima com a URL pública da foto
        await prisma.vitima.update({
          where: { id_vitima: vitima.id_vitima },
          data: { fotoVitima: urlData.publicUrl }
        })

        vitima.fotoVitima = urlData.publicUrl
      }

      return reply.status(201).send({
        mensagem: 'vitima cadastrado com sucesso!',
        id: vitima.id_vitima,
        nome: vitima.nome,
        cpf: vitima.cpf,
        telefone: vitima.telefone,
        // AAAA-MM-DD em UTC (o formato local perdia 1 dia por causa do fuso)
        dataNascimento: dataParaTexto(vitima.dataNascimento),
        genero: vitima.genero,
        fotoVitima: vitima.fotoVitima,
        abrigoId: vitima.abrigoId,
      })

    } catch (erro) {
      if (erroDuplicado(erro)) {
        return reply.status(400).send({ mensagem: erroDuplicado(erro) })
      }
      console.error('ERRO DETALHADO:', erro)
      return reply.status(500).send({ mensagem: erro.message })
    }
  })

  //----- Listar -----
  //Rota GET para listar todas as vítimas
  //URL http://localhost:3000/api/vitimas/listar
  //URL http://localhost:3000/api/vitimas/listar?nome=João
  app.get('/listar', async (request, reply) => {

    // Filtro opcional por nome
    const { nome, abrigoId } = request.query

    // Busca as vítimas com filtro se fornecido
    const vitimas = await prisma.vitima.findMany({
      where: {
        nome:     nome     ? { contains: nome, mode: 'insensitive' } : undefined,
        // Permite filtrar vítimas por abrigo — útil para listar quem está em um abrigo específico
        abrigoId: abrigoId ? Number(abrigoId)                       : undefined,
      },
      include: {
        abrigo: { select: { nome: true, ...selectLocalizacao } },
        deficiencias: { select: { deficiencia: { select: { nome: true } } } },
      },
      orderBy: { nome: 'asc' }
    })

    // Retorna apenas os campos necessários
    const vitimasListadas = vitimas.map((vitima) => ({
      id:        vitima.id_vitima,
      nome:      vitima.nome,
      cpf:       vitima.cpf,
      telefone:  vitima.telefone,
      genero:    vitima.genero,
      fotoVitima: vitima.fotoVitima,
      // Usados nos filtros da tela de Vítimas (faixa etária, entrada, deficiência)
      dataNascimento: vitima.dataNascimento,
      dataEntrada:    vitima.dataEntrada,
      deficiencias:   vitima.deficiencias.map(d => d.deficiencia.nome),
      // Inclui o abrigo vinculado para exibir na listagem
      abrigoId:  vitima.abrigoId,
      abrigo:    achatarLocalizacao(vitima.abrigo) ?? null,
    }))

    return reply.status(200).send({
      mensagem: 'Lista:',
      vitimas: vitimasListadas
    })
  })

  //----- Listar um só ----- (Importante para o Detalhes-vitima)
  //Método GET para buscar uma vitima específico pelo ID
  //Retorna TODOS os campos — usado pela tela de Detalhes
  //URL: http://localhost:3000/api/vitimas/listar/:id
  app.get('/listar/:id', async (request, reply) => {

    const { id } = request.params

    const vitima = await prisma.vitima.findUnique({
      where: { id_vitima: Number(id) },
      // Inclui os dados do abrigo vinculado para exibir na tela de detalhes
      include: {
        abrigo: { select: { nome: true, endereco: true, telefone: true, ...selectLocalizacao } }
      }
    })

    if (!vitima) {
      return reply.status(404).send({ mensagem: 'Vítima não encontrado.' })
    }

    // O Prisma já retorna todos os campos automaticamente com o findUnique
    // A data vai como AAAA-MM-DD (UTC): é o formato do <input type="date"> e não
    // perde 1 dia por causa do fuso (a tela formata para DD/MM/AAAA ao exibir)
    return reply.status(200).send({
      ...vitima,
      abrigo: achatarLocalizacao(vitima.abrigo),
      dataNascimento: dataParaTexto(vitima.dataNascimento)
    })
  })


  //----- Atualizar -----
  //Rota PUT para atualizar os dados de uma vítima
  //URL http://localhost:3000/api/vitimas/atualizar/:id
  app.put('/atualizar/:id', { bodyLimit: LIMITE_CORPO_COM_FOTO }, async (request, reply) => {
    try {

      // Extrai o ID da URL e os dados do corpo
      const { id } = request.params
      const { nome, dataNascimento, genero, fotoVitima, abrigoId } = request.body
      // Campo vazio vira null (undefined = não veio, mantém o atual)
      const cpf      = textoOuNull(request.body.cpf)
      const telefone = textoOuNull(request.body.telefone)

      // Verifica se a vítima existe
      const vitimaExistente = await prisma.vitima.findUnique({
        where: { id_vitima: Number(id) }
      })

      // Se não existir, retorna erro 404
      if (!vitimaExistente) {
        return reply.status(404).send({ mensagem: 'Vítima não encontrada.' })
      }

      // Validações antes de mexer em foto, abrigo ou banco
      if (nome !== undefined && !nome?.trim()) {
        return reply.status(400).send({ mensagem: 'O nome é obrigatório.' })
      }
      if (genero !== undefined && !genero?.trim()) {
        return reply.status(400).send({ mensagem: 'O gênero é obrigatório.' })
      }

      // Aceita AAAA-MM-DD ou DD/MM/AAAA; se não veio, mantém a data atual
      let novaDataNascimento = undefined
      if (dataNascimento !== undefined) {
        const nascimento = validarNascimento(dataNascimento)
        if (nascimento.erro) {
          return reply.status(400).send({ mensagem: nascimento.erro })
        }
        novaDataNascimento = nascimento.data
      }

      // CPF/telefone só são conferidos se mudaram (cadastros antigos continuam editáveis)
      const erroTamanho = validarTamanhos([['Nome', nome, LIMITES.nomePessoa], ['CPF', cpf, LIMITES.cpf], ['Telefone', telefone, LIMITES.telefone]])
        ?? validarFormatos({ cpf, telefone }, vitimaExistente)
      if (erroTamanho) {
        return reply.status(400).send({ mensagem: erroTamanho })
      }

      // Define a URL da foto que vai ser salva no banco
      // Por padrão mantém a foto atual, mas pode mudar dependendo do que veio no body
      let fotoUrl = vitimaExistente.fotoVitima

      if (fotoVitima === null) {
        // Usuário clicou em "Remover Foto" — apaga do Storage e do banco
        // O nome do arquivo é extraído da URL salva no banco, já que agora o nome tem timestamp
        // Exemplo: "https://...supabase.co/.../vitima-24-1718323200000.jpg" → "vitima-24-1718323200000.jpg"
        if (vitimaExistente.fotoVitima) {
          const nomeArquivo = vitimaExistente.fotoVitima.split('/').pop().split('?')[0]
          await supabase.storage
            .from('fotos-vitima')
            .remove([nomeArquivo])
        }
        fotoUrl = null

      } else if (fotoVitima && !fotoVitima.startsWith('http')) {
        // Veio um novo base64 — apaga a foto anterior e sobe a nova com nome único
        //
        // Antes usávamos upsert com nome fixo (vitima-{id_vitima}.jpg), mas o CDN do Supabase
        // fazia cache da URL e continuava servindo a foto antiga mesmo após o upload.
        // A solução foi:
        //   1. Apagar o arquivo anterior pelo nome extraído da URL do banco
        //   2. Subir o novo com timestamp no nome → URL nova → cache quebrado
        if (vitimaExistente.fotoVitima) {
          const nomeAntigo = vitimaExistente.fotoVitima.split('/').pop().split('?')[0]
          await supabase.storage
            .from('fotos-vitima')
            .remove([nomeAntigo])
        }

        const buffer = Buffer.from(fotoVitima, 'base64')
        const nomeArquivo = `vitima-${id}-${Date.now()}.jpg`

        const { data, error } = await supabase.storage
          .from('fotos-vitima')
          .upload(nomeArquivo, buffer, {
            contentType: 'image/jpeg',
            upsert: false // nome único por timestamp, não precisa sobrescrever
          })

        if (error) {
          return reply.status(500).send({ mensagem: 'Erro ao fazer upload da foto.' })
        }

        const { data: urlData } = supabase.storage
          .from('fotos-vitima')
          .getPublicUrl(data.path)

        fotoUrl = urlData.publicUrl
      }
      // Se fotoVitima vier como uma URL http, não faz nada — mantém a foto atual

      // ── Lógica de abrigo: increment/decrement e dataEntrada ────────────────
      //
      // abrigoId vindo do body pode ser:
      //   - um número  → quer vincular a esse abrigo
      //   - null       → quer desvincular
      //   - undefined  → não veio no body, mantém o atual
      //
      // Normaliza: se não veio no body (undefined), mantém o abrigoId atual da vítima
      const abrigoIdAntigo = vitimaExistente.abrigoId
      const abrigoIdNovo   = abrigoId !== undefined
        ? (abrigoId !== null ? Number(abrigoId) : null)
        : abrigoIdAntigo

      const abrigoMudou = abrigoIdNovo !== abrigoIdAntigo

      // Por padrão mantém a dataEntrada atual
      let dataEntradaFinal = vitimaExistente.dataEntrada

      // Roda tudo dentro de uma transação para garantir consistência:
      // se qualquer etapa falhar (ex: abrigo lotado, telefone repetido),
      // nenhuma alteração é salva — nem a ocupação dos abrigos
      const vitimaAtualizado = await prisma.$transaction(async (tx) => {

        if (abrigoMudou) {
          // 1. Decrementa o abrigo antigo (se a vítima estava em algum)
          if (abrigoIdAntigo) {
            await tx.abrigo.update({
              where: { id_abrigo: abrigoIdAntigo },
              data:  { capacidadeOcupada: { decrement: 1 } }
            })
          }

          // 2. Incrementa o abrigo novo (se estiver indo para algum) e verifica o limite
          if (abrigoIdNovo) {
            const abrigoNovo = await tx.abrigo.findUnique({
              where: { id_abrigo: abrigoIdNovo }
            })

            if (!abrigoNovo) {
              throw new Error('Abrigo de destino não encontrado.')
            }

            // Bloqueia se o abrigo estiver cheio
            if (abrigoNovo.capacidadeOcupada >= abrigoNovo.capacidadeTotal) {
              throw new Error(`Abrigo "${abrigoNovo.nome}" está lotado.`)
            }

            await tx.abrigo.update({
              where: { id_abrigo: abrigoIdNovo },
              data:  { capacidadeOcupada: { increment: 1 } }
            })

            // Registra o momento exato da entrada no novo abrigo
            dataEntradaFinal = new Date()

          } else {
            // Vítima saiu do abrigo sem ir para outro — limpa a dataEntrada
            dataEntradaFinal = null
          }
        }
        // ────────────────────────────────────────────────────────────────────

        return tx.vitima.update({
          where: { id_vitima: Number(id) },
          data: {
            nome,
            cpf,
            telefone,
            dataNascimento: novaDataNascimento,
            genero,
            fotoVitima:  fotoUrl,
            abrigoId:    abrigoIdNovo,
            dataEntrada: dataEntradaFinal, // ← agora é salva/limpa corretamente
          }
        })
      })

      return reply.status(200).send({
        mensagem:       'Informações do vitima atualizadas com sucesso!',
        id:             vitimaAtualizado.id_vitima,
        nome:           vitimaAtualizado.nome,
        cpf:            vitimaAtualizado.cpf,
        telefone:       vitimaAtualizado.telefone,
        dataNascimento: dataParaTexto(vitimaAtualizado.dataNascimento),
        genero:         vitimaAtualizado.genero,
        fotoVitima:     vitimaAtualizado.fotoVitima,
        abrigoId:       vitimaAtualizado.abrigoId,
        dataEntrada:    vitimaAtualizado.dataEntrada,
      })

    } catch (erro) {
      if (erroDuplicado(erro)) {
        return reply.status(400).send({ mensagem: erroDuplicado(erro) })
      }
      console.error('ERRO DETALHADO:', erro)
      // Erro de negócio (lotado, abrigo não encontrado) → 409; outros → 500
      const status = erro.message.includes('lotado') || erro.message.includes('não encontrado') ? 409 : 500
      return reply.status(status).send({ mensagem: erro.message })
    }
  })


  //----- Deletar -----
  //Rota DELETE para excluir uma vítima
  //URL http://localhost:3000/api/vitimas/excluir/:id
  app.delete('/excluir/:id', async (request, reply) => {

    const { id } = request.params

    const vitimaExistente = await prisma.vitima.findUnique({
      where: { id_vitima: Number(id) }
    })

    if (!vitimaExistente) {
      return reply.status(404).send({ mensagem: 'Vitima não encontrado.' })
    }

    try {
      // Tudo numa transação: ou exclui a vítima E libera a vaga no abrigo, ou nada.
      // Antes a vaga era liberada primeiro e, se o delete falhasse (vítima com
      // deficiência cadastrada → chave estrangeira), a ocupação ficava errada.
      await prisma.$transaction(async (tx) => {
        // Remove as ligações com deficiências (só pertencem a esta vítima)
        await tx.vitimaDeficiencia.deleteMany({
          where: { id_vitima: Number(id) }
        })

        await tx.vitima.delete({
          where: { id_vitima: Number(id) }
        })

        // Se a vítima estava em um abrigo, libera a vaga
        if (vitimaExistente.abrigoId) {
          await tx.abrigo.update({
            where: { id_abrigo: vitimaExistente.abrigoId },
            data:  { capacidadeOcupada: { decrement: 1 } }
          })
        }
      })

      // Só apaga a foto do Storage depois que o registro foi excluído de verdade
      // O nome do arquivo é extraído da URL salva no banco, já que agora o nome tem timestamp
      // Exemplo: "https://...supabase.co/.../vitima-24-1718323200000.jpg" → "vitima-24-1718323200000.jpg"
      if (vitimaExistente.fotoVitima) {
        const nomeArquivo = vitimaExistente.fotoVitima.split('/').pop().split('?')[0]
        await supabase.storage
          .from('fotos-vitima')
          .remove([nomeArquivo])
      }

      return reply.status(200).send({ mensagem: 'vitima excluído com sucesso!' })

    } catch (erro) {
      console.error('ERRO DETALHADO:', erro)
      return reply.status(500).send({ mensagem: erro.message })
    }
  })
}