// solicitacao-flow.js
import { userState } from "../state/state.js";
import { api } from "../services/api.js";
import { baixarFoto } from "../services/midia.js";
import { titulo, listaNumerada, opcao, SEPARADOR, RODAPE_OPCAO, RODAPE_MENU, RODAPE_CANCELAR } from "../utils/formato.js";

// ── Busca as cidades cadastradas na API ────────────────────────
const buscarCidades = async () => {
  try {
    const { ok, dados } = await api('GET', '/cidades/listar');
    if (!ok) throw new Error(dados.mensagem);
    return dados.cidades.map(c => ({ id_cidade: c.id_cidade, nome: c.nome, estado: c.estado }));
  } catch (erro) {
    console.error('[SOL] Erro ao buscar cidades:', erro);
    return [];
  }
};

// ── Busca os bairros de uma cidade ─────────────────────────────
const buscarBairros = async (cidadeId) => {
  try {
    const { ok, dados } = await api('GET', `/bairros/listar?cidadeId=${cidadeId}`);
    if (!ok) throw new Error(dados.mensagem);
    return dados.bairros.map(b => ({ id_bairro: b.id_bairro, nome: b.nome }));
  } catch (erro) {
    console.error('[SOL] Erro ao buscar bairros:', erro);
    return [];
  }
};

// valor = o que é salvo no banco (não mudar) | label = o que aparece para a pessoa
const TIPOS_ABRIGO = [
  { valor: 'Escola',            label: '🏫 Escola' },
  { valor: 'Ginásio',           label: '🏟️ Ginásio' },
  { valor: 'Igreja',            label: '⛪ Igreja' },
  { valor: 'Hotel',             label: '🏨 Hotel' },
  { valor: 'Pousada',           label: '🛏️ Pousada' },
  { valor: 'CentroCultural',    label: '🎭 Centro cultural' },
  { valor: 'CentroComunitário', label: '🏘️ Centro comunitário' },
  { valor: 'Campo',             label: '⛺ Campo' },
];

// Estrutura do local (os mesmos campos do cadastro de abrigo no painel)
const ESTRUTURAS = [
  { campo: 'possuiAtendimentoMedico', label: '🩺 Atendimento médico' },
  { campo: 'possuiEnfermagem',        label: '💉 Enfermagem' },
  { campo: 'possuiPets',              label: '🐾 Aceita pets' },
  { campo: 'possuiAcessibilidade',    label: '♿ Acessibilidade' },
  { campo: 'possuiCozinha',           label: '🍳 Cozinha' },
];

// ── Pergunta o tipo do abrigo (depois da cidade/bairro) ────────
const perguntarTipo = async (msg, from, state) => {
  userState.set(from, { ...state, step: 'sol_tipo' });

  await msg.reply(`🏷️ Qual o *tipo* do local?\n\n${listaNumerada(TIPOS_ABRIGO, t => t.label)}\n\n${RODAPE_OPCAO}`);
  return true;
};

