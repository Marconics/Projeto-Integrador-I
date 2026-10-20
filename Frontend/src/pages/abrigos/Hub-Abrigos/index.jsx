// Hub de Abrigos (admin) — /abrigos
// Lista todos os abrigos com resumo da rede, busca, filtros e ordenação.
// Peças do tema (styles/sosvale-glass.css) + o que é só desta tela (./style.css).
// Os auxiliares de ocupação e filtros são os mesmos da tela de Abrigos do voluntário (utils/listagem.jsx).
import { useState, useEffect, useMemo, useCallback, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuBedDouble, LuChevronRight, LuChurch, LuClipboardList, LuDumbbell, LuHandHeart, LuHotel, LuHouse,
  LuLandmark, LuMapPin, LuPhone, LuPlus, LuSchool, LuSearch, LuSiren, LuSlidersHorizontal, LuTent,
  LuTriangleAlert, LuUser, LuUsers, LuWarehouse, LuX
} from 'react-icons/lu';

import SidebarGlass from '../../../components/SidebarGlass/SidebarGlass';
import '../../../styles/sosvale-glass.css';
import './style.css';
import { Esqueleto, ErroPagina, Vazio } from '../../../components/EstadosPagina';
import { LIMITES } from '../../../utils/campos';
import { API_URL } from '../../../services/api';
import {
  ESTRUTURAS, SITUACOES, ocupacaoDe, vagasDe, corOcupacao, passaSituacao, normalizar, plural
} from '../../../utils/listagem';

// Status cadastrado no abrigo → rótulo e etiqueta (sv-tag)
const STATUS_ABRIGO = {
  ativo:      { label: 'Ativo',      classe: 'sv-tag--ok' },
  manutencao: { label: 'Manutenção', classe: 'sv-tag--atencao' },
  desativado: { label: 'Desativado', classe: 'sv-tag--neutro' },
}

// Tipo do abrigo → nome para exibir e ícone da miniatura quando não há foto
const TIPOS = {
  'Escola':            { label: 'Escola',             icone: <LuSchool /> },
  'Ginásio':           { label: 'Ginásio',            icone: <LuDumbbell /> },
  'Igreja':            { label: 'Igreja',             icone: <LuChurch /> },
  'Hotel':             { label: 'Hotel',              icone: <LuHotel /> },
  'Pousada':           { label: 'Pousada',            icone: <LuHotel /> },
  'CentroCultural':    { label: 'Centro Cultural',    icone: <LuLandmark /> },
  'CentroComunitário': { label: 'Centro Comunitário', icone: <LuWarehouse /> },
  'Campo':             { label: 'Campo',              icone: <LuTent /> },
}
const tipoDe = (tipo) => TIPOS[tipo] ?? { label: tipo, icone: <LuHouse /> }

const ORDENACOES = [
  { valor: 'nome',    label: 'Nome (A–Z)' },
  { valor: 'vagas',   label: 'Mais vagas' },
  { valor: 'cheios',  label: 'Mais cheios' },
  { valor: 'pedidos', label: 'Mais pedidos de ajuda' },
]

// Rótulos curtos das abas no celular
const SITUACAO_CURTA = { todas: 'Todos', vagas: 'Vagas', quase: 'Quase', lotados: 'Lotados' }

const FILTROS_INICIAIS = {
  busca: '', cidade: '', tipo: '', status: '', situacao: 'todas',
  estruturas: [], comPedidos: false, emAlerta: false, ordem: 'nome',
}

// Celular (até 600px): os filtros extras abrem numa gaveta em vez de no painel
const CONSULTA_CELULAR = '(max-width: 600px)'
const assinarCelular = (avisar) => {
  const consulta = window.matchMedia(CONSULTA_CELULAR)
  consulta.addEventListener('change', avisar)
  return () => consulta.removeEventListener('change', avisar)
}
const ehCelular = () => window.matchMedia(CONSULTA_CELULAR).matches

// Foto pequena do abrigo; sem foto (ou se ela não carregar), o ícone do tipo
function Miniatura({ abrigo }) {
  const [falhou, setFalhou] = useState(false)
  if (abrigo.fotoAbrigo && !falhou) {
    return (
      <span className="sv-miniatura">
        <img src={abrigo.fotoAbrigo} alt="" width="60" height="60" loading="lazy" decoding="async" onError={() => setFalhou(true)} />
      </span>
    )
  }
  return <span className="sv-miniatura sv-miniatura--reserva" aria-hidden="true">{tipoDe(abrigo.tipoAbrigo).icone}</span>
}

