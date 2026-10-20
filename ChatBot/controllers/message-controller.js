import { userState } from "../state/state.js";
import { api } from "../services/api.js";

import { apoioFlow } from "./apoio-flow.js";
import { psicologicoFlow } from "./psicologico-flow.js";
import { solicitacaoFlow } from "./solicitacao-flow.js";
import { alertaFlow, abrirMenuAlertas, mostrarAlertasAtivos } from "./alerta-flow.js";
import { handleGrupo } from "./grupo-controller.js";
import { tratarComandoResponsavel } from "./responsavel-flow.js";
import { enviarMenuPrincipal, MENSAGEM_MENU } from "./menu.js";
import { titulo, listaNumerada, SEPARADOR, RODAPE_MENU, RODAPE_CANCELAR, ehSaudacao } from "../utils/formato.js";

export const handleMessage = async (msg, client) => {

    const from = msg.from;

    // Ignora os "status" do WhatsApp
    if (from === 'status@broadcast') return;

    // Em grupos, o bot só responde aos comandos "!alertas"
    if (from.endsWith('@g.us')) {
        await handleGrupo(msg);
        return;
    }

    // minusculo + sem acento (resolve "olá", "OLA", "ólá" etc)
    const text = (msg.body ?? '')
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');

    // ============================================
    // MENU PRINCIPAL
    // Vem antes dos fluxos para que "menu" nunca seja
    // interpretado como resposta de uma pergunta.
    // Aceita "oi", "Oiii!", "olá", "OLAA", "bom dia", "menu"...
    // ============================================

    if (ehSaudacao(text)) {
        userState.delete(from);
        await enviarMenuPrincipal(msg);
        return;
    }

    // Responsável de abrigo: "aceitar", "recusar" e "vincular 123456"; voluntário: "sair voluntario"
    // valem em qualquer etapa (o convite pode chegar no meio de outro fluxo)
    if (await tratarComandoResponsavel(msg, from, text)) return;

    let state = userState.get(from);

    // ============================================
    // FLUXOS EXTERNOS
    // ============================================

    if (state) {
        // "cancelar" desiste de qualquer fluxo em andamento
        if (text === 'cancelar') {
            userState.delete(from);
            await msg.reply(`✋ *Operação cancelada.*\n\n${RODAPE_MENU}`);
            return;
        }

        if (await alertaFlow(msg, from, text, state)) return;
        if (await apoioFlow(msg, from, text, state)) return;
        if (await psicologicoFlow(msg, from, text, state)) return;
        if (await solicitacaoFlow(msg, from, text, state)) return;
    }

    // ============================================
    // OPCOES DO MENU
    // ============================================

    switch (text) {

        case "1":
            await abrirMenuAlertas(msg, from);
            break;

        case "2":
            await msg.reply(
`${titulo('🆘', 'SOLICITAR APOIO')}

Vou registrar o seu pedido em 4 passos rápidos. 📝

📍 *Passo 1 de 4* — Qual o seu *endereço completo*?

_Ex: Rua das Flores, 123 - Centro_

${RODAPE_MENU}`
            );
            userState.set(from, { step: 'help_address', tempData: {} });
            break;

        case "3": {
            try {
                const { ok, dados } = await api('GET', '/abrigos/listar?status=ativo');
                if (!ok) throw new Error(dados.mensagem);

                // Os 5 abrigos ativos cadastrados mais recentemente
                const abrigos = [...dados.abrigos]
                    .sort((a, b) => b.id - a.id)
                    .slice(0, 5);

                if (abrigos.length === 0) {
                    await msg.reply(
`${titulo('🏠', 'ABRIGOS DISPONÍVEIS')}

😕 Nenhum abrigo disponível no momento.

☎️ Ligue para a *Defesa Civil: 199*

${RODAPE_MENU}`
                    );
                    break;
                }

                const lista = abrigos.map(a => {
                    const vagas = a.capacidadeTotal - a.capacidadeOcupada;
                    const vagasTexto = vagas > 0 ? `🟢 *${vagas}* vaga(s) disponível(is)` : `🔴 Sem vagas`;
                    const local = a.bairro ? `${a.bairro}, ${a.cidade}` : a.cidade;
                    return [
                        `🏠 *${a.nome}*`,
                        `📍 ${a.endereco} — ${local}`,
                        vagasTexto,
                        a.telefone ? `📞 ${a.telefone}` : null,
                    ].filter(Boolean).join('\n');
                }).join(`\n\n`);

                await msg.reply(
`${titulo('🏠', 'ABRIGOS DISPONÍVEIS')}

${lista}

${SEPARADOR}
🚨 Em emergência ligue *193* (Bombeiros) ou *199* (Defesa Civil).
${RODAPE_MENU}`
                );

            } catch (err) {
                console.error("[API] Erro ao buscar abrigos:", err);
                await msg.reply(
`❌ Não foi possível carregar os abrigos agora.

☎️ Ligue para a *Defesa Civil: 199*

${RODAPE_MENU}`
                );
            }
            break;
        }

        case "4":
            await msg.reply(
`${titulo('💙', 'APOIO PSICOLÓGICO')}

Você não está sozinho(a). 🤝
Conte pra gente o que você precisa:

${listaNumerada([
    '🗣️ Quero conversar com alguém',
    '😰 Ansiedade',
    '👨‍👩‍👧 Apoio familiar',
    '💔 Crise emocional',
    '💭 Desabafar',
    '📝 Outro motivo',
])}

📞 Precisa falar agora? *CVV — 188* (24h, gratuito)

${RODAPE_MENU}`
            );
            userState.set(from, { step: 'psycho_need', tempData: {} });
            break;

        case "5":
            await mostrarAlertasAtivos(msg, from);
            break;

        case "6":
            await msg.reply(
`${titulo('☎️', 'TELEFONES DE EMERGÊNCIA')}

🚒 *193* — Bombeiros
🚑 *192* — SAMU
🚓 *190* — Polícia Militar
🏛️ *199* — Defesa Civil
💙 *188* — CVV (apoio emocional)

📲 As ligações são *gratuitas* e funcionam 24h.

${RODAPE_MENU}`
            );
            break;

        case "7":
            await msg.reply(
`${titulo('🏫', 'INDICAR LOCAL PARA ABRIGO')}

Conhece um local que pode servir de abrigo em emergências? 🙌
Vou coletar os dados e a equipe do S.O.S Vale vai analisar.

🏷️ Qual o *nome* do local?

${RODAPE_CANCELAR}`
            );
            userState.set(from, { step: 'sol_nome', tempData: {} });
            break;

        case "8":
            await msg.reply(
`👋 *Atendimento encerrado.*

Obrigado por usar o S.O.S Vale! 💙
Cuide-se e fique em segurança.

💬 Mande um *oi* quando precisar.`
            );
            userState.delete(from);
            break;

        default:
            // Mensagem que não é opção do menu: mostra o menu de novo
            await msg.reply(`🤔 Não entendi.\n\n${MENSAGEM_MENU}`);
    }
};
