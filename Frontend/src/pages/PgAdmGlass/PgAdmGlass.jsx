import { useState, useEffect, useCallback } from 'react';
import {
  LuClipboardList, LuHeart, LuPill, LuSiren, LuHandHeart, LuHouse, LuMap, LuUsers,
  LuMapPin, LuClock, LuBell, LuChevronRight, LuChevronDown, LuCalendarDays,
  LuWifiOff, LuRefreshCw, LuInbox, LuArrowUpRight, LuActivity, LuChartBar, LuZap,
  LuTriangleAlert, LuCircleCheck,
} from 'react-icons/lu';
import SidebarGlass from '../../components/SidebarGlass/SidebarGlass';
import '../../styles/sosvale-glass.css';
import './style.css';

// Endereço base da API (antes ficava repetido em cada fetch)
const API = 'http://localhost:3000/api';

// Categorias das solicitações de ajuda (mesmos valores do enum do banco)
const categoriasAjuda = {
  doacao:         'Doações',
  medicamento:    'Medicamentos',
  voluntariado:   'Voluntariado',
  infraestrutura: 'Infraestrutura',
  outro:          'Outros',
};

// "anim" = animação do ícone no hover (definidas em sosvale-glass.css)
// "tom"  = cor do botão (azul, ciano, forte, sirene = vermelho do logo)
const quickActions = [
  { id: 'mapa',    label: 'Ver mapa',              icon: <LuMap />,       anim: 'flutua', tom: 'azul',   href: '/mapa' },
  { id: 'abrigos', label: 'Hub abrigos',           icon: <LuHouse />,     anim: 'pulo',   tom: 'ciano',  href: '/abrigos' },
  { id: 'vitimas', label: 'Hub vítimas',           icon: <LuUsers />,     anim: 'pulso',  tom: 'forte',  href: '/vitimas' },
  { id: 'ajuda',   label: 'Solicitações de ajuda', icon: <LuHandHeart />, anim: 'oferta', tom: 'sirene', href: '/solicitacoes-ajuda' },
];

// ─── INTENSIDADE DAS PENDÊNCIAS ─────────────────────────────────────
// Com este número de pendências (ou mais) o círculo fica no tom mais
// escuro. Ajustem ao volume real da rede.
const PENDENCIAS_TOM_MAXIMO = 15;

// Cada aba das atividades tem a sua página de "ver todas"
const filters = [
  { id: 'todas',  label: 'Todas',   verTodas: null },
  { id: 'abrigo', label: 'Abrigo',  verTodas: { href: '/listar-solicitação-abrigo', label: 'Ver todas as solicitações de abrigo' } },
  { id: 'ajuda',  label: 'Ajuda',   verTodas: { href: '/solicitacoes-ajuda',        label: 'Ver todas as solicitações de ajuda' } },
  { id: 'alerta', label: 'Alertas', verTodas: { href: '/alertas',                   label: 'Ver todos os alertas' } },
];

// Pedido urgente = urgência crítica ou alta
const ehUrgente = (s) => s.urgencia === 'critica' || s.urgencia === 'alta'

// ─── BUSCAS NA API ──────────────────────────────────────────────────
// Ficam fora do componente: só buscam e devolvem os dados.
// Quem guarda no estado é o carregarDados(), lá dentro do componente.

// Se esta falhar, o painel mostra a tela de erro
async function buscarSolicitacoes() {
  const resposta = await fetch(`${API}/solicitacoes/listar`)
  if (!resposta.ok) throw new Error('Erro ao buscar solicitações')
  const dados = await resposta.json()
  return dados.solicitacoes ?? []
}

// Alertas exigem login de admin. Sem token ou com erro devolve null,
// e o card mostra "—" em vez de derrubar o painel inteiro
async function buscarAlertas() {
  let token = null
  try { token = localStorage.getItem('token_adm') } catch { /* navegador bloqueou o storage */ }
  if (!token) return null
  try {
    const resposta = await fetch(`${API}/alertas/listar`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!resposta.ok) return null
    const dados = await resposta.json()
    return dados.alertas ?? []
  } catch (err) {
    console.error('Erro ao buscar alertas:', err)
    return null
  }
}

