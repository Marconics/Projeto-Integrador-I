// Linha de retorno abaixo de um campo (busca de CEP, localização no mapa...)
// feedback = { tipo: 'sucesso' | 'aviso' | 'erro' | 'buscando', mensagem } ou null
const cores = {
  sucesso:  'var(--sv-ok)',
  aviso:    'var(--sv-atencao-forte)',
  erro:     'var(--sv-sirene)',
  buscando: 'var(--sv-tinta-2)',
}

function MensagemFeedback({ feedback }) {
  if (!feedback) return null

  return (
    <p style={{ fontSize: '12px', marginTop: '4px', color: cores[feedback.tipo] ?? cores.buscando }}>
      {feedback.mensagem}
    </p>
  )
}

export default MensagemFeedback;
