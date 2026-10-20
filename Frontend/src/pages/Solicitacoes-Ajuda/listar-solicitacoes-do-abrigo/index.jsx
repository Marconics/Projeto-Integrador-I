// ─── Imports ──────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LuChevronRight, LuHandHeart, LuPlus } from 'react-icons/lu';
import SidebarGlass from '../../../components/SidebarGlass/SidebarGlass';
import '../../../styles/sosvale-glass.css';
import { fetchAdmin } from '../../../services/api';
import { Esqueleto, ErroPagina, Vazio } from '../../../components/EstadosPagina';

// ─── Constantes de exibição ───────────────────────────────────────────────────
const badgeStatus = {
  aberto:       { label: 'Aberto',       bg: 'var(--sv-azul-suave)', cor: 'var(--sv-azul-forte)' },
  em_andamento: { label: 'Em andamento', bg: 'var(--sv-atencao-suave)', cor: 'var(--sv-atencao-forte)' },
  concluido:    { label: 'Concluído',    bg: 'var(--sv-ok-suave)', cor: 'var(--sv-ok-forte)' },
  cancelado:    { label: 'Cancelado',    bg: 'var(--sv-sirene-suave)', cor: 'var(--sv-sirene-forte)' },
}

const badgeUrgencia = {
  baixa:   { label: 'Baixa',   bg: 'var(--sv-ok-suave)', cor: 'var(--sv-ok-forte)' },
  media:   { label: 'Média',   bg: 'var(--sv-atencao-suave)', cor: 'var(--sv-atencao-forte)' },
  alta:    { label: 'Alta',    bg: 'var(--sv-atencao-suave)', cor: 'var(--sv-atencao-forte)' },
  critica: { label: 'Crítica', bg: 'var(--sv-sirene-suave)', cor: 'var(--sv-sirene-forte)' },
}

const categoriaLabel = {
  doacao:         'Doação',
  medicamento:    'Medicamento',
  voluntariado:   'Voluntariado',
  infraestrutura: 'Infraestrutura',
  outro:          'Outro',
}

const FILTROS = ['todas', 'aberto', 'em_andamento', 'concluido', 'cancelado']

// ─── Sidebar reutilizável ─────────────────────────────────────────────────────
const Sidebar = () => (
  <SidebarGlass ativo="solicitacoes-ajuda" />
)

