// Pedidos de ajuda (SolicitacaoAjuda): rótulos e etiquetas (sv-tag) usados nas
// telas de Detalhes do abrigo e de Pedidos de ajuda do abrigo.

export const URGENCIAS = {
  critica: { label: 'Crítica', classe: 'sv-tag--sirene',  peso: 4 },
  alta:    { label: 'Alta',    classe: 'sv-tag--atencao', peso: 3 },
  media:   { label: 'Média',   classe: 'sv-tag--azul',    peso: 2 },
  baixa:   { label: 'Baixa',   classe: 'sv-tag--neutro',  peso: 1 },
}

export const CATEGORIAS = {
  doacao:         'Doação',
  medicamento:    'Medicamento',
  voluntariado:   'Voluntariado',
  infraestrutura: 'Infraestrutura',
  outro:          'Outro',
}

export const STATUS_PEDIDO = {
  aberto:       { label: 'Aberto',       classe: 'sv-tag--azul' },
  em_andamento: { label: 'Em andamento', classe: 'sv-tag--atencao' },
  concluido:    { label: 'Concluído',    classe: 'sv-tag--ok' },
  cancelado:    { label: 'Cancelado',    classe: 'sv-tag--neutro' },
}

export const urgenciaDe = (valor) => URGENCIAS[valor] ?? { label: valor, classe: 'sv-tag--neutro', peso: 0 }
export const statusPedidoDe = (valor) => STATUS_PEDIDO[valor] ?? { label: valor, classe: 'sv-tag--neutro' }

// Mais urgente primeiro; empate → mais recente primeiro
export const porUrgencia = (a, b) =>
  urgenciaDe(b.urgencia).peso - urgenciaDe(a.urgencia).peso || new Date(b.createdAt) - new Date(a.createdAt)