// ── Função principal ───────────────────────────────────────────
export const solicitacaoFlow = async (msg, from, text, state) => {

  if (!state?.step?.startsWith('sol_')) return false;

  // ── ETAPA 1: Nome do abrigo ──────────────────────────────────
  if (state.step === 'sol_nome') {
    state.tempData.nome = msg.body.trim();
    userState.set(from, { ...state, step: 'sol_cep' });
    await msg.reply(`📮 Qual o *CEP* do local?\n\n_Ex: 12030-000_\n\n${RODAPE_CANCELAR}`);
    return true;
  }

  // ── ETAPA 2: CEP ─────────────────────────────────────────────
  // O CEP já define cidade e bairro — a pessoa não precisa escolher em listas
  if (state.step === 'sol_cep') {
    const cep = msg.body.replace(/\D/g, '');

    if (cep.length !== 8) {
      await msg.reply('❌ O CEP deve ter *8 números*.\n\n💡 Ex: 12030-000');
      return true;
    }

    state.tempData.cep = cep.replace(/^(\d{5})(\d{3})$/, '$1-$2');

    try {
      const consulta = await api('GET', `/bairros/cep/${cep}`);

      if (consulta.status === 404) {
        await msg.reply('❌ CEP não encontrado.\n\n💡 Confira e digite novamente.');
        return true;
      }

      if (consulta.ok) {
        const dados = consulta.dados;

        // Encontra ou cadastra o bairro (e a cidade, se for nova)
        if (dados.bairro) {
          const bairro = await api('POST', '/bot/bairros/cep', { cep });
          if (bairro.ok) {
            state.tempData.cidadeId = bairro.dados.bairro.cidadeId;
            state.tempData.cidade = bairro.dados.bairro.cidade;
            state.tempData.estado = bairro.dados.bairro.estado;
            state.tempData.bairroId = bairro.dados.bairro.id_bairro;
            state.tempData.bairro = bairro.dados.bairro.nome;
          }
        } else if (dados.cidadeId) {
          // CEP sem bairro (cidades pequenas): fica só com a cidade
          state.tempData.cidadeId = dados.cidadeId;
          state.tempData.cidade = dados.cidade;
          state.tempData.estado = dados.uf;
        }

        state.tempData._logradouro = dados.logradouro;
      }
    } catch (erro) {
      console.error('[SOL] Erro ao consultar CEP:', erro.message);
    }

    userState.set(from, { ...state, step: 'sol_endereco' });

    const d = state.tempData;
    const local = d.cidadeId
      ? `📍 ${[d.bairro, `${d.cidade}/${d.estado}`].filter(Boolean).join(' — ')}\n\n`
      : '';
    const exemplo = d._logradouro ? `${d._logradouro}, 123` : 'Rua das Flores, 123';
    await msg.reply(`${local}🏠 Qual o *endereço*, com o número?\n\n_Ex: ${exemplo}_`);
    return true;
  }

  // ── ETAPA 3: Endereço ─────────────────────────────────────────
  if (state.step === 'sol_endereco') {
    state.tempData.endereco = msg.body.trim();
    delete state.tempData._logradouro;

    // Cidade já veio do CEP: pula a escolha de cidade e bairro
    if (state.tempData.cidadeId) {
      return perguntarTipo(msg, from, state);
    }

    // CEP de cidade ainda não cadastrada: escolhe a cidade na lista
    const cidades = await buscarCidades();
    if (cidades.length === 0) {
      await msg.reply(`❌ Não consegui carregar as cidades. Tente novamente mais tarde.\n\n${RODAPE_MENU}`);
      userState.delete(from);
      return true;
    }

    state.tempData._cidades = cidades;
    userState.set(from, { ...state, step: 'sol_cidade' });

    await msg.reply(`🌆 Qual a *cidade*?\n\n${listaNumerada(cidades, c => `${c.nome}/${c.estado}`)}\n\n${RODAPE_OPCAO}`);
    return true;
  }

  // ── ETAPA 4: Cidade ───────────────────────────────────────────
  if (state.step === 'sol_cidade') {
    const cidades = state.tempData._cidades;
    const indice = parseInt(text) - 1;

    if (isNaN(indice) || !cidades[indice]) {
      await msg.reply(`❌ Digite um número de *1 a ${cidades.length}*.`);
      return true;
    }

    const cidade = cidades[indice];
    state.tempData.cidadeId = cidade.id_cidade;
    state.tempData.cidade = cidade.nome;
    state.tempData.estado = cidade.estado;
    state.tempData.bairroId = null;
    state.tempData.bairro = null;
    delete state.tempData._cidades;

    const bairros = await buscarBairros(cidade.id_cidade);

    // Sem bairros cadastrados na cidade: segue sem bairro
    if (bairros.length === 0) {
      return perguntarTipo(msg, from, state);
    }

    state.tempData._bairros = bairros;
    userState.set(from, { ...state, step: 'sol_bairro' });

    await msg.reply(
`🏘️ Qual o *bairro*?

${listaNumerada(bairros, b => b.nome)}
${opcao(0, '🤷 Não sei / não está na lista')}

${RODAPE_OPCAO}`
    );
    return true;
  }

  // ── ETAPA 4b: Bairro (opcional) ───────────────────────────────
  if (state.step === 'sol_bairro') {
    const bairros = state.tempData._bairros;
    const indice = parseInt(text) - 1;

    if (text !== '0' && (isNaN(indice) || !bairros[indice])) {
      await msg.reply(`❌ Digite um número de *1 a ${bairros.length}*, ou *0* para pular.`);
      return true;
    }

    if (text !== '0') {
      state.tempData.bairroId = bairros[indice].id_bairro;
      state.tempData.bairro = bairros[indice].nome;
    }
    delete state.tempData._bairros;

    return perguntarTipo(msg, from, state);
  }

  // ── ETAPA 5: Tipo ─────────────────────────────────────────────
  if (state.step === 'sol_tipo') {
    const tipo = TIPOS_ABRIGO[parseInt(text) - 1];

    if (!tipo) {
      await msg.reply(`❌ Digite um número de *1 a ${TIPOS_ABRIGO.length}*.`);
      return true;
    }

    state.tempData.tipoAbrigo = tipo.valor;
    userState.set(from, { ...state, step: 'sol_capacidade' });
    await msg.reply('👥 Quantas *pessoas* o local comporta?\n\n_Digite apenas o número. Ex: 100_');
    return true;
  }

  // ── ETAPA 6: Capacidade ───────────────────────────────────────
  if (state.step === 'sol_capacidade') {
    const capacidade = parseInt(msg.body.trim());

    if (isNaN(capacidade) || capacidade <= 0) {
      await msg.reply('❌ Digite um número válido.\n\n💡 Ex: 100');
      return true;
    }

    state.tempData.capacidadeTotal = capacidade;
    userState.set(from, { ...state, step: 'sol_estrutura' });
    await msg.reply(
`🏗️ O que o local *tem*?

${listaNumerada(ESTRUTURAS.map(e => e.label))}
${opcao(0, '➖ Nenhuma dessas')}

💬 Digite os *números* separados por vírgula.
_Ex: 1, 3, 5_`
    );
    return true;
  }

  // ── ETAPA 6b: Estrutura (infraestrutura do local) ─────────────
  // Antes o bot não perguntava e todo abrigo indicado pelo WhatsApp
  // nascia com a infraestrutura toda desmarcada
  if (state.step === 'sol_estrutura') {
    const numeros = [...new Set(text.split(/[\s,;e]+/).filter(Boolean).map(Number))];
    const validos = numeros.every(n => Number.isInteger(n) && n >= 0 && n <= ESTRUTURAS.length);

    if (numeros.length === 0 || !validos || (numeros.includes(0) && numeros.length > 1)) {
      await msg.reply(`❌ Digite os números de *1 a ${ESTRUTURAS.length}* separados por vírgula, ou *0* se não tiver nenhuma.\n\n💡 Ex: 1, 3, 5`);
      return true;
    }

    ESTRUTURAS.forEach((e, i) => { state.tempData[e.campo] = numeros.includes(i + 1); });
    userState.set(from, { ...state, step: 'sol_responsavel' });
    await msg.reply('👤 Qual o nome do *responsável* pelo local?');
    return true;
  }

  // ── ETAPA 7: Responsável ──────────────────────────────────────
  if (state.step === 'sol_responsavel') {
    state.tempData.responsavel = msg.body.trim();
    userState.set(from, { ...state, step: 'sol_telefone' });
    await msg.reply('📞 Qual o *telefone* do local?\n\n➡️ Não tem? Digite *-* para pular.');
    return true;
  }

  // ── ETAPA 8: Telefone ─────────────────────────────────────────
  if (state.step === 'sol_telefone') {
    const tel = msg.body.trim();
    state.tempData.telefone = tel === '-' ? null : tel;
    userState.set(from, { ...state, step: 'sol_sol_nome' });
    await msg.reply(`${titulo('🙋', 'SEUS DADOS')}\n\nAgora preciso dos seus dados como *solicitante*.\n\n👤 Qual o seu *nome completo*?`);
    return true;
  }

  // ── ETAPA 9: Nome do solicitante ──────────────────────────────
  if (state.step === 'sol_sol_nome') {
    state.tempData.solicitanteNome = msg.body.trim();
    userState.set(from, { ...state, step: 'sol_sol_email' });
    await msg.reply('📧 Qual o seu *e-mail*?');
    return true;
  }

  // ── ETAPA 10: Email do solicitante ────────────────────────────
  if (state.step === 'sol_sol_email') {
    state.tempData.solicitanteEmail = msg.body.trim();
    userState.set(from, { ...state, step: 'sol_sol_telefone' });
    await msg.reply('📱 Qual o seu *telefone*?\n\n➡️ Prefere não informar? Digite *-* para pular.');
    return true;
  }

  // ── ETAPA 11: Telefone do solicitante ─────────────────────────
  if (state.step === 'sol_sol_telefone') {
    const tel = msg.body.trim();
    state.tempData.solicitanteTelefone = tel === '-' ? null : tel;
    userState.set(from, { ...state, step: 'sol_dono' });

    await msg.reply(
`🏠 Você é o *responsável (dono)* por este local?

${listaNumerada(['✅ Sim, sou o responsável', '➖ Não, só estou indicando'])}

${RODAPE_OPCAO}`
    );
    return true;
  }

  // ── ETAPA 11b: É o responsável pelo local? ────────────────────
  // Quem só indicou o local NÃO vira responsável: pode se oferecer como voluntário
  if (state.step === 'sol_dono') {
    if (text !== '1' && text !== '2') {
      await msg.reply(`💬 Digite *1* se você é o responsável pelo local ou *2* se só está indicando.`);
      return true;
    }
    state.tempData.solicitanteEhResponsavel = text === '1';

    if (text === '1') {
      userState.set(from, { ...state, step: 'sol_avisos' });
      await msg.reply(
`🔔 Se o local for *aprovado*, quer receber os avisos do abrigo *neste WhatsApp*?
_(voluntários interessados em ajudar, avisos da equipe)_

${listaNumerada(['✅ Sim, quero receber', '➖ Não'])}

${RODAPE_OPCAO}`
      );
    } else {
      userState.set(from, { ...state, step: 'sol_voluntario' });
      await msg.reply(
`🙋 Gostaria de se *voluntariar* neste abrigo?

Se o local for *aprovado*, você recebe *neste WhatsApp* os pedidos de ajuda do abrigo (doações, medicamentos, mão de obra).

${listaNumerada(['✅ Sim, quero ajudar', '➖ Não'])}

${RODAPE_OPCAO}`
      );
    }
    return true;
  }

  // ── ETAPA 11c: Avisos (responsável) ou voluntariado (não responsável) ──
  // - sol_avisos: se aprovada, o bot pergunta de novo (ACEITAR) antes de
  //   começar a mandar os avisos do abrigo
  // - sol_voluntario: se aprovada, a pessoa entra na lista de voluntários
  //   do abrigo e recebe os pedidos de ajuda
  if (state.step === 'sol_avisos' || state.step === 'sol_voluntario') {
    if (text !== '1' && text !== '2') {
      await msg.reply(`💬 Digite *1* para sim ou *2* para não.`);
      return true;
    }
    if (state.step === 'sol_avisos') {
      state.tempData.aceitaAvisosWhatsapp = text === '1';
    } else {
      state.tempData.querVoluntariar = text === '1';
    }
    // O WhatsApp só vai junto se a pessoa quis receber alguma coisa nele
    state.tempData.solicitanteWhatsappId = text === '1' ? from : null;
    userState.set(from, { ...state, step: 'sol_foto' });

    await msg.reply(
`📷 Quer enviar uma *foto* do local?

• Envie a imagem normalmente pelo WhatsApp
• Ou como *documento* (mais confiável)

➡️ Sem foto? Digite *pular*.`
    );
    return true;
  }

  // ── ETAPA 12: Foto (opcional) ─────────────────────────────────
  if (state.step === 'sol_foto') {

    let fotoBase64 = null;

    if (text === 'pular') {
      // segue sem foto

    } else if (msg.hasMedia) {

      // Tenta via downloadMedia e, se falhar, baixa e descriptografa manualmente
      try {
        fotoBase64 = (await baixarFoto(msg, '[SOL]')).data;
      } catch (erroFetch) {
        console.error('[SOL] Não foi possível baixar a foto:', erroFetch.message);
        await msg.reply(
`⚠️ Não consegui baixar a imagem.

💡 Tente enviar como *documento*:
Clipe 📎 → Documento → selecione a foto

➡️ Ou digite *pular* para continuar sem foto.`
        );
        return true;
      }

    } else {
      await msg.reply('📷 Envie uma imagem, um documento ou digite *pular* para continuar sem foto.');
      return true;
    }

    state.tempData.fotoAbrigo = fotoBase64;
    userState.set(from, { ...state, step: 'sol_confirmar' });

    const d = state.tempData;
    const tipo = TIPOS_ABRIGO.find(t => t.valor === d.tipoAbrigo)?.label ?? d.tipoAbrigo;
    await msg.reply(
`${titulo('📋', 'CONFIRA A SOLICITAÇÃO')}

*🏠 Local*
🏷️ Nome: ${d.nome}
${tipo}
👥 Capacidade: ${d.capacidadeTotal} pessoas
🏗️ Estrutura: ${ESTRUTURAS.filter(e => d[e.campo]).map(e => e.label).join(', ') || 'nenhuma'}
📮 CEP: ${d.cep}
📍 Endereço: ${d.endereco}
🌆 Cidade: ${d.cidade}/${d.estado}
🏘️ Bairro: ${d.bairro ?? '-'}
👤 Responsável: ${d.responsavel}
📞 Telefone: ${d.telefone ?? '-'}
📷 Foto: ${fotoBase64 ? '✅ enviada' : '➖ sem foto'}

*🙋 Solicitante*
👤 ${d.solicitanteNome}
📧 ${d.solicitanteEmail}
📱 ${d.solicitanteTelefone ?? '-'}
🏠 Responsável pelo local: ${d.solicitanteEhResponsavel ? '✅ sim' : '➖ não'}
${d.solicitanteEhResponsavel
  ? `🔔 Avisos do abrigo neste WhatsApp: ${d.aceitaAvisosWhatsapp ? '✅ sim' : '➖ não'}`
  : `🙋 Voluntário do abrigo: ${d.querVoluntariar ? '✅ sim' : '➖ não'}`}

${SEPARADOR}
✅ Digite *confirmar* para enviar
❌ ou *cancelar* para desistir.`
    );
    return true;
  }

  // ── ETAPA 13: Confirmar ───────────────────────────────────────
  if (state.step === 'sol_confirmar') {

    if (text === 'cancelar') {
      userState.delete(from);
      await msg.reply(`❌ *Solicitação cancelada.*\n\n${RODAPE_MENU}`);
      return true;
    }

    if (text !== 'confirmar') {
      await msg.reply('💬 Digite *confirmar* para enviar ou *cancelar* para desistir.');
      return true;
    }

    try {
      const { ok, dados: resultado } = await api('POST', '/solicitacoes/criar', state.tempData);

      if (ok) {
        await msg.reply(
`${titulo('✅', 'SOLICITAÇÃO ENVIADA')}

📨 Seu pedido foi registrado e será analisado pela equipe do S.O.S Vale.
Aguarde o nosso contato. 🙏

${RODAPE_MENU}`
        );
      } else {
        await msg.reply(`❌ Erro ao enviar: ${resultado.mensagem}\n\n💡 Digite *oi* para recomeçar.`);
      }

    } catch (erro) {
      console.error('[SOL] Erro ao enviar solicitação:', erro);
      await msg.reply(`❌ Falha na conexão com o servidor. Tente novamente mais tarde.\n\n${RODAPE_MENU}`);
    }

    userState.delete(from);
    return true;
  }

  return false;
};
