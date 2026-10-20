// --------- Imports -----------
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuChevronRight, LuCircleCheck, LuCircleX, LuClipboardList, LuHourglass, LuInbox } from 'react-icons/lu';
import SidebarGlass from '../../../components/SidebarGlass/SidebarGlass';
import { Esqueleto, ErroPagina, Vazio } from '../../../components/EstadosPagina';
import '../../../styles/sosvale-glass.css';
import { fetchAdmin, formatarTempo } from '../../../services/api';

// Etiqueta de cada status (os valores são os que vêm da API)
const STATUS = {
  pendente: { label: 'Pendente', tag: 'atencao' },
  aprovado: { label: 'Aprovada', tag: 'ok' },
  recusado: { label: 'Recusada', tag: 'sirene' },
}

// Abas de filtro: o "id" é o valor de status usado no filtro
const ABAS = [
  { id: 'todas',    label: 'Todas' },
  { id: 'pendente', label: 'Pendentes' },
  { id: 'aprovado', label: 'Aprovadas' },
  { id: 'recusado', label: 'Recusadas' },
]

// Texto do estado vazio conforme o filtro
const VAZIO = {
  todas:    'Nenhuma solicitação recebida ainda.',
  pendente: 'Nenhuma solicitação pendente.',
  aprovado: 'Nenhuma solicitação aprovada.',
  recusado: 'Nenhuma solicitação recusada.',
}

