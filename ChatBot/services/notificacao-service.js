// notificacao-service.js
//
// Envia os alertas pelo WhatsApp. A API guarda as notificações numa fila;
// de tempos em tempos o bot reserva algumas, envia uma por uma e informa
// o resultado (enviada ou falha — a API tenta de novo até 3 vezes).
import pkg from "whatsapp-web.js";
import { api } from "./api.js";
import { ehErroDePaginaQuebrada } from "./saude.js";

const { MessageMedia } = pkg;

// Intervalo entre as buscas na fila
const INTERVALO_MS = Number(process.env.NOTIFICACOES_INTERVALO_MS) || 15000;

// Pausa entre uma mensagem e outra — enviar muitas mensagens seguidas pode
// fazer o WhatsApp bloquear o número do bot
const PAUSA_ENTRE_MENSAGENS_MS = Number(process.env.NOTIFICACOES_PAUSA_MS) || 2000;

const LOTE = 20;

const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Muitos contatos chegam com um ID interno do WhatsApp ("123456789@lid") em vez
// do número ("5512999999999@c.us"). Tentamos primeiro o destino salvo (é o mesmo
// que as respostas do bot usam) e, se falhar, o número de telefone equivalente.
const destinosPossiveis = async (client, destino) => {
  // Celular digitado no painel (convite de responsável): pode ser alguém que nunca
  // falou com o bot. Pergunta ao WhatsApp o ID certo desse número (resolve também
  // números antigos sem o 9 da frente) e, se ele não tiver WhatsApp, avisa.
  if (destino.endsWith('@c.us') && typeof client.getNumberId === 'function') {
    const id = await client.getNumberId(destino.split('@')[0]);
    if (!id) throw new Error('Este número não tem WhatsApp.');
    return id._serialized === destino ? [destino] : [id._serialized, destino];
  }

  if (!destino.endsWith('@lid')) return [destino];

  try {
    const [{ pn } = {}] = await client.getContactLidAndPhone([destino]);
    if (pn) return [destino, pn];
  } catch (erro) {
    console.warn(`[NOTIF] Não foi possível converter ${destino} em número:`, erro.message);
  }
  return [destino];
};

// Envia para um destino. Com o whatsapp-web.js 1.34.7 e o WhatsApp Web atual,
// o envio de IMAGEM falha ("Data passed to getter must include an id property"),
// enquanto texto funciona. Por isso: tenta a foto com legenda e, se falhar,
// manda o texto do alerta com o link da foto — o aviso nunca deixa de chegar.
const enviarPara = async (client, destino, notificacao, media) => {
  if (media) {
    try {
      await client.sendMessage(destino, media, { caption: notificacao.mensagem, sendSeen: false });
      return 'foto';
    } catch (erro) {
      console.warn(`[NOTIF] Foto não enviada para ${destino} (${erro.message.split('\n')[0]}), enviando só o texto`);
    }
  }

  const texto = notificacao.fotoUrl
    ? `${notificacao.mensagem}\n\n📷 Foto da ocorrência: ${notificacao.fotoUrl}`
    : notificacao.mensagem;

  await client.sendMessage(destino, texto, { sendSeen: false });
  return 'texto';
};

const enviar = async (client, notificacao) => {
  let media = null;
  if (notificacao.fotoUrl) {
    try {
      media = await MessageMedia.fromUrl(notificacao.fotoUrl, { unsafeMime: true });
    } catch (erro) {
      console.warn('[NOTIF] Não foi possível baixar a foto, enviando só o texto:', erro.message);
    }
  }

  // Tenta cada formato do destino; se todos falharem, repassa o último erro
  // para a notificação ser marcada como falha (e tentada de novo depois)
  let ultimoErro;
  for (const destino of await destinosPossiveis(client, notificacao.destino)) {
    try {
      const formato = await enviarPara(client, destino, notificacao, media);
      if (formato === 'texto' && media) console.log(`[NOTIF] Enviado só o texto (com link da foto) para ${destino}`);
      return;
    } catch (erro) {
      ultimoErro = erro;
      console.warn(`[NOTIF] Falha ao enviar para ${destino}:`, erro.message.split('\n')[0]);
    }
  }
  throw ultimoErro;
};

let iniciado = false;

// aoQuebrar(motivo): chamado quando a página do WhatsApp Web quebrou (o index.js reinicia o bot)
export const iniciarEnvioDeNotificacoes = (client, { aoQuebrar } = {}) => {
  // O evento "ready" pode disparar de novo após reconexão
  if (iniciado) return;
  iniciado = true;

  let processando = false;
  let parado = false; // página quebrada: não envia mais nada até o bot reiniciar

  const ciclo = async () => {
    if (processando || parado) return;
    processando = true;

    try {
      const { ok, status, dados } = await api('POST', '/bot/notificacoes/reservar', { limite: LOTE });

      if (!ok) {
        console.error(`[NOTIF] API recusou a reserva (HTTP ${status}):`, dados.mensagem);
        return;
      }

      for (const notificacao of dados.notificacoes) {
        try {
          await enviar(client, notificacao);
          await api('PATCH', `/bot/notificacoes/${notificacao.id_notificacao}`, { sucesso: true });
          console.log(`[NOTIF] ✓ ${notificacao.evento} → ${notificacao.destino}`);
        } catch (erro) {
          console.error(`[NOTIF] ✗ ${notificacao.destino}:`, erro.message);

          // Página do WhatsApp Web quebrada: a culpa não é do número. Não conta como
          // falha (a notificação volta para a fila em alguns minutos) e o bot reinicia.
          if (ehErroDePaginaQuebrada(erro)) {
            parado = true;
            aoQuebrar?.(erro.message);
            return;
          }

          await api('PATCH', `/bot/notificacoes/${notificacao.id_notificacao}`, { sucesso: false, erro: erro.message });
        }

        await esperar(PAUSA_ENTRE_MENSAGENS_MS);
      }
    } catch (erro) {
      // API fora do ar: tenta de novo no próximo ciclo
      console.error('[NOTIF] Erro ao processar a fila:', erro.message);
    } finally {
      processando = false;
    }
  };

  setInterval(ciclo, INTERVALO_MS);
  ciclo();
  console.log(`[NOTIF] Envio de alertas ativo (verificando a fila a cada ${INTERVALO_MS / 1000}s)`);
};