async function buscarAjuda() {
  try {
    const resposta = await fetch(`${API}/solicitacoes-ajuda/listar`)
    if (!resposta.ok) return []
    const dados = await resposta.json()
    return dados.solicitacoes ?? []
  } catch (err) {
    console.error('Erro ao buscar solicitações de ajuda:', err)
    return []
  }
}

const PgAdmGlass = () => {
  const [activeFilter, setActiveFilter] = useState('todas');
  const [municipio, setMunicipio] = useState('Todos os Municípios');
  const [periodo, setPeriodo] = useState('Últimos 30 dias');

  const [solicitacoes, setSolicitacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  // null = sem login de admin (ou falhou) → o card mostra "—"
  const [alertas, setAlertas] = useState(null);
  const [ajuda, setAjuda] = useState([]);

  // ─── CARREGAMENTO ─────────────────────────────────────────────────
  // As três buscas rodam em paralelo (Promise.all).
  // Virou uma função própria para o botão "Tentar novamente" poder chamá-la.
  // useCallback mantém a mesma função entre renders, então o useEffect roda uma vez só.
  const carregarDados = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const [listaAbrigo, listaAlertas, listaAjuda] = await Promise.all([
        buscarSolicitacoes(),
        buscarAlertas(),
        buscarAjuda(),
      ])
      setSolicitacoes(listaAbrigo)
      setAlertas(listaAlertas)
      setAjuda(listaAjuda)
    } catch (err) {
      console.error(err)
      setErro('O servidor não respondeu. Verifique a conexão e tente novamente.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { carregarDados() }, [carregarDados])

  // ─── DERIVAÇÕES DOS DADOS (estado derivado, calculado a cada render) ─

  const totalSolicitacoesAbrigo = solicitacoes.length
  const pendentesSolicitacoesAbrigo = solicitacoes.filter(s => s.status === 'pendente').length

  // Solicitações de ajuda ainda não resolvidas (aberto ou em andamento)
  const ajudaEmAberto = ajuda.filter(s => ['aberto', 'em_andamento'].includes(s.status))
  const ajudaDaCategoria = (categoria) => ajudaEmAberto.filter(s => s.categoria === categoria)
  const criticas = (lista) => lista.filter(ehUrgente).length
  const urgentesAjuda = criticas(ajudaEmAberto)

  const alertasAbertos = alertas ? alertas.filter(a => ['em_verificacao', 'ativo'].includes(a.status)) : []
  const alertasEmVerificacao = alertas ? alertas.filter(a => a.status === 'em_verificacao').length : 0

  // Destaque da tela: tudo que pede ação agora
  const pendencias = pendentesSolicitacoesAbrigo + urgentesAjuda + alertasEmVerificacao
  // 0 = nenhuma pendência, 1 = muitas (escurece o círculo)
  const intensidade = Math.min(1, pendencias / PENDENCIAS_TOM_MAXIMO)

  // Gráfico: pedidos em aberto por categoria, separando os urgentes
  const itensRequisitados = Object.entries(categoriasAjuda).map(([categoria, label]) => ({
    label,
    value: ajudaDaCategoria(categoria).length,
    urgentes: criticas(ajudaDaCategoria(categoria)),
  }))
  // Math.max(1, ...) evita divisão por zero quando não há nenhuma solicitação
  const maxValue = Math.max(1, ...itensRequisitados.map(i => i.value));

  // ─── CARDS ────────────────────────────────────────────────────────
  // tom: cor do ícone. "sirene" (vermelho) só para o que é urgente.
  const statCards = [
    {
      id: 'abrigo',
      label: 'Solicitações de abrigo',
      value: totalSolicitacoesAbrigo,
      unread: pendentesSolicitacoesAbrigo,
      unreadLabel: 'pendentes',
      href: '/listar-solicitação-abrigo',
      icon: <LuClipboardList />, anim: 'pulo', tom: 'azul',
    },
    {
      id: 'doacoes',
      label: 'Pedidos de doações',
      value: ajudaDaCategoria('doacao').length,
      unread: criticas(ajudaDaCategoria('doacao')),
      unreadLabel: 'urgentes',
      href: '/solicitacoes-ajuda',
      icon: <LuHeart />, anim: 'batida', tom: 'ciano',
    },
    {
      id: 'remedios',
      label: 'Pedidos de medicamentos',
      value: ajudaDaCategoria('medicamento').length,
      unread: criticas(ajudaDaCategoria('medicamento')),
      unreadLabel: 'urgentes',
      href: '/solicitacoes-ajuda',
      icon: <LuPill />, anim: 'giro', tom: 'anil',
    },
    {
      id: 'alertas',
      label: 'Alertas abertos',
      value: alertas ? alertasAbertos.length : '—',
      unread: alertas ? alertasEmVerificacao : null,
      unreadLabel: alertas ? 'em verificação' : 'Entre como admin para ver',
      href: '/alertas',
      icon: <LuSiren />, anim: 'sirene', tom: 'sirene',
      urgente: alertasEmVerificacao > 0,
    },
    {
      id: 'ajuda',
      label: 'Ajuda em aberto',
      value: ajudaEmAberto.length,
      unread: ajudaEmAberto.filter(s => s.status === 'aberto').length,
      unreadLabel: 'sem voluntário',
      href: '/solicitacoes-ajuda',
      icon: <LuHandHeart />, anim: 'oferta', tom: 'petroleo',
    },
  ]

  // ─── ATIVIDADES ───────────────────────────────────────────────────
  // Junta abrigo, ajuda e alertas numa lista só, do mais novo pro mais antigo.
  // "tag" mostra o estado de cada item (pendente, crítica, em verificação...)
  const activitiesData = [
    ...solicitacoes.map(s => ({
      id:    `abrigo-${s.id_solicitacao}`,
      title: `Abrigo solicitado: ${s.nome}`,
      place: [s.bairro, s.cidade].filter(Boolean).join(', '),  // bairro é opcional
      data:  s.createdAt,
      type:  'abrigo',
      icon:  <LuHouse />, anim: 'pulo', tom: 'azul',
      tag:   s.status === 'pendente' ? { texto: 'Pendente', tom: 'azul' } : null,
      href:  `/visualizar-solicitação-abrigo/${s.id_solicitacao}`,
      botao: 'Ver solicitação',
    })),
    ...ajuda.map(s => ({
      id:    `ajuda-${s.id_solicitacao}`,
      title: `Ajuda: ${s.titulo}`,
      place: [s.abrigo?.nome, s.abrigo?.cidade].filter(Boolean).join(', '),
      data:  s.createdAt,
      type:  'ajuda',
      icon:  <LuHandHeart />, anim: 'oferta', tom: 'ciano',
      tag:   s.urgencia === 'critica' ? { texto: 'Crítica', tom: 'sirene' }
           : s.urgencia === 'alta'    ? { texto: 'Alta', tom: 'sirene' }
           : null,
      href:  `/visualizar-solicitacao-ajuda/${s.id_solicitacao}`,
      botao: 'Ver pedido',
    })),
    ...(alertas ?? []).map(a => ({
      id:    `alerta-${a.id_alerta}`,
      title: `Alerta: ${a.tipoLabel}`,
      place: [a.bairro, a.cidade].filter(Boolean).join(', '),
      data:  a.createdAt,
      type:  'alerta',
      icon:  <LuSiren />, anim: 'sirene', tom: 'sirene',
      tag:   a.status === 'em_verificacao' ? { texto: 'Em verificação', tom: 'sirene' }
           : a.status === 'ativo'          ? { texto: 'Ativo', tom: 'azul' }
           : null,
      href:  `/alertas/${a.id_alerta}`,
      botao: 'Ver alerta',
    })),
  ]
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .map(item => ({ ...item, time: formatarTempo(item.data) }))

  // As 6 mais recentes da aba escolhida
  const filteredActivities = (activeFilter === 'todas'
    ? activitiesData
    : activitiesData.filter(a => a.type === activeFilter)
  ).slice(0, 6);

  const indiceAba = filters.findIndex(f => f.id === activeFilter)
  const verTodas = filters[indiceAba]?.verTodas

  // ─── TELA ─────────────────────────────────────────────────────────
  return (
    <div className="pga sv-app">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>

      <SidebarGlass ativo="home" />

      <main className="pga-main">
        <header className="pga-topo">
          <h1 className="pga-titulo">Visão geral</h1>

          <div className="pga-controles">
            <div className="pga-filtros">
              <label className="sv-select">
                <LuMapPin />
                <span className="sv-oculto">Município</span>
                <select id="filtro-municipio" value={municipio} onChange={(e) => setMunicipio(e.target.value)}>
                  <option>Todos os Municípios</option>
                  <option>Taubaté</option>
                  <option>Caçapava</option>
                  <option>Pindamonhangaba</option>
                </select>
                <LuChevronDown className="sv-select-seta" />
              </label>

              <label className="sv-select">
                <LuClock />
                <span className="sv-oculto">Período</span>
                <select id="filtro-periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
                  <option>Últimos 30 dias</option>
                  <option>Últimos 7 dias</option>
                  <option>Hoje</option>
                </select>
                <LuChevronDown className="sv-select-seta" />
              </label>
            </div>

            <a
              href="/listar-solicitação-abrigo"
              className="sv-btn sv-btn--icone sv-anima pga-sino"
              aria-label={`${pendentesSolicitacoesAbrigo} solicitações de abrigo pendentes`}
              title="Solicitações de abrigo pendentes"
            >
              <span data-anim="toque"><LuBell /></span>
              {!carregando && pendentesSolicitacoesAbrigo > 0 && (
                <span className="pga-sino-badge">{pendentesSolicitacoesAbrigo}</span>
              )}
            </a>
          </div>
        </header>

        {carregando && <Esqueleto />}

        {!carregando && erro && (
          <section className="pga-erro sv-vidro" role="alert">
            <span className="sv-poco sv-poco--g sv-poco--sirene"><LuWifiOff /></span>
            <h2>Não foi possível carregar o painel</h2>
            <p>{erro}</p>
            <button type="button" className="sv-btn sv-btn--primario sv-anima" onClick={carregarDados}>
              <span data-anim="volta"><LuRefreshCw /></span>
              Tentar novamente
            </button>
          </section>
        )}

        {!carregando && !erro && (
          <>
            {/* ─── DESTAQUE: o que pede ação agora ─── */}
            <section className="pga-hero" aria-labelledby="pga-saudacao">

              <div className="pga-hero-texto">
                <p className="pga-data"><LuCalendarDays /> {dataDeHoje()}</p>
                <h2 id="pga-saudacao" className="pga-saudacao">{saudacao()}, equipe</h2>
                <p className="pga-resumo">
                  {pendencias > 0
                    ? 'Estas pendências esperam alguém da rede. Comece pelo que está em vermelho.'
                    : 'Nada pendente agora. Novas solicitações e alertas aparecem aqui assim que chegarem.'}
                </p>

                {pendencias > 0 && (
                  <div className="pga-chips">
                    {alertasEmVerificacao > 0 && (
                      <a href="/alertas" className="pga-chip pga-chip--sirene sv-anima">
                        <span className="sv-poco sv-poco--p sv-poco--sirene sv-poco--aceso"><span data-anim="sirene"><LuSiren /></span></span>
                        <strong>{alertasEmVerificacao}</strong>
                        {plural(alertasEmVerificacao, 'alerta em verificação', 'alertas em verificação')}
                      </a>
                    )}
                    {urgentesAjuda > 0 && (
                      <a href="/solicitacoes-ajuda" className="pga-chip pga-chip--sirene sv-anima">
                        <span className="sv-poco sv-poco--p sv-poco--sirene sv-poco--aceso"><span data-anim="oferta"><LuHandHeart /></span></span>
                        <strong>{urgentesAjuda}</strong>
                        {plural(urgentesAjuda, 'pedido de ajuda urgente', 'pedidos de ajuda urgentes')}
                      </a>
                    )}
                    {pendentesSolicitacoesAbrigo > 0 && (
                      <a href="/listar-solicitação-abrigo" className="pga-chip sv-anima">
                        <span className="sv-poco sv-poco--p sv-poco--azul"><span data-anim="pulo"><LuClipboardList /></span></span>
                        <strong>{pendentesSolicitacoesAbrigo}</strong>
                        {plural(pendentesSolicitacoesAbrigo, 'abrigo a aprovar', 'abrigos a aprovar')}
                      </a>
                    )}
                  </div>
                )}
              </div>

              <Pendencias valor={pendencias} intensidade={intensidade} />
            </section>

            {/* ─── CARDS ─── */}
            <section className="pga-stats" aria-label="Resumo">
              {statCards.map(card => (
                <a
                  key={card.id}
                  href={card.href}
                  className={`pga-stat sv-neu sv-anima ${card.urgente ? 'pga-stat--urgente' : ''}`}
                >
                  <span className={`sv-poco sv-poco--${card.tom} ${card.urgente ? 'sv-poco--aceso' : ''}`}>
                    <span data-anim={card.anim}>{card.icon}</span>
                  </span>
                  <LuArrowUpRight className="pga-stat-seta" aria-hidden="true" />
                  <span className="pga-stat-valor"><Contador valor={card.value} /></span>
                  <span className="pga-stat-rotulo">{card.label}</span>
                  <span className="pga-stat-detalhe">
                    <span className={`pga-ponto ${card.urgente ? 'pga-ponto--vivo' : ''}`} />
                    {card.unread !== null && <strong>{card.unread}</strong>} {card.unreadLabel}
                  </span>
                </a>
              ))}
            </section>

            <div className="pga-conteudo">
              {/* ─── ATIVIDADES ─── */}
              <section className="pga-painel pga-atividades sv-vidro" aria-labelledby="pga-titulo-atividades">
                <div className="pga-painel-topo">
                  <h3 id="pga-titulo-atividades" className="pga-painel-titulo">
                    <span className="sv-poco sv-poco--p sv-poco--azul sv-poco--aceso"><LuActivity /></span>
                    Atividades recentes
                  </h3>
                  <div
                    className="sv-abas"
                    role="tablist"
                    aria-label="Filtrar atividades"
                    style={{ '--aba': indiceAba, '--abas': filters.length }}
                  >
                    <span className="sv-abas-marcador" aria-hidden="true" />
                    {filters.map(f => (
                      <button
                        key={f.id}
                        type="button"
                        role="tab"
                        className="sv-aba"
                        aria-selected={activeFilter === f.id}
                        onClick={() => setActiveFilter(f.id)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredActivities.length === 0 ? (
                  <div className="pga-vazio">
                    <span className="sv-poco sv-poco--g"><LuInbox /></span>
                    <p>Nenhuma atividade nesta aba ainda.</p>
                    <p className="pga-vazio-dica">Novos registros aparecem aqui assim que forem criados.</p>
                  </div>
                ) : (
                  // key muda com a aba → a lista remonta e as linhas entram de novo
                  <ul className="pga-lista" key={activeFilter}>
                    {filteredActivities.map((item, i) => (
                      <li className="pga-item sv-anima" key={item.id} style={{ '--i': i }}>
                        <span className={`sv-poco sv-poco--p sv-poco--aceso sv-tom--${item.tom}`}>
                          <span data-anim={item.anim}>{item.icon}</span>
                        </span>
                        <div className="pga-item-info">
                          <p className="pga-item-titulo">
                            <span>{item.title}</span>
                            {item.tag && <span className={`sv-tag sv-tag--${item.tag.tom}`}>{item.tag.texto}</span>}
                          </p>
                          <p className="pga-item-meta">
                            <span><LuMapPin /> {item.place || 'Local não informado'}</span>
                            <span><LuClock /> {item.time}</span>
                          </p>
                        </div>
                        <a href={item.href} className="sv-btn sv-btn--vidro pga-item-btn" aria-label={`${item.botao}: ${item.title}`}>
                          <span className="pga-item-btn-texto">{item.botao}</span>
                          <LuChevronRight className="sv-seta" />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Na aba "Todas" não há uma página única: no lugar do link, mostramos quantas existem */}
                {verTodas ? (
                  <a href={verTodas.href} className="sv-btn sv-btn--vidro pga-ver-todas">
                    {verTodas.label} <LuChevronRight className="sv-seta" />
                  </a>
                ) : activitiesData.length > filteredActivities.length && (
                  <p className="pga-contagem">
                    Mostrando as {filteredActivities.length} mais recentes de {activitiesData.length} atividades
                  </p>
                )}
              </section>

              <div className="pga-lateral">
                {/* ─── GRÁFICO ─── */}
                <section className="pga-painel pga-grafico sv-vidro" aria-labelledby="pga-titulo-grafico">
                  <div className="pga-grafico-topo">
                    <h3 id="pga-titulo-grafico" className="pga-painel-titulo">
                      <span className="sv-poco sv-poco--p sv-poco--sirene sv-poco--aceso"><LuChartBar /></span>
                      Pedidos de ajuda em aberto
                    </h3>
                    <div className="pga-grafico-sub">
                      <p className="pga-painel-sub">Por categoria</p>
                      <div className="pga-legenda" aria-hidden="true">
                        <span><i className="pga-legenda-cor pga-legenda-cor--urgente" /> Urgentes</span>
                        <span><i className="pga-legenda-cor" /> Demais</span>
                      </div>
                    </div>
                  </div>

                  <ul className="pga-barras">
                    {itensRequisitados.map(item => (
                      <li
                        className="pga-barra"
                        key={item.label}
                        tabIndex={0}
                        aria-label={`${item.label}: ${item.value} em aberto, ${item.urgentes} urgentes`}
                      >
                        <span className="pga-barra-rotulo">{item.label}</span>
                        <div className="pga-barra-trilho">
                          {item.value > 0 && (
                            <span className="pga-barra-cheio" style={{ width: `${(item.value / maxValue) * 100}%` }}>
                              {item.urgentes > 0 && (
                                <span className="pga-barra-urgente" style={{ flexGrow: item.urgentes }} />
                              )}
                              {item.value - item.urgentes > 0 && (
                                <span className="pga-barra-demais" style={{ flexGrow: item.value - item.urgentes }} />
                              )}
                            </span>
                          )}
                        </div>
                        <span className="pga-barra-valor">{item.value}</span>
                        <span className="pga-dica" aria-hidden="true">
                          {item.value} em aberto, {item.urgentes} {item.urgentes === 1 ? 'urgente' : 'urgentes'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>

                {/* ─── AÇÕES RÁPIDAS ─── */}
                <section className="pga-painel pga-atalhos sv-vidro" aria-labelledby="pga-titulo-atalhos">
                  <h3 id="pga-titulo-atalhos" className="pga-painel-titulo">
                    <span className="sv-poco sv-poco--p sv-poco--forte sv-poco--aceso"><LuZap /></span>
                    Ações rápidas
                  </h3>
                  <div className="pga-atalhos-grade">
                    {quickActions.map(action => (
                      <a key={action.id} href={action.href} className={`pga-atalho sv-anima sv-tom--${action.tom}`}>
                        <span className="pga-atalho-icone"><span data-anim={action.anim}>{action.icon}</span></span>
                        <span>{action.label}</span>
                      </a>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ─── PENDÊNCIAS: círculo com o número ──────────────────────────────
// O círculo escurece junto com o fundo conforme a quantidade.
// Com pendências, ganha anéis vermelhos que se expandem e um selo de alerta.
function Pendencias({ valor, intensidade }) {
  const mostrado = useContagem(valor)
  const temPendencia = valor > 0

  // Começa claro e escurece no primeiro frame (transição do CSS)
  const [tom, setTom] = useState(0)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setTom(intensidade))
    return () => cancelAnimationFrame(frame)
  }, [intensidade])

  return (
    <div className={`pga-pend ${temPendencia ? 'pga-pend--alerta' : ''}`}>
      <div className="pga-pend-caixa">
        {temPendencia && (
          <>
            <span className="pga-pend-onda" aria-hidden="true" />
            <span className="pga-pend-onda pga-pend-onda--2" aria-hidden="true" />
          </>
        )}
        <div className="pga-pend-circulo" style={{ '--escuro': tom }}>
          <span className="pga-pend-num" aria-hidden="true">{mostrado}</span>
          <span className="pga-pend-rotulo" aria-hidden="true">{valor === 1 ? 'pendência' : 'pendências'}</span>
          <span className="sv-oculto">{valor} {valor === 1 ? 'pendência' : 'pendências'}</span>
        </div>
        {temPendencia && (
          <span className="pga-pend-selo" aria-hidden="true"><LuTriangleAlert /></span>
        )}
      </div>

      <p className="pga-pend-aviso" role="status">
        {temPendencia
          ? <><LuTriangleAlert /> {valor === 1 ? 'Há uma pendência aguardando' : 'Há pendências aguardando'}</>
          : <><LuCircleCheck /> Nenhuma pendência</>}
      </p>
    </div>
  )
}

// ─── ESQUELETO: aparece enquanto a API responde ────────────────────
function Esqueleto() {
  return (
    <div className="pga-esqueleto" aria-busy="true" aria-label="Carregando o painel">
      <div className="sv-esqueleto pga-esq-hero" />
      <div className="pga-stats">
        {[0, 1, 2, 3, 4].map(i => <div key={i} className="sv-esqueleto pga-esq-card" />)}
      </div>
      <div className="pga-conteudo">
        <div className="sv-esqueleto pga-esq-painel" />
        <div className="pga-lateral">
          <div className="sv-esqueleto pga-esq-painel pga-esq-painel--curto" />
          <div className="sv-esqueleto pga-esq-painel pga-esq-painel--curto" />
        </div>
      </div>
    </div>
  )
}

// ─── CONTADOR: números sobem de 0 até o valor ao carregar ──────────
function Contador({ valor }) {
  return useContagem(valor)
}

function useContagem(valor, duracao = 900) {
  // Só anima números, e só para quem não pediu "reduzir movimento"
  const anima = typeof valor === 'number' && !prefereMenosMovimento()
  const [mostrado, setMostrado] = useState(0)

  useEffect(() => {
    if (!anima) return
    let frame
    const inicio = performance.now()
    const passo = (agora) => {
      const t = Math.min(1, (agora - inicio) / duracao)
      setMostrado(Math.round(valor * (1 - Math.pow(1 - t, 3))))
      if (t < 1) frame = requestAnimationFrame(passo)
    }
    frame = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(frame)
  }, [valor, anima, duracao])

  // Sem animação (texto como "—" ou movimento reduzido) mostra o valor direto
  return anima ? mostrado : valor
}

// ─── FUNÇÕES AUXILIARES ────────────────────────────────────────────

// Converte "2026-06-24T03:55:54.000Z" em "Há 15 min", "Há 2h", "Há 3 dias"
function formatarTempo(dataISO) {
  const agora = new Date()
  const data = new Date(dataISO)
  const diffMin = Math.floor((agora - data) / 1000 / 60)

  if (diffMin < 1)   return 'Agora mesmo'
  if (diffMin < 60)  return `Há ${diffMin} min`

  const diffHoras = Math.floor(diffMin / 60)
  if (diffHoras < 24) return `Há ${diffHoras}h`

  const diffDias = Math.floor(diffHoras / 24)
  return `Há ${diffDias} ${diffDias === 1 ? 'dia' : 'dias'}`
}

function saudacao() {
  const hora = new Date().getHours()
  if (hora >= 5 && hora < 12) return 'Bom dia'
  if (hora >= 12 && hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

// "terça-feira, 13 de outubro" → "Terça-feira, 13 de outubro"
function dataDeHoje() {
  const texto = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function plural(n, singular, varios) {
  return n === 1 ? singular : varios
}

function prefereMenosMovimento() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export default PgAdmGlass;