function ListaSolicitacoesAbrigo() {

  const navigate = useNavigate();

  // ─── ESTADOS ────────────────────────────────────────────────
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('todas');

  // ─── BUSCA DA API ────────────────────────────────────────────
  // Função própria para o botão "Tentar novamente" poder chamar de novo
  const buscarSolicitacoes = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const resposta = await fetchAdmin('/solicitacoes/listar')
      if (!resposta.ok) throw new Error(`Erro ${resposta.status}`)
      const dados = await resposta.json()
      setSolicitacoes(dados.solicitacoes ?? [])
    } catch (erro) {
      console.error('Erro ao buscar solicitações:', erro)
      setErro('O servidor não respondeu. Verifique a conexão e tente novamente.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { buscarSolicitacoes() }, [buscarSolicitacoes])

  // ─── DERIVAÇÕES ──────────────────────────────────────────────
  // Filtra o array conforme a aba selecionada
  const solicitacoesFiltradas = filtroStatus === 'todas'
    ? solicitacoes
    : solicitacoes.filter(s => s.status === filtroStatus)

  const contar = (status) => status === 'todas'
    ? solicitacoes.length
    : solicitacoes.filter(s => s.status === status).length

  const pendentes = contar('pendente')

  // Cards do resumo: clicar aplica o filtro daquele status
  const resumo = [
    { id: 'pendente', label: 'Pendentes', detalhe: 'aguardando decisão', icone: <LuHourglass />, anim: 'pulso', tom: 'azul', urgente: pendentes > 0 },
    { id: 'aprovado', label: 'Aprovadas', detalhe: 'viraram abrigos',    icone: <LuCircleCheck />, anim: 'pulo', tom: 'petroleo' },
    { id: 'recusado', label: 'Recusadas', detalhe: 'com motivo registrado', icone: <LuCircleX />, anim: 'giro', tom: 'sirene' },
  ]

  const indiceAba = ABAS.findIndex(a => a.id === filtroStatus)

  // Clicar no card do filtro que já está ativo volta para "Todas"
  const filtrarPeloCard = (status) => setFiltroStatus(atual => atual === status ? 'todas' : status)

  // ─── TELA ────────────────────────────────────────────────────
  return (
    <div className="sv-app sv-pagina">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>

      <SidebarGlass ativo="solicitacoes-abrigo" />

      <main className="sv-main">

        <header className="sv-topo">
          <div className="sv-topo-texto">
            <p className="sv-trilha">
              <a href="/pg_adm">Visão geral</a> &gt; <span>Solicitações de abrigo</span>
            </p>
            <h1 className="sv-titulo">Solicitações de abrigo</h1>
            <p className="sv-subtitulo">Pedidos de novos abrigos enviados pelo WhatsApp. Abra um pedido para aprovar ou recusar.</p>
          </div>
        </header>

        {carregando && <Esqueleto forma="lista" />}

        {!carregando && erro && (
          <ErroPagina
            titulo="Não foi possível carregar as solicitações"
            mensagem={erro}
            onTentar={buscarSolicitacoes}
          />
        )}

        {!carregando && !erro && (
          <>
            {/* ─── RESUMO ─── */}
            <section className="sv-resumo" aria-label="Resumo por status">
              {resumo.map(card => (
                <button
                  key={card.id}
                  type="button"
                  className={`sv-resumo-card sv-anima${card.urgente ? ' sv-resumo-card--urgente' : ''}${filtroStatus === card.id ? ' sv-resumo-card--ativo' : ''}`}
                  aria-pressed={filtroStatus === card.id}
                  onClick={() => filtrarPeloCard(card.id)}
                >
                  <span className={`sv-poco sv-poco--${card.tom}${card.urgente ? ' sv-poco--aceso' : ''}`}>
                    <span data-anim={card.anim}>{card.icone}</span>
                  </span>
                  <span className="sv-resumo-valor">{contar(card.id)}</span>
                  <span className="sv-resumo-rotulo">{card.label}</span>
                  <span className="sv-resumo-detalhe">{card.detalhe}</span>
                </button>
              ))}
            </section>

            {/* ─── LISTA ─── */}
            <section className="sv-vidro sv-painel" aria-labelledby="titulo-pedidos">
              <div className="sv-painel-topo">
                <h2 id="titulo-pedidos" className="sv-painel-titulo">
                  <span className="sv-poco sv-poco--p sv-poco--azul sv-poco--aceso"><LuClipboardList /></span>
                  Pedidos
                </h2>
                <div
                  className="sv-abas"
                  role="tablist"
                  aria-label="Filtrar por status"
                  style={{ '--aba': indiceAba, '--abas': ABAS.length }}
                >
                  <span className="sv-abas-marcador" aria-hidden="true" />
                  {ABAS.map(aba => (
                    <button
                      key={aba.id}
                      type="button"
                      role="tab"
                      className="sv-aba"
                      aria-selected={filtroStatus === aba.id}
                      onClick={() => setFiltroStatus(aba.id)}
                    >
                      {aba.label}<span className="sv-aba-num">{contar(aba.id)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <p className="sv-contagem" style={{ marginBottom: '12px' }}>
                {solicitacoesFiltradas.length} resultado{solicitacoesFiltradas.length !== 1 ? 's' : ''}
              </p>

              {solicitacoesFiltradas.length === 0 ? (
                <Vazio
                  icone={<LuInbox />}
                  titulo={VAZIO[filtroStatus]}
                  dica="Os pedidos de novos abrigos enviados pelo bot do WhatsApp aparecem aqui."
                />
              ) : (
                <div className="sv-tabela-caixa sv-tabela-caixa--fixa">
                  <table className="sv-tabela sv-tabela--cards">
                    <thead>
                      <tr>
                        <th scope="col">Abrigo</th>
                        <th scope="col">Local</th>
                        <th scope="col">Responsável</th>
                        <th scope="col">Recebido</th>
                        <th scope="col">Status</th>
                        <th scope="col"><span className="sv-oculto">Ação</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {solicitacoesFiltradas.map(s => {
                        const status = STATUS[s.status] ?? { label: s.status, tag: 'neutro' }
                        return (
                          <tr key={s.id_solicitacao}>
                            <td>
                              <div className="sv-tabela-principal">
                                <strong>{s.nome}</strong>
                                <span>
                                  {s.tipoAbrigo}
                                  {s.capacidadeTotal ? ` · ${s.capacidadeTotal} vagas` : ''}
                                </span>
                              </div>
                            </td>
                            <td data-rotulo="Local">{[s.bairro, s.cidade].filter(Boolean).join(', ') || '—'}</td>
                            <td data-rotulo="Responsável">{s.responsavel || '—'}</td>
                            <td data-rotulo="Recebido">
                              <span title={s.createdAt ? new Date(s.createdAt).toLocaleString('pt-BR') : undefined}>
                                {s.createdAt ? formatarTempo(s.createdAt) : '—'}
                              </span>
                            </td>
                            <td data-rotulo="Status">
                              <span className={`sv-tag sv-tag--${status.tag}`}>{status.label}</span>
                            </td>
                            <td className="sv-tabela-fim">
                              <button
                                type="button"
                                onClick={() => navigate(`/visualizar-solicitação-abrigo/${s.id_solicitacao}`)}
                                className="sv-btn sv-btn--vidro"
                                aria-label={`Ver detalhes de ${s.nome}`}
                              >
                                Ver detalhes <LuChevronRight className="sv-seta" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        <footer className="sv-rodape">
          <p>© 2026 S.O.S Vale. Todos os direitos reservados.</p>
          <p>Versão 1.0.0</p>
        </footer>

      </main>
    </div>
  )
}

export default ListaSolicitacoesAbrigo;
