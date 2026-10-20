import './style.css'
import { useState, useEffect } from 'react'; // ← useEffect adicionado: serve para executar código quando o componente carrega
import { IoMdHome } from "react-icons/io";
import { FaBoxOpen, FaMapPin, FaRegBell, FaUser, FaHome, FaDonate, FaChevronDown, FaChevronRight, FaPills, FaHandHoldingHeart } from "react-icons/fa";
import { GoAlertFill } from "react-icons/go";
import { FaHeart, FaGear, FaClipboardList, FaTriangleExclamation, FaClock, FaLocationDot, FaMap, FaPeopleGroup, FaCommentDots } from "react-icons/fa6";
import SidebarAdm from '../../components/SidebarAdm';
import { fetchAdmin } from '../../services/api';

// Categorias das solicitações de ajuda (mesmos valores do enum do banco)
const categoriasAjuda = {
  doacao:         'Doações',
  medicamento:    'Medicamentos',
  voluntariado:   'Voluntariado',
  infraestrutura: 'Infraestrutura',
  outro:          'Outros',
};

const quickActions = [
  { id: 'mapa',    label: 'Ver mapa',              icon: <FaMap />,              href: '/mapa' },
  { id: 'abrigos', label: 'Hub abrigos',           icon: <FaHome />,             href: '/abrigos' },
  { id: 'vitimas', label: 'Hub vítimas',           icon: <FaPeopleGroup />,      href: '/vitimas' },
  { id: 'ajuda',   label: 'Solicitações de ajuda', icon: <FaHandHoldingHeart />, href: '/solicitacoes-ajuda' },
];

// Cada aba das atividades tem a sua página de "ver todas"
const filters = [
  { id: 'todas',  label: 'Todas',   verTodas: null },
  { id: 'abrigo', label: 'Abrigo',  verTodas: { href: '/listar-solicitação-abrigo', label: 'Ver todas as solicitações de abrigo' } },
  { id: 'ajuda',  label: 'Ajuda',   verTodas: { href: '/solicitacoes-ajuda',        label: 'Ver todas as solicitações de ajuda' } },
  { id: 'alerta', label: 'Alertas', verTodas: { href: '/alertas',                   label: 'Ver todos os alertas' } },
];

