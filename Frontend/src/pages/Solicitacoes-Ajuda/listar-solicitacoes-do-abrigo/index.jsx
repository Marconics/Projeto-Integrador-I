// Pedidos de ajuda de um abrigo (admin) — /abrigos/:id/solicitacoes-ajuda
// Resumo por status, abas com contagem, filtro por categoria e cards ordenados
// por urgência, com interessados e ações rápidas (iniciar atendimento / concluir).
// Peças do tema (styles/sosvale-glass.css) + o que é só desta tela (./style.css).
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LuCheck, LuChevronRight, LuCircleCheck, LuClock, LuHandHeart, LuPlay, LuPlus, LuUsers, LuX
} from 'react-icons/lu';
import SidebarGlass from '../../../components/SidebarGlass/SidebarGlass';
import '../../../styles/sosvale-glass.css';
import './style.css';
import { fetchAdmin, apiAdmin } from '../../../services/api';
import { Esqueleto, ErroPagina, Vazio } from '../../../components/EstadosPagina';
import { CATEGORIAS, urgenciaDe, statusPedidoDe, porUrgencia } from '../../../utils/pedidosAjuda';
import { plural } from '../../../utils/listagem';

const ABAS = [
  { valor: 'ativos',       label: 'Em aberto',    curto: 'Abertos' },   // aberto + em andamento
  { valor: 'concluido',    label: 'Concluídos',   curto: 'Concl.' },
  { valor: 'cancelado',    label: 'Cancelados',   curto: 'Canc.' },
  { valor: 'todos',        label: 'Todos',        curto: 'Todos' },
]
const passaAba = (pedido, aba) =>
  aba === 'todos' ? true
    : aba === 'ativos' ? pedido.status === 'aberto' || pedido.status === 'em_andamento'
    : pedido.status === aba

const ORDENACOES = [
  { valor: 'urgencia', label: 'Mais urgentes' },
  { valor: 'recentes', label: 'Mais recentes' },
]

