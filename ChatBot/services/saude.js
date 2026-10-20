// Erros que indicam que a página do WhatsApp Web (dentro do Chrome que o bot
// controla) quebrou. Com eles nenhuma mensagem sai até o bot ser reiniciado.
// Ex: "Attempted to use detached Frame '...'" quando o WhatsApp Web recarrega.
const PAGINA_QUEBRADA = /detached Frame|Target closed|Session closed|Execution context was destroyed|Protocol error/i;

export const ehErroDePaginaQuebrada = (erro) => PAGINA_QUEBRADA.test(String(erro?.message ?? erro ?? ''));