// ─── Componente principal ─────────────────────────────────────────────────────
function SolicitacoesAjudaDoAbrigo() {

  const { id } = useParams()
  const navigate = useNavigate()

  const [solicitacoes, setSolicitacoes]   = useState([])
  const [nomeAbrigo, setNomeAbrigo]       = useState('')
  const [carregando, setCarregando]       = useState(true)
  const [erro, setErro]                   = useState(null)
  const [filtroStatus, setFiltroStatus]   = useState('todas')

  // ─── Busca ──────────────────────────────────────────────────────────────────
  // Função própria para o botão "Tentar novamente" poder chamar de novo
  const buscar = useCallback(async () => {
      setCarregando(true)
      setErro(null)
      try {
        // Busca o nome do abrigo para o breadcrumb
        const resAbrigo = await fetchAdmin(`/abrigos/listar/${id}`)
        if (!resAbrigo.ok) throw new Error(`Erro ${resAbrigo.status}`)
        const dadosAbrigo = await resAbrigo.json()
        setNomeAbrigo(dadosAbrigo.nome ?? '')

        // Busca todas as solicitações do abrigo (sem limite)
        const resSolic = await fetchAdmin(`/solicitacoes-ajuda/abrigo/${id}`)
        if (!resSolic.ok) throw new Error(`Erro ${resSolic.status}`)
        const dadosSolic = await resSolic.json()
        setSolicitacoes(dadosSolic.solicitacoes ?? [])
      } catch (erro) {
        console.error('Erro ao buscar dados:', erro)
        setErro('O servidor não respondeu. Verifique a conexão e tente novamente.')
      } finally {
        setCarregando(false)
      }
  }, [id])

  useEffect(() => { buscar() }, [buscar])

  // ─── Derivações ─────────────────────────────────────────────────────────────
  const lista = filtroStatus === 'todas'
    ? solicitacoes
    : solicitacoes.filter(s => s.status === filtroStatus)

  // ─── Carregando / erro ───────────────────────────────────────────────────────
  if (carregando || erro) {
    return (
      <div className="sv-app sv-pagina">
        <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
        <Sidebar />
        <main className="sv-main">
          <header className="sv-topo">
            <div className="sv-topo-texto">
              <p className="sv-trilha"><a href="/abrigos">Abrigos</a> &gt; <span>Solicitações de Ajuda</span></p>
              <h1 className="sv-titulo">Solicitações de Ajuda</h1>
            </div>
          </header>
          {carregando
            ? <Esqueleto forma="linhas" />
            : <ErroPagina titulo="Não foi possível carregar as solicitações do abrigo" mensagem={erro} onTentar={buscar} />}
        </main>
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="sv-app sv-pagina">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
      <Sidebar />

      <main className="sv-main">

        {/* Header */}
        <header className="sv-topo">
          <div className="sv-topo-texto">
            <p className="sv-trilha">
              <a href="/abrigos">Abrigos</a> &gt;{' '}
              <button type="button" className="sv-link" onClick={() => navigate(`/detalhes-abrigos/${id}`)}>
                {nomeAbrigo}
              </button>
              {' '}&gt; Solicitações de Ajuda
            </p>
            <h1 className="sv-titulo">
              Solicitações de Ajuda
            </h1>
            <p className="sv-subtitulo">Todos os pedidos de ajuda vinculados a este abrigo</p>
          </div>

          {/* Botão nova solicitação */}
          <button
            className="sv-btn sv-btn--primario"
            onClick={() => navigate(`/abrigos/${id}/cadastrar-solicitacao-ajuda`)}
          >
            <LuPlus /> Nova Solicitação
          </button>
        </header>

        {/* Painel */}
        <div className="sv-vidro sv-painel">

          {/* Filtros */}
          <div className="sv-filtros">
            <div className="sv-chips" role="group" aria-label="Filtrar por status">
              {FILTROS.map(f => (
                <button
                  key={f}
                  onClick={() => setFiltroStatus(f)}
                  className={`sv-chip${filtroStatus === f ? ' sv-chip--ativo' : ''}`}
                  aria-pressed={filtroStatus === f}
                >
                  {f === 'todas'       ? 'Todas'
                   : f === 'em_andamento' ? 'Em andamento'
                   : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            <span className="sv-contagem">
              {lista.length} resultado{lista.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Lista vazia */}
          {lista.length === 0 ? (
            <Vazio
              icone={<LuHandHeart />}
              titulo={solicitacoes.length === 0 ? 'Este abrigo ainda não tem solicitações de ajuda.' : 'Nenhuma solicitação com este status.'}
              dica="Os pedidos de doações, medicamentos, voluntários e reparos deste abrigo aparecem aqui."
              acao={solicitacoes.length === 0 && (
                <button className="sv-btn sv-btn--primario" onClick={() => navigate(`/abrigos/${id}/cadastrar-solicitacao-ajuda`)}>
                  <LuPlus /> Nova Solicitação
                </button>
              )}
            />
          ) : (
            <div className="sv-lista">
              {lista.map(s => {
                const badge   = badgeStatus[s.status]   ?? { label: s.status,    bg: 'var(--sv-fundo-suave)', cor: 'var(--sv-tinta-2)' }
                const urgBadge = badgeUrgencia[s.urgencia] ?? { label: s.urgencia, bg: 'var(--sv-fundo-suave)', cor: 'var(--sv-tinta-2)' }

                return (
                  <div key={s.id_solicitacao} className="sv-linha">
                    {/* Ícone */}
                    <span className="sv-poco sv-poco--p sv-poco--aceso sv-poco--ciano">
                      <LuHandHeart />
                    </span>

                    {/* Informações */}
                    <div className="sv-linha-info">
                      <p className="sv-linha-titulo">
                        {s.titulo}
                      </p>
                      <p className="sv-linha-meta">
                        {categoriaLabel[s.categoria] ?? s.categoria}
                        {s.criadoPor?.nome ? ` — criado por ${s.criadoPor.nome}` : ''}
                      </p>
                    </div>

                    {/* Badge urgência */}
                    <span className="sv-tag sv-tag--lisa" style={{ background: urgBadge.bg, color: urgBadge.cor }}>
                      {urgBadge.label}
                    </span>

                    {/* Badge status */}
                    <span className="sv-tag sv-tag--lisa" style={{ background: badge.bg, color: badge.cor }}>
                      {badge.label}
                    </span>

                    {/* Botão */}
                    <button
                      onClick={() => navigate(`/visualizar-solicitacao-ajuda/${s.id_solicitacao}`)}
                      className="sv-btn sv-btn--vidro"
                    >
                      Ver detalhes <LuChevronRight className="sv-seta" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <footer className="sv-rodape">
          <p>© 2026 S.O.S Vale. Todos os direitos reservados.</p>
          <p>Versão 1.0.0</p>
        </footer>

      </main>
    </div>
  )
}

export default SolicitacoesAjudaDoAbrigo