// "hoje", "ontem", "há 3 dias"
const haQuanto = (data) => {
  const dias = Math.floor((Date.now() - new Date(data)) / 86400000)
  return dias <= 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`
}

// Próximo passo de cada status (ação rápida no card)
const PROXIMO = {
  aberto:       { status: 'em_andamento', label: 'Iniciar atendimento', icone: <LuPlay /> },
  em_andamento: { status: 'concluido',    label: 'Concluir',            icone: <LuCheck /> },
}

function SolicitacoesAjudaDoAbrigo() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [pedidos,    setPedidos]    = useState([])
  const [nomeAbrigo, setNomeAbrigo] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro,       setErro]       = useState(null)
  const [aba,        setAba]        = useState('ativos')
  const [categoria,  setCategoria]  = useState('')
  const [ordem,      setOrdem]      = useState('urgencia')
  const [salvando,   setSalvando]   = useState(null)   // id do pedido sendo atualizado
  const [aviso,      setAviso]      = useState(null)   // { texto, erro }

  // ─── Busca ──────────────────────────────────────────────────────────────────
  // Função própria para o botão "Tentar novamente" poder chamar de novo
  const buscar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const [resAbrigo, resPedidos] = await Promise.all([
        fetchAdmin(`/abrigos/listar/${id}`),
        fetchAdmin(`/solicitacoes-ajuda/abrigo/${id}`),
      ])
      if (!resAbrigo.ok) throw new Error(`Erro ${resAbrigo.status}`)
      if (!resPedidos.ok) throw new Error(`Erro ${resPedidos.status}`)
      setNomeAbrigo((await resAbrigo.json()).nome ?? '')
      setPedidos((await resPedidos.json()).solicitacoes ?? [])
    } catch (err) {
      console.error('Erro ao buscar os pedidos do abrigo:', err)
      setErro('O servidor não respondeu. Verifique a conexão e tente novamente.')
    } finally {
      setCarregando(false)
    }
  }, [id])

  useEffect(() => { buscar() }, [buscar])

  // ─── Ação rápida: muda o status no próprio card ─────────────────────────────
  async function avancar(pedido) {
    const proximo = PROXIMO[pedido.status]
    if (!proximo) return
    setSalvando(pedido.id_solicitacao)
    setAviso(null)
    try {
      await apiAdmin(`/solicitacoes-ajuda/atualizar/${pedido.id_solicitacao}`, { metodo: 'PUT', corpo: { status: proximo.status } })
      setPedidos(lista => lista.map(p => p.id_solicitacao === pedido.id_solicitacao ? { ...p, status: proximo.status } : p))
      setAviso({ texto: `“${pedido.titulo}” agora está ${statusPedidoDe(proximo.status).label.toLowerCase()}.` })
    } catch (err) {
      setAviso({ texto: err.message, erro: true })
    } finally {
      setSalvando(null)
    }
  }

  // ─── Derivações ─────────────────────────────────────────────────────────────
  const daCategoria = useMemo(() => pedidos.filter(p => !categoria || p.categoria === categoria), [pedidos, categoria])
  const lista = useMemo(() => {
    const filtrados = daCategoria.filter(p => passaAba(p, aba))
    return ordem === 'urgencia'
      ? [...filtrados].sort(porUrgencia)
      : [...filtrados].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [daCategoria, aba, ordem])

  const conta = (status) => pedidos.filter(p => p.status === status).length
  const ativos = pedidos.filter(p => passaAba(p, 'ativos'))
  const criticos = pedidos.filter(p => p.status === 'aberto' && p.urgencia === 'critica').length
  const interessados = ativos.reduce((soma, p) => soma + (p._count?.interesses ?? 0), 0)
  const categoriasUsadas = [...new Set(pedidos.map(p => p.categoria))]

  const resumo = [
    { id: 'aberto', icone: <LuHandHeart />, tom: criticos > 0 ? 'sirene' : 'azul', valor: conta('aberto'), label: 'Abertos',
      detalhe: criticos > 0 ? plural(criticos, 'crítico', 'críticos') : 'aguardando quem ajude', urgente: criticos > 0, aba: 'ativos', marca: true },
    { id: 'andamento', icone: <LuClock />, tom: 'ciano', valor: conta('em_andamento'), label: 'Em andamento',
      detalhe: 'alguém já está ajudando', aba: 'ativos' },
    { id: 'concluido', icone: <LuCircleCheck />, tom: 'anil', valor: conta('concluido'), label: 'Concluídos',
      detalhe: 'pedidos atendidos', aba: 'concluido', marca: true },
    { id: 'interessados', icone: <LuUsers />, tom: 'petroleo', valor: interessados, label: 'Voluntários interessados',
      detalhe: 'nos pedidos em aberto', aba: 'ativos' },
  ]

  const indiceAba = Math.max(0, ABAS.findIndex(a => a.valor === aba))

  const trilha = (
    <p className="sv-trilha">
      <a href="/abrigos">Abrigos</a> &gt;{' '}
      <a href={`/detalhes-abrigos/${id}`}>{nomeAbrigo || 'Abrigo'}</a> &gt; <span>Pedidos de ajuda</span>
    </p>
  )

  // ─── Carregando / erro ───────────────────────────────────────────────────────
  if (carregando || erro) {
    return (
      <div className="sv-app sv-pagina">
        <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
        <SidebarGlass ativo="abrigos" />
        <main className="sv-main">
          <header className="sv-topo">
            <div className="sv-topo-texto">
              {trilha}
              <h1 className="sv-titulo">Pedidos de ajuda</h1>
            </div>
          </header>
          {carregando ? (
            <div className="sv-esq-pilha">
              <Esqueleto forma="lista" resumo={4} linhas={1} />
              <Esqueleto forma="cards" linhas={4} />
            </div>
          ) : (
            <ErroPagina titulo="Não foi possível carregar os pedidos do abrigo" mensagem={erro} onTentar={buscar} />
          )}
        </main>
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="sv-app sv-pagina">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
      <SidebarGlass ativo="abrigos" />

      <main className="sv-main">
        <header className="sv-topo">
          <div className="sv-topo-texto">
            {trilha}
            <h1 className="sv-titulo">Pedidos de ajuda</h1>
            <p className="sv-subtitulo">{nomeAbrigo} · {plural(pedidos.length, 'pedido', 'pedidos')} no total</p>
          </div>
          <div className="sv-topo-acoes">
            <button type="button" className="sv-btn sv-btn--primario sv-anima" onClick={() => navigate(`/abrigos/${id}/cadastrar-solicitacao-ajuda`)}>
              <span data-anim="giro"><LuPlus /></span> Novo pedido
            </button>
          </div>
        </header>

        {/* ── RESUMO ── */}
        <section className="sv-resumo" aria-label="Resumo dos pedidos">
          {resumo.map(card => (
            <button
              key={card.id}
              type="button"
              className={`sv-resumo-card sv-anima${card.urgente ? ' sv-resumo-card--urgente' : ''}${card.marca && aba === card.aba ? ' sv-resumo-card--ativo' : ''}`}
              onClick={() => setAba(card.aba)}
            >
              <span className={`sv-poco sv-poco--${card.tom}${card.urgente ? ' sv-poco--aceso' : ''}`}>
                <span data-anim="pulo">{card.icone}</span>
              </span>
              <span className="sv-resumo-valor">{card.valor}</span>
              <span className="sv-resumo-rotulo">{card.label}</span>
              <span className="sv-resumo-detalhe">{card.detalhe}</span>
            </button>
          ))}
        </section>

        {/* ── FILTROS ── */}
        <section className="sv-vidro sv-painel sv-filtro-painel" aria-label="Filtros">
          <div className="sv-filtro-linha sv-filtro-linha--abas">
            <div className="sv-abas" role="tablist" aria-label="Situação" style={{ '--aba': indiceAba, '--abas': ABAS.length }}>
              <span className="sv-abas-marcador" aria-hidden="true" />
              {ABAS.map(a => (
                <button key={a.valor} type="button" role="tab" className="sv-aba" aria-selected={aba === a.valor} onClick={() => setAba(a.valor)}>
                  <span className="sv-rotulo-longo">{a.label}</span>
                  <span className="sv-rotulo-curto">{a.curto}</span>
                  <span className="sv-aba-num">{daCategoria.filter(p => passaAba(p, a.valor)).length}</span>
                </button>
              ))}
            </div>
            <div className="pa-selects">
              <label htmlFor="filtro-categoria" className="sv-oculto">Categoria</label>
              <select id="filtro-categoria" className="sv-entrada sv-filtro-select" value={categoria} onChange={e => setCategoria(e.target.value)}>
                <option value="">Todas as categorias</option>
                {categoriasUsadas.map(c => <option key={c} value={c}>{CATEGORIAS[c] ?? c}</option>)}
              </select>
              <label htmlFor="filtro-ordem" className="sv-oculto">Ordenar por</label>
              <select id="filtro-ordem" className="sv-entrada sv-filtro-select" value={ordem} onChange={e => setOrdem(e.target.value)}>
                {ORDENACOES.map(o => <option key={o.valor} value={o.valor}>Ordenar: {o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="sv-filtro-ativos">
            {categoria && (
              <button type="button" className="sv-chip sv-chip--removivel" onClick={() => setCategoria('')} aria-label={`Remover filtro ${CATEGORIAS[categoria]}`}>
                {CATEGORIAS[categoria] ?? categoria} <LuX aria-hidden="true" />
              </button>
            )}
            <span className="sv-contagem"><strong>{lista.length}</strong> {lista.length === 1 ? 'pedido' : 'pedidos'}</span>
          </div>
        </section>

        {aviso && (
          <p className={`sv-aviso ${aviso.erro ? 'sv-aviso--erro' : 'sv-aviso--sucesso'}`} role={aviso.erro ? 'alert' : 'status'}>
            {aviso.texto}
          </p>
        )}

        {/* ── PEDIDOS ── */}
        {lista.length === 0 ? (
          <Vazio
            icone={<LuHandHeart />}
            titulo={pedidos.length === 0 ? 'Este abrigo ainda não tem pedidos de ajuda.' : 'Nenhum pedido com esses filtros.'}
            dica={pedidos.length === 0
              ? 'Crie um pedido quando o abrigo precisar de doações, medicamentos, voluntários ou reparos.'
              : 'Troque a aba ou a categoria para ver os outros pedidos.'}
            acao={pedidos.length === 0 && (
              <button type="button" className="sv-btn sv-btn--primario" onClick={() => navigate(`/abrigos/${id}/cadastrar-solicitacao-ajuda`)}>
                <LuPlus /> Novo pedido
              </button>
            )}
          />
        ) : (
          <section className="pa-grade" aria-label="Pedidos de ajuda">
            {lista.map((p, i) => {
              const urg = urgenciaDe(p.urgencia)
              const st = statusPedidoDe(p.status)
              const proximo = PROXIMO[p.status]
              const encerrado = p.status === 'concluido' || p.status === 'cancelado'
              return (
                <article
                  key={p.id_solicitacao}
                  className={`pa-card pa-card--${p.urgencia}${encerrado ? ' pa-card--encerrado' : ''}`}
                  style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                >
                  <div className="pa-card-topo">
                    <span className={`sv-tag sv-tag--lisa ${urg.classe}`}>{urg.label}</span>
                    <span className="pa-categoria">{CATEGORIAS[p.categoria] ?? p.categoria}</span>
                    <span className={`sv-tag sv-tag--lisa ${st.classe}`}>{st.label}</span>
                  </div>

                  <h2 className="pa-titulo">{p.titulo}</h2>
                  {p.descricao && <p className="pa-descricao">{p.descricao}</p>}

                  <p className="pa-meta">
                    <span className={p._count?.interesses > 0 ? 'pa-interessados' : ''}>
                      <LuUsers aria-hidden="true" /> {p._count?.interesses > 0 ? plural(p._count.interesses, 'voluntário interessado', 'voluntários interessados') : 'Nenhum interessado ainda'}
                    </span>
                    <span>Criado {haQuanto(p.createdAt)}{p.criadoPor?.nome ? ` por ${p.criadoPor.nome}` : ''}</span>
                    {p.voluntario?.nome && <span>Atendido por {p.voluntario.nome}</span>}
                  </p>

                  <div className="pa-acoes">
                    {proximo && (
                      <button type="button" className="sv-btn sv-btn--vidro" disabled={salvando !== null} onClick={() => avancar(p)}>
                        {proximo.icone} {salvando === p.id_solicitacao ? 'Salvando...' : proximo.label}
                      </button>
                    )}
                    <button type="button" className="sv-btn sv-btn--primario" onClick={() => navigate(`/visualizar-solicitacao-ajuda/${p.id_solicitacao}`)}>
                      Ver detalhes <LuChevronRight />
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
    </div>
  )
}

export default SolicitacoesAjudaDoAbrigo
