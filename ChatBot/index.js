import "dotenv/config";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import { handleMessage } from "./controllers/message-controller.js";
import { iniciarEnvioDeNotificacoes } from "./services/notificacao-service.js";
import { corrigirTelefonesDosInscritos } from "./services/telefone.js";
import { ehErroDePaginaQuebrada } from "./services/saude.js";

const { Client, LocalAuth } = pkg;

if (!process.env.BOT_API_KEY) {
    console.warn("⚠️  BOT_API_KEY não definida no .env — o sistema de alertas não vai funcionar.");
}

// Quando o bot ligou. Ao reconectar, o WhatsApp entrega as mensagens que chegaram
// com o bot desligado; as muito antigas são ignoradas para o bot não responder
// "oi" de dias atrás (quem escreveu durante uma religada rápida é respondido).
const LIGADO_EM = Date.now();
const IGNORAR_ANTES_MS = 2 * 60 * 1000;

const client = new Client({
    authStrategy: new LocalAuth()
});


// ─── Saída controlada ─────────────────────────────────────────────
// Se a página do WhatsApp Web quebrar (ela recarrega sozinha às vezes e o bot
// fica preso na página antiga: "detached Frame"), o bot encerra. Rodando com
// "npm run bot", o vigia (scripts/manter-ligado.mjs) liga de novo em seguida.
let saindo = false;
const sairParaReiniciar = async (motivo) => {
    if (saindo) return;
    saindo = true;
    console.error(`[BOT] Reiniciando: ${motivo}`);
    try {
        await Promise.race([client.destroy(), new Promise(r => setTimeout(r, 10000))]);
    } catch {
        // o navegador já pode estar fechado
    }
    process.exit(1);
};


client.on("qr", (qr) => {
    console.log("Escaneie o QR Code:");
    qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
    console.log("Bot conectado!");
    // Começa a enviar os alertas que estão na fila da API
    iniciarEnvioDeNotificacoes(client, { aoQuebrar: sairParaReiniciar });
    // Corrige inscritos que ficaram com o código interno do WhatsApp no lugar do telefone
    corrigirTelefonesDosInscritos(client);
    // Confere de tempos em tempos se a página do WhatsApp continua respondendo
    iniciarVerificacaoDeSaude();
});

client.on("disconnected", (motivo) => {
    sairParaReiniciar(`WhatsApp desconectou (${motivo})`);
});

client.on("message", async (msg) => {
    // Mensagem antiga, entregue só agora porque o bot estava desligado
    if (msg.timestamp && msg.timestamp * 1000 < LIGADO_EM - IGNORAR_ANTES_MS) return;

    try {
        await handleMessage(msg, client);
    } catch (erro) {
        // Um erro numa conversa não pode derrubar o bot...
        console.error("[BOT] Erro ao processar mensagem:", erro);
        // ...a não ser que a página do WhatsApp tenha quebrado
        if (ehErroDePaginaQuebrada(erro)) sairParaReiniciar(erro.message);
    }
});


// ─── Verificação de saúde ─────────────────────────────────────────
// A cada minuto pergunta o estado ao WhatsApp Web. Duas falhas seguidas
// (erro, demora de mais de 20s ou estado diferente de CONNECTED) → reinicia.
const INTERVALO_SAUDE_MS = 60 * 1000;
let falhasSeguidas = 0;
let saudeIniciada = false;

function iniciarVerificacaoDeSaude() {
    if (saudeIniciada) return; // o "ready" pode disparar de novo
    saudeIniciada = true;

    setInterval(async () => {
        try {
            const estado = await Promise.race([
                client.getState(),
                new Promise((_, falhar) => setTimeout(() => falhar(new Error('sem resposta em 20s')), 20000)),
            ]);
            if (estado !== 'CONNECTED') throw new Error(`estado ${estado}`);
            falhasSeguidas = 0;
        } catch (erro) {
            falhasSeguidas++;
            console.warn(`[SAÚDE] WhatsApp Web não respondeu (${falhasSeguidas}/2): ${erro.message}`);
            if (falhasSeguidas >= 2) sairParaReiniciar(`verificação de saúde falhou: ${erro.message}`);
        }
    }, INTERVALO_SAUDE_MS);
}

client.initialize();
