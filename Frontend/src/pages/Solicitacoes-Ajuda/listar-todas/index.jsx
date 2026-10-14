// --------- Imports -----------
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuBuilding2, LuClock, LuHandHeart, LuHeart, LuMapPin, LuPhone, LuPlus, LuUser } from 'react-icons/lu';
import SidebarGlass from '../../../components/SidebarGlass/SidebarGlass';
import '../../../styles/sosvale-glass.css';
import { API_URL, formatarTempo } from '../../../services/api';
import '../../alertas/alertas.css';

// ─── Rótulos (mesmos valores dos enums do banco) ──────────────────────────────
const STATUS = {
  aberto:       'Aberto',
  em_andamento: 'Em andamento',
  concluido:    'Concluído',
  cancelado:    'Cancelado',
}

const CATEGORIAS = {
  doacao:         'Doação',
  medicamento:    'Medicamento',
  voluntariado:   'Voluntariado',
  infraestrutura: 'Infraestrutura',
  outro:          'Outro',
}

const URGENCIAS = {
  critica: 'Crítica',
  alta:    'Alta',
  media:   'Média',
  baixa:   'Baixa',
}

// Minúsculo e sem acento — para a busca achar "agua" em "Água"
const normalizar = (texto) => String(texto ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// ─── Todas as solicitações de ajuda, com o abrigo de cada uma ─────────────────
function ListarSolicitacoesAjuda() {

  const navigate = useNavigate();

  // ─── ESTADOS ────────────────────────────────────────────────
  const [solicitacoes, setSolicitacoes] = useState([])
  const [abrigos, setAbrigos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroUrgencia, setFiltroUrgencia] = useState('')
  const [filtroAbrigo, setFiltroAbrigo] = useState('')
  const [busca, setBusca] = useState('')

  // 'lista' mostra uma linha por solicitação; 'abrigos' agrupa por abrigo
  const [visao, setVisao] = useState('lista')

  // Abrigo escolhido para criar uma nova solicitação
  const [abrigoNovaSolicitacao, setAbrigoNovaSolicitacao] = useState('')

  // ─── BUSCA DA API ────────────────────────────────────────────
  useEffect(() => {
    const buscar = async () => {
      try {
        const [resSolicitacoes, resAbrigos] = await Promise.all([
          fetch(`${API_URL}/api/solicitacoes-ajuda/listar`),
          fetch(`${API_URL}/api/abrigos/listar`),
        ])
        if (!resSolicitacoes.ok || !resAbrigos.ok) throw new Error('Não foi possível carregar as solicitações.')

        setSolicitacoes((await resSolicitacoes.json()).solicitacoes)
        setAbrigos((await resAbrigos.json()).abrigos)
      } catch (e) {
        setErro(e.message)
      } finally {
        setCarregando(false)
      }
    }
    buscar()
  }, [])

  // ─── DERIVAÇÕES ──────────────────────────────────────────────
  // Os filtros de categoria, urgência, abrigo e busca valem para tudo;
  // o status filtra só a lista (os cards mostram o total de cada status)
  const termo = normalizar(busca.trim())
  const doFiltro = solicitacoes.filter(s =>
    (!filtroCategoria || s.categoria === filtroCategoria) &&
    (!filtroUrgencia  || s.urgencia === filtroUrgencia) &&
    (!filtroAbrigo    || s.abrigoId === Number(filtroAbrigo)) &&
    (!termo || normalizar(s.titulo).includes(termo) || normalizar(s.descricao).includes(termo) || normalizar(s.abrigo?.nome).includes(termo))
  )

  const filtradas = filtroStatus ? doFiltro.filter(s => s.status === filtroStatus) : doFiltro

  const contagem = (status) => doFiltro.filter(s => s.status === status).length

  // Agrupa por abrigo, com os abrigos com mais pedidos em aberto primeiro
  const porAbrigo = Object.values(filtradas.reduce((grupos, s) => {
    grupos[s.abrigoId] ??= { abrigoId: s.abrigoId, abrigo: s.abrigo, solicitacoes: [] }
    grupos[s.abrigoId].solicitacoes.push(s)
    return grupos
  }, {})).sort((a, b) =>
    b.solicitacoes.filter(s => s.status === 'aberto').length - a.solicitacoes.filter(s => s.status === 'aberto').length
  )

  // Só abrigos que têm solicitações aparecem no filtro
  const abrigosComSolicitacoes = abrigos.filter(a => solicitacoes.some(s => s.abrigoId === a.id))

  // ─── LINHA DE UMA SOLICITAÇÃO ───────────────────────────────
  const linha = (s, mostrarAbrigo = true) => (
    <div className="sv-linha" key={s.id_solicitacao}>
      <div className="sv-poco sv-poco--p"><LuHandHeart /></div>

      <div className="sv-linha-info">
        <p className="sv-linha-titulo">{s.titulo}</p>
        <p className="sv-linha-meta">
          <span>{CATEGORIAS[s.categoria] ?? s.categoria}</span>
          {mostrarAbrigo && (
            <span>
              <LuBuilding2 />{' '}
              <a href={`/detalhes-abrigos/${s.abrigoId}`}>{s.abrigo?.nome}</a>
              {s.abrigo?.cidade && ` — ${s.abrigo.cidade}`}
            </span>
          )}
          <span title="Voluntários interessados"><LuHeart /> {s._count?.interesses ?? 0}</span>
          {s.voluntario && <span title="Voluntário responsável"><LuUser /> {s.voluntario.nome}</span>}
          <span><LuClock /> {formatarTempo(s.createdAt)}</span>
        </p>
      </div>

      <span className={`sv-tag sv-tag--lisa sv-status urgencia-${s.urgencia}`}>{URGENCIAS[s.urgencia] ?? s.urgencia}</span>
      <span className={`sv-tag sv-tag--lisa sv-status ${s.status}`}>{STATUS[s.status] ?? s.status}</span>

      <button
        onClick={() => navigate(`/visualizar-solicitacao-ajuda/${s.id_solicitacao}`)}
        className="sv-btn sv-btn--vidro "
        
      >
        Ver detalhes
      </button>
    </div>
  )

  // ─── TELA ────────────────────────────────────────────────────
  return (
    <div className="sv-app sv-pagina">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
      <SidebarGlass ativo="solicitacoes-ajuda" />

      <main className="sv-main">

        <header className="sv-topo">
          <div className="sv-topo-texto">
            <p className="sv-trilha"><a href="/pg_adm">Home</a> &gt; <span>Solicitações de ajuda</span></p>
            <h1 className="sv-titulo">Solicitações de ajuda</h1>
            <p className="sv-subtitulo">Pedidos de doações, medicamentos, voluntários e reparos de todos os abrigos</p>
          </div>

          {/* Nova solicitação: a solicitação sempre pertence a um abrigo */}
          <div className="sv-topo-acoes">
            <div className="barra-filtros" style={{ margin: 0 }}>
              <select value={abrigoNovaSolicitacao} onChange={e => setAbrigoNovaSolicitacao(e.target.value)}>
                <option value="">Escolha o abrigo...</option>
                {abrigos.map(a => <option key={a.id} value={a.id}>{a.nome} — {a.cidade}</option>)}
              </select>
            </div>
            <button
              className="sv-btn sv-btn--primario"
              disabled={!abrigoNovaSolicitacao}
              onClick={() => navigate(`/abrigos/${abrigoNovaSolicitacao}/cadastrar-solicitacao-ajuda`)}
            >
              <LuPlus /> Nova solicitação
            </button>
          </div>
        </header>

        {/* Cards de resumo por status — clicar filtra a lista */}
        <section className="resumo-alertas">
          {Object.entries(STATUS).map(([status, label]) => (
            <button
              key={status}
              className={`resumo-alerta-card ${filtroStatus === status ? 'selecionado' : ''}`}
              onClick={() => setFiltroStatus(filtroStatus === status ? '' : status)}
            >
              <div className="resumo-alerta-valor">{contagem(status)}</div>
              <div className="resumo-alerta-label"><span className={`sv-tag sv-tag--lisa sv-status ${status}`}>{label}</span></div>
            </button>
          ))}
        </section>

        <div className="sv-vidro sv-painel">

          <div className="barra-filtros">
            <input
              placeholder="Buscar por título, descrição ou abrigo..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />

            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
              <option value="">Todos os status</option>
              {Object.entries(STATUS).map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}
            </select>

            <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
              <option value="">Todas as categorias</option>
              {Object.entries(CATEGORIAS).map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}
            </select>

            <select value={filtroUrgencia} onChange={e => setFiltroUrgencia(e.target.value)}>
              <option value="">Todas as urgências</option>
              {Object.entries(URGENCIAS).map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}
            </select>

            <select value={filtroAbrigo} onChange={e => setFiltroAbrigo(e.target.value)}>
              <option value="">Todos os abrigos</option>
              {abrigosComSolicitacoes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>

            <div className="alternar-visao">
              <button className={visao === 'lista' ? 'selecionado' : ''} onClick={() => setVisao('lista')}>Lista</button>
              <button className={visao === 'abrigos' ? 'selecionado' : ''} onClick={() => setVisao('abrigos')}>Por abrigo</button>
            </div>

            <span className="contador-resultados">
              {filtradas.length} solicitaç{filtradas.length !== 1 ? 'ões' : 'ão'}
            </span>
          </div>

          {erro && <p className="sv-aviso sv-aviso--erro" style={{ marginBottom: '12px' }}>{erro}</p>}

          {carregando ? (
            <p style={{ color: 'var(--sv-tinta-2)' }}>Carregando solicitações...</p>
          ) : filtradas.length === 0 ? (
            <div className="sv-vazio">
              <LuHandHeart />
              <p>Nenhuma solicitação encontrada.</p>
            </div>
          ) : visao === 'lista' ? (
            filtradas.map(s => linha(s))
          ) : (
            porAbrigo.map(grupo => (
              <div className="grupo-abrigo" key={grupo.abrigoId}>
                <div className="grupo-abrigo-cabecalho">
                  <div>
                    <h4><LuBuilding2 /> {grupo.abrigo?.nome}</h4>
                    <small>
                      <LuMapPin /> {[grupo.abrigo?.bairro, grupo.abrigo?.cidade].filter(Boolean).join(', ')}
                      {grupo.abrigo?.telefone && <> · <LuPhone /> {grupo.abrigo.telefone}</>}
                      {' · '}{grupo.solicitacoes.filter(s => s.status === 'aberto').length} em aberto
                    </small>
                  </div>
                  <div className="sv-topo-acoes">
                    <a className="sv-btn sv-btn--vidro" href={`/abrigos/${grupo.abrigoId}/solicitacoes-ajuda`}>Solicitações do abrigo</a>
                    <a className="sv-btn sv-btn--vidro" href={`/detalhes-abrigos/${grupo.abrigoId}`}>Ver abrigo</a>
                  </div>
                </div>
                {grupo.solicitacoes.map(s => linha(s, false))}
              </div>
            ))
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

export default ListarSolicitacoesAjuda;