const ListarAbrigos = () => {
  const navigate = useNavigate()
  const celular = useSyncExternalStore(assinarCelular, ehCelular, () => false)

  // ─── ESTADOS ─────────────────────────────────────────────────
  const [abrigos,        setAbrigos]        = useState([])
  const [pedidosAbertos, setPedidosAbertos] = useState({})   // abrigoId → nº de solicitações abertas
  const [filtros,        setFiltros]        = useState(FILTROS_INICIAIS)
  const [maisAberto,     setMaisAberto]     = useState(false) // "Mais filtros" (painel) / "Filtros" (gaveta no celular)
  const [carregando,     setCarregando]     = useState(true)
  const [erro,           setErro]           = useState(null)

  const mudarFiltro = (campo, valor) => setFiltros(f => ({ ...f, [campo]: valor }))
  const alternarFiltro = (campo, valor) => setFiltros(f => ({ ...f, [campo]: f[campo] === valor ? FILTROS_INICIAIS[campo] : valor }))

  const alternarEstrutura = (campo) => setFiltros(f => ({
    ...f,
    estruturas: f.estruturas.includes(campo) ? f.estruturas.filter(c => c !== campo) : [...f.estruturas, campo],
  }))

  // ─── BUSCA DE DADOS ──────────────────────────────────────────
  // Função própria para o botão "Tentar novamente" poder chamar de novo
  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const [resAbrigos, resSolicitacoes] = await Promise.all([
        fetch(`${API_URL}/api/abrigos/listar`),
        fetch(`${API_URL}/api/solicitacoes-ajuda/publico`),
      ])
      if (!resAbrigos.ok) throw new Error('Erro ao buscar abrigos')

      const dadosAbrigos = await resAbrigos.json()
      setAbrigos(dadosAbrigos.abrigos ?? [])

      // Quantas solicitações de ajuda abertas cada abrigo tem
      if (resSolicitacoes.ok) {
        const { solicitacoes = [] } = await resSolicitacoes.json()
        const contagem = {}
        for (const s of solicitacoes) {
          if (s.status === 'aberto') contagem[s.abrigoId] = (contagem[s.abrigoId] ?? 0) + 1
        }
        setPedidosAbertos(contagem)
      }
    } catch (err) {
      console.error('Erro ao carregar os abrigos:', err)
      setErro('O servidor não respondeu. Verifique a conexão e tente novamente.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // ─── OPÇÕES DOS SELECTS ──────────────────────────────────────
  const cidades = useMemo(() => [...new Set(abrigos.map(a => a.cidade))].sort(), [abrigos])
  const tipos   = useMemo(() => [...new Set(abrigos.map(a => a.tipoAbrigo).filter(Boolean))].sort(), [abrigos])

  // ─── FILTRAGEM E ORDENAÇÃO ───────────────────────────────────
  // Todos os filtros menos a situação (as abas mostram quantos há em cada situação)
  const abrigosBase = useMemo(() => {
    const termo = normalizar(filtros.busca.trim())
    return abrigos.filter(a => {
      if (termo && ![a.nome, a.bairro, a.endereco, a.cidade, a.responsavel].some(t => normalizar(t).includes(termo))) return false
      if (filtros.cidade && a.cidade !== filtros.cidade) return false
      if (filtros.tipo && a.tipoAbrigo !== filtros.tipo) return false
      if (filtros.status && a.status !== filtros.status) return false
      if (filtros.estruturas.some(campo => !a[campo])) return false
      if (filtros.comPedidos && !pedidosAbertos[a.id]) return false
      if (filtros.emAlerta && !a.statusAlerta) return false
      return true
    })
  }, [abrigos, filtros, pedidosAbertos])

  const abrigosFiltrados = useMemo(() => {
    const lista = abrigosBase.filter(a => passaSituacao(a, filtros.situacao))
    const ordenar = {
      nome:    (x, y) => x.nome.localeCompare(y.nome),
      vagas:   (x, y) => vagasDe(y) - vagasDe(x),
      cheios:  (x, y) => ocupacaoDe(y) - ocupacaoDe(x),
      pedidos: (x, y) => (pedidosAbertos[y.id] ?? 0) - (pedidosAbertos[x.id] ?? 0),
    }[filtros.ordem]
    return lista.sort(ordenar)
  }, [abrigosBase, filtros.situacao, filtros.ordem, pedidosAbertos])

  const filtrosAtivos =
    Boolean(filtros.busca || filtros.cidade || filtros.tipo || filtros.status || filtros.comPedidos || filtros.emAlerta) ||
    filtros.situacao !== 'todas' || filtros.estruturas.length > 0

  // Quantos filtros estão ligados dentro de "Mais filtros" (no celular, a cidade também fica lá)
  const filtrosExtras =
    [filtros.tipo, filtros.status, filtros.comPedidos, filtros.emAlerta, celular && filtros.cidade].filter(Boolean).length +
    filtros.estruturas.length

  // Filtros ligados, como etiquetas que removem o filtro ao clicar
  const etiquetasAtivas = [
    filtros.busca      && { id: 'busca',  label: `“${filtros.busca}”`, remover: () => mudarFiltro('busca', '') },
    filtros.cidade     && { id: 'cidade', label: filtros.cidade, remover: () => mudarFiltro('cidade', '') },
    filtros.tipo       && { id: 'tipo',   label: tipoDe(filtros.tipo).label, remover: () => mudarFiltro('tipo', '') },
    filtros.status     && { id: 'status', label: STATUS_ABRIGO[filtros.status]?.label ?? filtros.status, remover: () => mudarFiltro('status', '') },
    filtros.emAlerta   && { id: 'alerta', label: 'Em alerta', remover: () => mudarFiltro('emAlerta', false) },
    filtros.comPedidos && { id: 'pedidos', label: 'Com pedidos de ajuda', remover: () => mudarFiltro('comPedidos', false) },
    ...ESTRUTURAS.filter(e => filtros.estruturas.includes(e.campo))
      .map(e => ({ id: e.campo, label: e.label, remover: () => alternarEstrutura(e.campo) })),
  ].filter(Boolean)

  // ─── RESUMO (sobre todos os abrigos, sem filtro) ─────────────
  const ativos       = abrigos.filter(a => a.status === 'ativo')
  const totalVagas   = ativos.reduce((soma, a) => soma + vagasDe(a), 0)
  const totalPessoas = abrigos.reduce((soma, a) => soma + a.capacidadeOcupada, 0)
  const capacidade   = abrigos.reduce((soma, a) => soma + a.capacidadeTotal, 0)
  const lotados      = abrigos.filter(a => passaSituacao(a, 'lotados')).length
  const quaseLotados = abrigos.filter(a => passaSituacao(a, 'quase')).length
  const emAlerta     = abrigos.filter(a => a.statusAlerta).length
  const totalPedidos = Object.values(pedidosAbertos).reduce((soma, n) => soma + n, 0)

  // Clicar num card aplica (ou tira) o filtro correspondente
  const resumo = [
    {
      id: 'vagas', icone: <LuBedDouble />, anim: 'pulo', tom: 'azul', valor: totalVagas, label: 'Vagas livres',
      detalhe: `em ${plural(ativos.length, 'abrigo ativo', 'abrigos ativos')}`,
      ativo: filtros.situacao === 'vagas', aoClicar: () => alternarFiltro('situacao', 'vagas'),
    },
    {
      id: 'pessoas', icone: <LuUsers />, anim: 'pulo', tom: 'ciano', valor: totalPessoas, label: 'Pessoas acolhidas',
      detalhe: `${capacidade > 0 ? Math.round((totalPessoas / capacidade) * 100) : 0}% da capacidade total`,
      ativo: filtros.ordem === 'cheios', aoClicar: () => alternarFiltro('ordem', 'cheios'),
    },
    {
      id: 'lotados', icone: <LuHouse />, anim: 'pulso', tom: lotados > 0 ? 'sirene' : 'petroleo', valor: lotados, label: 'Lotados',
      detalhe: `+ ${plural(quaseLotados, 'quase lotado', 'quase lotados')}`, urgente: lotados > 0,
      ativo: filtros.situacao === 'lotados', aoClicar: () => alternarFiltro('situacao', 'lotados'),
    },
    {
      id: 'alerta', icone: <LuSiren />, anim: 'sirene', tom: emAlerta > 0 ? 'sirene' : 'petroleo', valor: emAlerta, label: 'Em alerta',
      detalhe: plural(totalPedidos, 'pedido de ajuda aberto', 'pedidos de ajuda abertos'), urgente: emAlerta > 0,
      ativo: filtros.emAlerta, aoClicar: () => mudarFiltro('emAlerta', !filtros.emAlerta),
    },
  ]

  const indiceAba = Math.max(0, SITUACOES.findIndex(s => s.valor === filtros.situacao))
  const contagemTexto = `${abrigosFiltrados.length === 1 ? 'abrigo encontrado' : 'abrigos encontrados'}`

  // ─── PEÇAS REPETIDAS (painel e gaveta) ───────────────────────
  const selectTipo = (id) => (
    <select id={id} className="sv-entrada ha-select" value={filtros.tipo} onChange={e => mudarFiltro('tipo', e.target.value)}>
      <option value="">Todos os tipos</option>
      {tipos.map(t => <option key={t} value={t}>{tipoDe(t).label}</option>)}
    </select>
  )
  const selectStatus = (id) => (
    <select id={id} className="sv-entrada ha-select" value={filtros.status} onChange={e => mudarFiltro('status', e.target.value)}>
      <option value="">Todos os status</option>
      {Object.entries(STATUS_ABRIGO).map(([valor, s]) => <option key={valor} value={valor}>{s.label}</option>)}
    </select>
  )
  const selectCidade = (id) => (
    <select id={id} className="sv-entrada ha-select" value={filtros.cidade} onChange={e => mudarFiltro('cidade', e.target.value)}>
      <option value="">Todas as cidades</option>
      {cidades.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  )
  const selectOrdem = (id) => (
    <select id={id} className="sv-entrada ha-select" value={filtros.ordem} onChange={e => mudarFiltro('ordem', e.target.value)}>
      {ORDENACOES.map(o => <option key={o.valor} value={o.valor}>Ordenar: {o.label}</option>)}
    </select>
  )
  const chipsSituacao = (
    <div className="ha-grupo" role="group" aria-label="Alerta e pedidos">
      <button type="button" className={`sv-chip${filtros.emAlerta ? ' sv-chip--ativo' : ''}`} aria-pressed={filtros.emAlerta}
        onClick={() => mudarFiltro('emAlerta', !filtros.emAlerta)}>
        <LuTriangleAlert /> Em alerta
      </button>
      <button type="button" className={`sv-chip${filtros.comPedidos ? ' sv-chip--ativo' : ''}`} aria-pressed={filtros.comPedidos}
        onClick={() => mudarFiltro('comPedidos', !filtros.comPedidos)}>
        <LuHandHeart /> Com pedidos de ajuda
      </button>
    </div>
  )
  const chipsEstrutura = (
    <div className="ha-grupo" role="group" aria-label="Estrutura">
      <span className="ha-grupo-rotulo" aria-hidden="true">Estrutura</span>
      {ESTRUTURAS.map(e => (
        <button key={e.campo} type="button" className={`sv-chip${filtros.estruturas.includes(e.campo) ? ' sv-chip--ativo' : ''}`}
          aria-pressed={filtros.estruturas.includes(e.campo)} onClick={() => alternarEstrutura(e.campo)}>
          {e.icone} {e.label}
        </button>
      ))}
    </div>
  )

  const cabecalho = (
    <header className="sv-topo">
      <div className="sv-topo-texto">
        <p className="sv-trilha"><a href="/pg_adm">Visão geral</a> &gt; <span>Abrigos</span></p>
        <h1 className="sv-titulo">Abrigos</h1>
        <p className="sv-subtitulo">
          {carregando || erro
            ? 'Abrigos da rede, ocupação e o que cada um precisa'
            : `${plural(abrigos.length, 'abrigo cadastrado', 'abrigos cadastrados')} · ocupação e o que cada um precisa`}
        </p>
      </div>
      <div className="sv-topo-acoes">
        <button type="button" className="sv-btn sv-btn--vidro sv-anima" onClick={() => navigate('/listar-solicitação-abrigo')}>
          <span data-anim="pulo"><LuClipboardList /></span> Solicitações de abrigo
        </button>
        <button type="button" className="sv-btn sv-btn--primario sv-anima" onClick={() => navigate('/cadastrar-abrigos')}>
          <span data-anim="giro"><LuPlus /></span> Novo abrigo
        </button>
      </div>
    </header>
  )

  // ─── TELA DE CARREGANDO / ERRO ───────────────────────────────
  if (carregando || erro) {
    return (
      <div className="sv-app sv-pagina">
        <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
        <SidebarGlass ativo="abrigos" />
        <main className="sv-main">
          {cabecalho}
          {carregando ? (
            <div className="sv-esq-pilha">
              <Esqueleto forma="lista" resumo={4} linhas={1} />
              <Esqueleto forma="cards" linhas={6} />
            </div>
          ) : (
            <ErroPagina titulo="Não foi possível carregar os abrigos" mensagem={erro} onTentar={carregar} />
          )}
        </main>
      </div>
    )
  }

  return (
    <div className="sv-app sv-pagina">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
      <SidebarGlass ativo="abrigos" />

      <main className="sv-main">

        {cabecalho}

        {/* ── RESUMO DA REDE ── */}
        <section className="sv-resumo" aria-label="Resumo da rede">
          {resumo.map(card => (
            <button
              key={card.id}
              type="button"
              className={`sv-resumo-card sv-anima${card.urgente ? ' sv-resumo-card--urgente' : ''}${card.ativo ? ' sv-resumo-card--ativo' : ''}`}
              aria-pressed={card.ativo}
              onClick={card.aoClicar}
            >
              <span className={`sv-poco sv-poco--${card.tom}${card.urgente ? ' sv-poco--aceso' : ''}`}>
                <span data-anim={card.anim}>{card.icone}</span>
              </span>
              <span className="sv-resumo-valor">{card.valor}</span>
              <span className="sv-resumo-rotulo">{card.label}</span>
              <span className="sv-resumo-detalhe">{card.detalhe}</span>
            </button>
          ))}
        </section>

        {/* ── FILTROS ── */}
        <section className="sv-vidro sv-painel ha-filtros" aria-label="Filtros">
          <div className="ha-linha">
            <label htmlFor="busca-abrigo" className="sv-oculto">Buscar abrigo</label>
            <span className="sv-campo-icone ha-busca">
              <LuSearch />
              <input
                id="busca-abrigo"
                type="search"
                className="sv-entrada"
                placeholder="Buscar nome, bairro, responsável..."
                maxLength={LIMITES.busca}
                value={filtros.busca}
                onChange={e => mudarFiltro('busca', e.target.value)}
              />
            </span>
            <label htmlFor="filtro-cidade" className="sv-oculto">Cidade</label>
            {selectCidade('filtro-cidade')}
            <label htmlFor="filtro-ordem" className="sv-oculto">Ordenar por</label>
            {selectOrdem('filtro-ordem')}
            {/* No celular, o botão de filtros fica ao lado da busca */}
            <button type="button" className="sv-btn sv-btn--vidro ha-so-celular" aria-haspopup="dialog" onClick={() => setMaisAberto(true)}>
              <LuSlidersHorizontal /> Filtros
              {filtrosExtras > 0 && <span className="sv-btn-num">{filtrosExtras}</span>}
            </button>
          </div>

          <div className="ha-linha ha-linha--abas">
            <div className="sv-abas" role="tablist" aria-label="Situação" style={{ '--aba': indiceAba, '--abas': SITUACOES.length }}>
              <span className="sv-abas-marcador" aria-hidden="true" />
              {SITUACOES.map(s => (
                <button
                  key={s.valor}
                  type="button"
                  role="tab"
                  className="sv-aba"
                  aria-selected={filtros.situacao === s.valor}
                  onClick={() => mudarFiltro('situacao', s.valor)}
                >
                  <span className="ha-longo">{s.label}</span>
                  <span className="ha-curto">{SITUACAO_CURTA[s.valor]}</span>
                  <span className="sv-aba-num">{abrigosBase.filter(a => passaSituacao(a, s.valor)).length}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="sv-btn sv-btn--vidro ha-so-desktop"
              aria-expanded={maisAberto && !celular}
              aria-controls="mais-filtros"
              onClick={() => setMaisAberto(a => !a)}
            >
              <LuSlidersHorizontal /> Mais filtros
              {filtrosExtras > 0 && <span className="sv-btn-num">{filtrosExtras}</span>}
            </button>
          </div>

          {/* Mais filtros: no desktop abre aqui mesmo, no celular abre a gaveta */}
          {maisAberto && !celular && (
            <div id="mais-filtros" className="ha-mais">
              <div className="ha-linha">
                <label htmlFor="filtro-tipo" className="sv-oculto">Tipo de abrigo</label>
                {selectTipo('filtro-tipo')}
                <label htmlFor="filtro-status" className="sv-oculto">Status do abrigo</label>
                {selectStatus('filtro-status')}
                {chipsSituacao}
              </div>
              {chipsEstrutura}
            </div>
          )}

          <div className="ha-ativos">
            {etiquetasAtivas.length > 0 && <span className="sv-contagem">Filtros:</span>}
            {etiquetasAtivas.map(e => (
              <button key={e.id} type="button" className="sv-chip sv-chip--removivel" onClick={e.remover} aria-label={`Remover filtro ${e.label}`}>
                {e.label} <LuX aria-hidden="true" />
              </button>
            ))}
            {filtrosAtivos && (
              <button type="button" className="sv-link" onClick={() => setFiltros(FILTROS_INICIAIS)}>
                Limpar filtros
              </button>
            )}
            <span className="sv-contagem"><strong>{abrigosFiltrados.length}</strong> {contagemTexto}</span>
          </div>
        </section>

        {/* ── LISTA DE ABRIGOS ── */}
        {abrigosFiltrados.length === 0 ? (
          <Vazio
            icone={<LuHouse />}
            titulo={abrigos.length === 0 ? 'Nenhum abrigo cadastrado ainda.' : 'Nenhum abrigo encontrado com esses filtros.'}
            dica={abrigos.length === 0
              ? 'Os abrigos da rede aparecem aqui, com a ocupação e o que cada um precisa.'
              : 'Tente outra busca ou limpe os filtros para ver todos os abrigos.'}
            acao={abrigos.length === 0 ? (
              <button type="button" className="sv-btn sv-btn--primario" onClick={() => navigate('/cadastrar-abrigos')}>
                <LuPlus /> Cadastrar abrigo
              </button>
            ) : (
              <button type="button" className="sv-btn sv-btn--vidro" onClick={() => setFiltros(FILTROS_INICIAIS)}>
                <LuX /> Limpar filtros
              </button>
            )}
          />
        ) : (
          <section className="ha-grade" aria-label="Abrigos">
            {abrigosFiltrados.map((abrigo, i) => {
              const pct = ocupacaoDe(abrigo)
              const vagas = vagasDe(abrigo)
              const pedidos = pedidosAbertos[abrigo.id] ?? 0
              const estruturas = ESTRUTURAS.filter(e => abrigo[e.campo])
              const status = STATUS_ABRIGO[abrigo.status] ?? { label: abrigo.status, classe: 'sv-tag--neutro' }

              return (
                <article
                  key={abrigo.id}
                  className={`ha-card${abrigo.status === 'desativado' ? ' ha-card--apagado' : ''}`}
                  style={{ animationDelay: `${Math.min(i, 12) * 50}ms` }}
                >
                  {abrigo.statusAlerta && (
                    <div className="ha-card-alerta"><LuSiren aria-hidden="true" /> Em alerta no bairro</div>
                  )}

                  <div className="ha-card-topo">
                    <Miniatura abrigo={abrigo} />
                    <div className="ha-card-cabeca">
                      <div className="ha-card-linha">
                        <span className="ha-tipo">{tipoDe(abrigo.tipoAbrigo).label}</span>
                        <span className="sv-etiquetas">
                          {pct >= 100 && <span className="sv-tag sv-tag--lisa sv-tag--sirene">Lotado</span>}
                          {pct >= 80 && pct < 100 && <span className="sv-tag sv-tag--lisa sv-tag--atencao">Quase lotado</span>}
                          <span className={`sv-tag sv-tag--lisa ${status.classe}`}>{status.label}</span>
                        </span>
                      </div>
                      <h2 className="ha-card-nome">{abrigo.nome}</h2>
                    </div>
                  </div>

                  <div className="ha-local">
                    <p><LuMapPin aria-hidden="true" /> {abrigo.bairro ? `${abrigo.bairro}, ` : ''}{abrigo.cidade}/{abrigo.estado}</p>
                    <p className="ha-endereco">{abrigo.endereco}</p>
                  </div>

                  {/* Ocupação em destaque */}
                  <div className="ha-ocupacao">
                    <div className="ha-ocupacao-linha">
                      {vagas > 0
                        ? <span className="ha-vagas"><strong>{vagas}</strong> {vagas !== 1 ? 'vagas livres' : 'vaga livre'}</span>
                        : <span className="ha-sem-vagas">Sem vagas</span>}
                      <span className="ha-ocupacao-num" style={{ color: corOcupacao(pct) }}>
                        {abrigo.capacidadeOcupada}/{abrigo.capacidadeTotal} · {pct}%
                      </span>
                    </div>
                    <div className="sv-barra" role="img" aria-label={`Ocupação de ${pct}%`}>
                      <span style={{ width: `${pct}%`, background: corOcupacao(pct) }} />
                    </div>
                  </div>

                  {/* Estrutura e pedidos de ajuda */}
                  <div className="ha-card-extras">
                    {estruturas.length === 0
                      ? <span className="ha-sem-estrutura">Sem estrutura informada</span>
                      : (
                        <span className="ha-selos">
                          {estruturas.map(e => (
                            <span key={e.campo} className="ha-selo" title={e.label} role="img" aria-label={e.label}>{e.icone}</span>
                          ))}
                        </span>
                      )}
                    {pedidos > 0 && (
                      <button
                        type="button"
                        className="ha-pedidos"
                        title="Ver as solicitações de ajuda deste abrigo"
                        onClick={() => navigate(`/abrigos/${abrigo.id}/solicitacoes-ajuda`)}
                      >
                        <LuHandHeart aria-hidden="true" /> {plural(pedidos, 'pedido', 'pedidos')} <LuChevronRight aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  <div className="ha-divisor" />

                  <p className="ha-contato">
                    <LuUser aria-hidden="true" /> {abrigo.responsavel || 'Responsável não informado'}
                    {abrigo.telefone && <><span aria-hidden="true">·</span><LuPhone aria-hidden="true" /> {abrigo.telefone}</>}
                  </p>

                  <div className="ha-acoes">
                    <button type="button" className="sv-btn sv-btn--vidro" onClick={() => navigate(`/abrigos/${abrigo.id}/vitimas`)}>
                      <LuUsers /> Vítimas
                    </button>
                    <button type="button" className="sv-btn sv-btn--primario" onClick={() => navigate(`/detalhes-abrigos/${abrigo.id}`)}>
                      Ver detalhes
                    </button>
                  </div>
                </article>
              )
            })}
          </section>
        )}

        <footer className="sv-rodape">
          <p>© 2026 S.O.S Vale. Todos os direitos reservados.</p>
          <p>Versão 1.0.0</p>
        </footer>
      </main>

      {/* ── GAVETA DE FILTROS (celular) ── */}
      {maisAberto && celular && (
        <>
          <div className="sv-gaveta-fundo" onClick={() => setMaisAberto(false)} aria-hidden="true" />
          <div
            className="sv-gaveta sv-gaveta--baixo"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gaveta-filtros-titulo"
            onKeyDown={e => { if (e.key === 'Escape') setMaisAberto(false) }}
          >
            <div className="sv-gaveta-topo">
              <h2 id="gaveta-filtros-titulo" className="sv-painel-titulo">Filtros</h2>
              <button type="button" className="sv-btn sv-btn--quadrado sv-btn--vidro" aria-label="Fechar filtros" autoFocus onClick={() => setMaisAberto(false)}>
                <LuX />
              </button>
            </div>
            <div className="sv-gaveta-corpo">
              <div className="ha-gaveta-campos">
                <label htmlFor="gaveta-cidade">Cidade{selectCidade('gaveta-cidade')}</label>
                <label htmlFor="gaveta-ordem">Ordenar por{selectOrdem('gaveta-ordem')}</label>
                <label htmlFor="gaveta-tipo">Tipo{selectTipo('gaveta-tipo')}</label>
                <label htmlFor="gaveta-status">Status{selectStatus('gaveta-status')}</label>
              </div>
              {chipsSituacao}
              {chipsEstrutura}
            </div>
            <div className="sv-gaveta-rodape">
              <button type="button" className="sv-btn sv-btn--discreto" onClick={() => setFiltros(FILTROS_INICIAIS)}>Limpar</button>
              <button type="button" className="sv-btn sv-btn--primario" onClick={() => setMaisAberto(false)}>
                Ver {plural(abrigosFiltrados.length, 'abrigo', 'abrigos')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ListarAbrigos;
