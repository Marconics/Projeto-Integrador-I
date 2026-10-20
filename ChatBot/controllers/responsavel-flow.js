// responsavel-flow.js
//
// Responsável de abrigo vinculando o próprio WhatsApp. Funciona em qualquer
// etapa da conversa (como as saudações), porque a pessoa pode receber o
// convite no meio de outro atendimento:
//   - "aceitar" / "recusar"  → resposta ao convite que o bot enviou;
//   - "vincular 123456"      → código do link que a equipe repassou;
//   - "sair voluntario"      → voluntário do abrigo deixa de receber os pedidos de ajuda.
// Quem decide se há convite é a API; o número sai daqui (msg.from), por isso
// o vínculo comprova que a pessoa tem o WhatsApp.
import { userState } from "../state/state.js";
import { api } from "../services/api.js";
import { numeroReal } from "../services/telefone.js";
import { titulo, RODAPE_MENU } from "../utils/formato.js";

const VINCULAR = /^vincular\s*([\d\s.-]+)$/;
const SAIR_VOLUNTARIO = /^sair\s+(d[ae]\s+)?voluntari[oa]$/;  // "sair voluntario", "sair de voluntária"...

// Nome que a pessoa usa no WhatsApp (só se o convite não trouxer o nome)
const nomeDoContato = async (msg) => {
    try {
        const contato = await msg.getContact();
        return contato?.pushname || contato?.name || null;
    } catch {
        return null;
    }
};

const dadosDaPessoa = async (msg) => ({
    whatsappId: msg.from,
    telefone: await numeroReal(msg.client, msg.from),
    nome: await nomeDoContato(msg),
});

const responder = async (msg, caminho, corpo) => {
    try {
        const { ok, status, dados } = await api('POST', caminho, corpo);
        if (ok) {
            await msg.reply(dados.recusado
                ? `👍 *Tudo bem!* Você não vai receber os avisos do abrigo.\n\n${RODAPE_MENU}`
                : `${dados.mensagem}\n\n${RODAPE_MENU}`);
            return;
        }
        // 404 = sem convite / código errado; 429 = muitas tentativas
        await msg.reply(`${status === 404 || status === 429 ? '⚠️' : '❌'} ${dados.mensagem ?? 'Não foi possível concluir agora.'}\n\n${RODAPE_MENU}`);
    } catch (erro) {
        console.error('[RESPONSAVEL] Erro ao falar com a API:', erro.message);
        await msg.reply(`❌ Falha na conexão com o servidor. Tente novamente mais tarde.\n\n${RODAPE_MENU}`);
    }
};

// Devolve true se a mensagem era um desses comandos (e já respondeu)
export const tratarComandoResponsavel = async (msg, from, text) => {
    const vincular = text.match(VINCULAR);

    if (vincular) {
        const codigo = vincular[1].replace(/\D/g, '');
        if (codigo.length !== 6) {
            await msg.reply(`${titulo('🏠', 'VINCULAR ABRIGO')}\n\n⚠️ O código tem *6 números*.\n\n💡 Ex: *vincular 123456*`);
            return true;
        }
        userState.delete(from);
        await responder(msg, '/bot/responsaveis/vincular', { ...(await dadosDaPessoa(msg)), codigo });
        return true;
    }

    if (text === 'aceitar' || text === 'recusar') {
        userState.delete(from);
        await responder(msg, '/bot/responsaveis/responder', { ...(await dadosDaPessoa(msg)), resposta: text });
        return true;
    }

    // Voluntário do abrigo pelo WhatsApp deixa de receber os pedidos de ajuda
    if (SAIR_VOLUNTARIO.test(text)) {
        userState.delete(from);
        await responder(msg, '/bot/voluntarios/sair', { whatsappId: from });
        return true;
    }

    return false;
};