const PgAdm = () => {
  const [activeFilter, setActiveFilter] = useState('todas');
  const [municipio, setMunicipio] = useState('Todos os Municípios');
  const [periodo, setPeriodo] = useState('Últimos 30 dias');

  // ─── ESTADOS NOVOS ───────────────────────────────────────────
  // solicitacoes: vai guardar a lista que vier da API
  // carregando: controla se ainda estamos esperando a resposta da API
  // erro: guarda a mensagem de erro se a requisição falhar
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  // null = ainda não carregou (ou sem login) → o card mostra "—"
  const [alertas, setAlertas] = useState(null);
  // Solicitações de ajuda dos abrigos (substituem o antigo "Doações")
  const [ajuda, setAjuda] = useState([]);

  // ─── BUSCA DA API ────────────────────────────────────────────
  // useEffect com [] roda UMA VEZ quando o componente aparece na tela
  // É o lugar certo para buscar dados externos
  useEffect(() => {
    async function buscarSolicitacoes() {
      try {
        const resposta = await fetchAdmin('/solicitacoes/listar')

        // Se o servidor retornou erro (ex: 500), lança uma exceção manualmente
        if (!resposta.ok) throw new Error('Erro ao buscar solicitações')

        const dados = await resposta.json()

        // A API retorna { solicitacoes: [...] }, então pegamos só o array
        setSolicitacoes(dados.solicitacoes)
      } catch (err) {
        setErro(err.message)
      } finally {
        // Seja sucesso ou erro, o carregando sempre vira false no fim
        setCarregando(false)
      }
    }

    // Se der erro, o card mostra "—" em vez de derrubar o dashboard
    async function buscarAlertas() {
      try {
        const resposta = await fetchAdmin('/alertas/listar')
        if (!resposta.ok) return
        const dados = await resposta.json()
        setAlertas(dados.alertas)
      } catch (err) {
        console.error('Erro ao buscar alertas:', err)
      }
    }

    async function buscarAjuda() {
      try {
        const resposta = await fetchAdmin('/solicitacoes-ajuda/listar')
        if (!resposta.ok) return
        const dados = await resposta.json()
        setAjuda(dados.solicitacoes)
      } catch (err) {
        console.error('Erro ao buscar solicitações de ajuda:', err)
      }
    }

    buscarSolicitacoes()
    buscarAlertas()
    buscarAjuda()
  }, []) // ← o [] garante que roda só uma vez (se fosse [periodo], rodaria toda vez que periodo mudasse)

  // ─── FILTROS DO TOPO (Município e Período) ───────────────────
  // Antes os dois selects mudavam o estado mas nenhum cálculo usava o valor.
  // Agora valem para os cards, as atividades e o gráfico.
  const cidadeFiltro = municipio === 'Todos os Municípios' ? null : municipio
  const diasPeriodo = { 'Últimos 30 dias': 30, 'Últimos 7 dias': 7, 'Hoje': 0 }[periodo] ?? 30
  const inicioPeriodo = new Date()
  inicioPeriodo.setHours(0, 0, 0, 0)
  inicioPeriodo.setDate(inicioPeriodo.getDate() - diasPeriodo)

  const dentroDoFiltro = (cidade, data) =>
    (!cidadeFiltro || cidade === cidadeFiltro) && new Date(data) >= inicioPeriodo

  const solicitacoesFiltradas = solicitacoes.filter(s => dentroDoFiltro(s.cidade, s.createdAt))
  const ajudaFiltrada = ajuda.filter(s => dentroDoFiltro(s.abrigo?.cidade, s.createdAt))
  const alertasFiltrados = alertas ? alertas.filter(a => dentroDoFiltro(a.cidade, a.createdAt)) : null

  // ─── DERIVAÇÕES DOS DADOS ────────────────────────────────────
  // Contamos direto do array que veio da API, sem guardar em estado separado
  // Isso é chamado de "estado derivado" — calculamos na hora do render

  // Quantas solicitações de abrigo existem no período (todas as situações)
  const totalSolicitacoesAbrigo = solicitacoesFiltradas.length

  // Quantas ainda estão pendentes (= "novas" para o card)
  const pendentesSolicitacoesAbrigo = solicitacoesFiltradas.filter(s => s.status === 'pendente').length

  // O sininho do topo avisa TODAS as pendentes, sem filtro
  const totalPendentesAbrigo = solicitacoes.filter(s => s.status === 'pendente').length

  // Solicitações de ajuda ainda não resolvidas (aberto ou em andamento)
  const ajudaEmAberto = ajudaFiltrada.filter(s => ['aberto', 'em_andamento'].includes(s.status))
  const ajudaDaCategoria = (categoria) => ajudaEmAberto.filter(s => s.categoria === categoria)
  const criticas = (lista) => lista.filter(s => s.urgencia === 'critica' || s.urgencia === 'alta').length

  // Gráfico: solicitações em aberto por categoria
  const itensRequisitados = Object.entries(categoriasAjuda).map(([categoria, label]) => ({
    label, value: ajudaDaCategoria(categoria).length
  }))

  // ─── MONTAGEM DINÂMICA DOS CARDS ────────────────────────────
  // Antes era um array fixo fora do componente
  // Agora está dentro para poder usar os valores calculados acima
  const statCards = [
    {
      id: 'abrigo',
      label: 'Novas solicitações de abrigo',
      // Só as pendentes (antes contava todas, inclusive aprovadas e recusadas)
      value: pendentesSolicitacoesAbrigo,
      unread: totalSolicitacoesAbrigo,
      unreadLabel: 'no total',
      icon: <FaClipboardList />,
      accent: 'blue'
    },
    {
      id: 'Doações',
      label: 'Pedidos de doações',
      value: ajudaDaCategoria('doacao').length,
      unread: criticas(ajudaDaCategoria('doacao')),
      unreadLabel: 'urgentes',
      href: '/solicitacoes-ajuda',
      icon: <FaHeart />,
      accent: 'cyan'
    },
    {
      id: 'Remédios',
      label: 'Pedidos de medicamentos',
      value: ajudaDaCategoria('medicamento').length,
      unread: criticas(ajudaDaCategoria('medicamento')),
      unreadLabel: 'urgentes',
      href: '/solicitacoes-ajuda',
      icon: <FaPills />,
      accent: 'teal'
    },
    {
      id: 'Alertas',
      label: 'Alertas abertos',
      // abertos = em verificação + ativos (vem da API)
      value: alertasFiltrados ? alertasFiltrados.filter(a => ['em_verificacao', 'ativo'].includes(a.status)).length : '—',
      unread: alertasFiltrados ? alertasFiltrados.filter(a => a.status === 'em_verificacao').length : '—',
      unreadLabel: 'em verificação',
      href: '/alertas',
      icon: <FaRegBell />,
      accent: 'red'
    },
    {
      id: 'Ajuda',
      label: 'Solicitações de ajuda em aberto',
      value: ajudaEmAberto.length,
      unread: ajudaEmAberto.filter(s => s.status === 'aberto').length,
      unreadLabel: 'sem voluntário',
      href: '/solicitacoes-ajuda',
      icon: <FaTriangleExclamation />,
      accent: 'orange'
    },
  ]

  // ─── ATIVIDADES DINÂMICAS ────────────────────────────────────
  // Transformamos as solicitações da API no formato que a lista espera
  // .slice(0, 6) pega só as 6 mais recentes (a API já retorna ordenado por createdAt desc)
  // Junta solicitações de abrigo, solicitações de ajuda e alertas numa só lista,
  // cada item com o link para a sua própria tela
  const activitiesData = [
    ...solicitacoesFiltradas.map(s => ({
      id:     `abrigo-${s.id_solicitacao}`,
      title:  `Abrigo solicitado: ${s.nome}`,
      place:  [s.bairro, s.cidade].filter(Boolean).join(', '),  // ← bairro é opcional
      data:   s.createdAt,
      type:   'abrigo',
      icon:   <FaHome />,
      href:   `/visualizar-solicitação-abrigo/${s.id_solicitacao}`,
      botao:  'Ver solicitação',
    })),
    ...ajudaFiltrada.map(s => ({
      id:     `ajuda-${s.id_solicitacao}`,
      title:  `Ajuda: ${s.titulo}`,
      place:  [s.abrigo?.nome, s.abrigo?.cidade].filter(Boolean).join(' — '),
      data:   s.createdAt,
      type:   'ajuda',
      icon:   <FaHandHoldingHeart />,
      href:   `/visualizar-solicitacao-ajuda/${s.id_solicitacao}`,
      botao:  'Ver pedido',
    })),
    ...(alertasFiltrados ?? []).map(a => ({
      id:     `alerta-${a.id_alerta}`,
      title:  `Alerta: ${a.tipoLabel}`,
      place:  `${a.bairro}, ${a.cidade}`,
      data:   a.createdAt,
      type:   'alerta',
      icon:   <GoAlertFill />,
      href:   `/alertas/${a.id_alerta}`,
      botao:  'Ver alerta',
    })),
  ]
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .map(item => ({ ...item, time: formatarTempo(item.data) }))

  // As 6 mais recentes da aba escolhida
  const filteredActivities = (activeFilter === 'todas'
    ? activitiesData
    : activitiesData.filter(a => a.type === activeFilter)
  ).slice(0, 6);

  const verTodas = filters.find(f => f.id === activeFilter)?.verTodas

  // Math.max(1, ...) evita divisão por zero quando não há nenhuma solicitação
  const maxValue = Math.max(1, ...itensRequisitados.map(i => i.value));

  // ─── TELA DE CARREGANDO / ERRO ───────────────────────────────
  if (carregando) return <div className="dashboard">Carregando...</div>
  if (erro)       return <div className="dashboard">Erro: {erro}</div>

  return (
    // ... JSX igual ao seu, sem mudanças visuais
    <div className="dashboard">
      <SidebarAdm ativo="home" />

      <main className="main">
        <header className="top">
          <div>
            <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>Home &gt;</p>
            <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#0f172a', marginTop: '4px' }}>
              Home S.O.S. Vale
            </h1>
            <p className="subtitle">Gerencie informações recentes</p>
          </div>
          <div className="top-controls">
            <button
              className="notif-btn"
              title="Solicitações de abrigo pendentes"
              onClick={() => { window.location.href = '/listar-solicitação-abrigo' }}
            >
              <FaRegBell />
              {/* Badge dinâmico: total de pendentes em todas as categorias */}
              <span className="notif-badge">{totalPendentesAbrigo}</span>
            </button>
            <div className="filter-select">
              <FaLocationDot className="filter-select-icon" />
              <select value={municipio} onChange={(e) => setMunicipio(e.target.value)}>
                <option>Todos os Municípios</option>
                <option>Taubaté</option>
                <option>Caçapava</option>
                <option>Pindamonhangaba</option>
              </select>
            </div>
            <div className="filter-select">
              <FaClock className="filter-select-icon" />
              <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
                <option>Últimos 30 dias</option>
                <option>Últimos 7 dias</option>
                <option>Hoje</option>
              </select>
            </div>
          </div>
        </header>

        <section className="stat-grid">
          {statCards.map(card => (
            <div
              className={`stat-card stat-card--${card.accent}`}
              key={card.id}
              onClick={card.href ? () => { window.location.href = card.href } : undefined}
              style={card.href ? { cursor: 'pointer' } : undefined}
            >
              <div className="stat-card-icon">{card.icon}</div>
              <div className="stat-card-value">{card.value}</div>
              <div className="stat-card-label">{card.label}</div>
              <div className="stat-card-unread">
                <span className="dot" /> {card.unread} {card.unreadLabel ?? 'não lidas'}
              </div>
            </div>
          ))}
        </section>

        <section className="content-grid">
          <div className="panel activities-panel">
            <div className="panel-header">
              <h3>Atividades</h3>
              <div className="filter-tabs">

                {filters.map(f => (
                  <button
                    key={f.id}
                    className={`filter-tab ${activeFilter === f.id ? 'filter-tab--active' : ''}`}
                    onClick={() => setActiveFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="activities-list">
              {filteredActivities.length === 0 && (
                <p style={{ color: '#94a3b8', padding: '16px 0', fontSize: '14px' }}>Nenhuma atividade recente.</p>
              )}
              {filteredActivities.map(item => (
                <div className="activity-row" key={item.id}>
                  <div className="activity-icon">{item.icon}</div>
                  <div className="activity-info">
                    <p className="activity-title">{item.title}</p>
                    <div className="activity-meta">
                      <span><FaLocationDot /> {item.place}</span>
                      <span><FaClock /> {item.time}</span>
                    </div>
                  </div>
                  <a href={item.href}><button className="activity-btn">{item.botao}</button></a>
                </div>
              ))}
            </div>

            {/* Na aba "Todas" não há uma página única — o botão aparece nas outras abas */}
            {verTodas && (
              <a href={verTodas.href} style={{ textDecoration: 'none' }}>
                <button className="see-all-btn">
                  {verTodas.label} <FaChevronRight />
                </button>
              </a>
            )}
          </div>

          <div className="side-column">
            <div className="panel chart-panel">
              <h3>Gráfico</h3>
              <p className="chart-subtitle">SOLICITAÇÕES DE AJUDA EM ABERTO POR CATEGORIA</p>
              <div className="bar-chart">
                {itensRequisitados.map(item => (
                  <div className="bar-row" key={item.label}>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${(item.value / maxValue) * 100}%` }} />
                    </div>
                    <span className="bar-label">{item.label} ({item.value})</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel quick-actions-panel">
              <h3>Ações Rápidas</h3>
              <div className="quick-actions-grid">
                {quickActions.map(action => (
                  <button
                    className="quick-action"
                    key={action.id}
                    onClick={() => { window.location.href = action.href }}
                  >
                    <span className="quick-action-icon">{action.icon}</span>
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

// ─── FUNÇÃO AUXILIAR ─────────────────────────────────────────────
// Fica fora do componente pois não depende de nenhum estado
// Converte "2026-06-24T03:55:54.000Z" em "Há 15 min", "Há 2 horas", etc.
function formatarTempo(dataISO) {
  const agora = new Date()
  const data = new Date(dataISO)
  const diffMin = Math.floor((agora - data) / 1000 / 60)

  if (diffMin < 1)   return 'Agora mesmo'
  if (diffMin < 60)  return `Há ${diffMin} min`

  const diffHoras = Math.floor(diffMin / 60)
  if (diffHoras < 24) return `Há ${diffHoras}h`

  const diffDias = Math.floor(diffHoras / 24)
  return `Há ${diffDias} dias`
}

export default PgAdm;