// Hub de Abrigos (admin) — /abrigos
// Lista todos os abrigos com busca, filtros e ordenação (mesmo padrão da tela
// de Abrigos do voluntário — estilos em styles/listagem.css).
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { LuClipboardList, LuHandHeart, LuMapPin, LuPhone, LuPlus, LuSearch, LuTriangleAlert, LuUser, LuUsers, LuX } from 'react-icons/lu';

import "../../../styles/listagem.css";
import SidebarGlass from '../../../components/SidebarGlass/SidebarGlass';
import '../../../styles/sosvale-glass.css';
import { API_URL } from '../../../services/api';
import {
  ESTRUTURAS, SITUACOES, ocupacaoDe, vagasDe, corOcupacao, passaSituacao, normalizar, plural
} from '../../../utils/listagem';

// Status cadastrado no abrigo → rótulo e cor do selo
const STATUS_ABRIGO = {
  ativo:      { label: 'Ativo',      classe: 'lg-selo--verde' },
  manutencao: { label: 'Manutenção', classe: 'lg-selo--amarelo' },
  desativado: { label: 'Desativado', classe: 'lg-selo--vermelho' },
}

const ORDENACOES = [
  { valor: 'nome',    label: 'Nome (A–Z)' },
  { valor: 'vagas',   label: 'Mais vagas' },
  { valor: 'cheios',  label: 'Mais cheios' },
  { valor: 'pedidos', label: 'Mais pedidos de ajuda' },
]

const FILTROS_INICIAIS = {
  busca: '', cidade: '', tipo: '', status: '', situacao: 'todas',
  estruturas: [], comPedidos: false, emAlerta: false, ordem: 'nome',
}

const ListarAbrigos = () => {
  const navigate = useNavigate()

  // ─── ESTADOS ─────────────────────────────────────────────────
  const [abrigos,        setAbrigos]        = useState([])
  const [pedidosAbertos, setPedidosAbertos] = useState({})   // abrigoId → nº de solicitações abertas
  const [filtros,        setFiltros]        = useState(FILTROS_INICIAIS)
  const [carregando,     setCarregando]     = useState(true)
  const [erro,           setErro]           = useState(null)

  const mudarFiltro = (campo, valor) => setFiltros(f => ({ ...f, [campo]: valor }))

  const alternarEstrutura = (campo) => setFiltros(f => ({
    ...f,
    estruturas: f.estruturas.includes(campo) ? f.estruturas.filter(c => c !== campo) : [...f.estruturas, campo],
  }))

  // ─── BUSCA DE DADOS ──────────────────────────────────────────
  useEffect(() => {
    const carregar = async () => {
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
        setErro(err.message)
      } finally {
        setCarregando(false)
      }
    }
    carregar()
  }, [])

  // ─── OPÇÕES DOS SELECTS ──────────────────────────────────────
  const cidades = useMemo(() => [...new Set(abrigos.map(a => a.cidade))].sort(), [abrigos])
  const tipos   = useMemo(() => [...new Set(abrigos.map(a => a.tipoAbrigo).filter(Boolean))].sort(), [abrigos])

  // ─── FILTRAGEM E ORDENAÇÃO ───────────────────────────────────
  const abrigosFiltrados = useMemo(() => {
    const termo = normalizar(filtros.busca.trim())

    const lista = abrigos.filter(a => {
      if (termo && ![a.nome, a.bairro, a.endereco, a.cidade, a.responsavel].some(t => normalizar(t).includes(termo))) return false
      if (filtros.cidade && a.cidade !== filtros.cidade) return false
      if (filtros.tipo && a.tipoAbrigo !== filtros.tipo) return false
      if (filtros.status && a.status !== filtros.status) return false
      if (!passaSituacao(a, filtros.situacao)) return false
      if (filtros.estruturas.some(campo => !a[campo])) return false
      if (filtros.comPedidos && !pedidosAbertos[a.id]) return false
      if (filtros.emAlerta && !a.statusAlerta) return false
      return true
    })

    const ordenar = {
      nome:    (x, y) => x.nome.localeCompare(y.nome),
      vagas:   (x, y) => vagasDe(y) - vagasDe(x),
      cheios:  (x, y) => ocupacaoDe(y) - ocupacaoDe(x),
      pedidos: (x, y) => (pedidosAbertos[y.id] ?? 0) - (pedidosAbertos[x.id] ?? 0),
    }[filtros.ordem]

    return lista.sort(ordenar)
  }, [abrigos, filtros, pedidosAbertos])

  const filtrosAtivos =
    Boolean(filtros.busca || filtros.cidade || filtros.tipo || filtros.status || filtros.comPedidos || filtros.emAlerta) ||
    filtros.situacao !== 'todas' || filtros.estruturas.length > 0

  // Números do topo da lista (sobre todos os abrigos, sem filtro)
  const totalPessoas = abrigos.reduce((soma, a) => soma + a.capacidadeOcupada, 0)
  const totalVagas   = abrigos.filter(a => a.status === 'ativo').reduce((soma, a) => soma + vagasDe(a), 0)

  // ─── TELA DE CARREGANDO / ERRO ───────────────────────────────
  if (carregando || erro) {
    return (
      <div className="sv-app sv-pagina">
        <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
        <SidebarGlass ativo="abrigos" />
        <main className="sv-main pagina-listagem">
          <p className={erro ? 'lg-estado lg-estado--erro' : 'lg-estado'}>
            {erro ? `Não foi possível carregar os abrigos: ${erro}` : 'Carregando abrigos...'}
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="sv-app sv-pagina">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
      <SidebarGlass ativo="abrigos" />

      <main className="sv-main pagina-listagem">

        {/* ── CABEÇALHO ── */}
        <header className="lg-topo-linha">
          <div>
            <p className="sv-trilha">Abrigos &gt;</p>
            <h1 className="sv-titulo">Hub de Abrigos</h1>
            <p className="sv-subtitulo">
              {plural(abrigos.length, 'abrigo cadastrado', 'abrigos cadastrados')} · {plural(totalPessoas, 'pessoa acolhida', 'pessoas acolhidas')} · {plural(totalVagas, 'vaga livre', 'vagas livres')}
            </p>
          </div>
          <div className="lg-topo-acoes">
            <button className="lg-botao-secundario" onClick={() => navigate('/listar-solicitação-abrigo')}>
              <LuClipboardList /> Solicitações de abrigo
            </button>
            <button className="lg-botao-primario" onClick={() => navigate('/cadastrar-abrigos')}>
              <LuPlus /> Novo abrigo
            </button>
          </div>
        </header>

        {/* ── FILTROS ── */}
        <section className="lg-filtros">
          <div className="lg-filtros-linha">
            <div className="lg-busca">
              <LuSearch className="lg-busca-icone" />
              <input
                placeholder="Buscar nome, bairro, responsável..."
                value={filtros.busca}
                onChange={e => mudarFiltro('busca', e.target.value)}
              />
            </div>

            <select value={filtros.cidade} onChange={e => mudarFiltro('cidade', e.target.value)} aria-label="Cidade">
              <option value="">Todas as cidades</option>
              {cidades.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select value={filtros.tipo} onChange={e => mudarFiltro('tipo', e.target.value)} aria-label="Tipo de abrigo">
              <option value="">Todos os tipos</option>
              {tipos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <select value={filtros.status} onChange={e => mudarFiltro('status', e.target.value)} aria-label="Status do abrigo">
              <option value="">Todos os status</option>
              {Object.entries(STATUS_ABRIGO).map(([valor, s]) => <option key={valor} value={valor}>{s.label}</option>)}
            </select>

            <select value={filtros.ordem} onChange={e => mudarFiltro('ordem', e.target.value)} aria-label="Ordenar por">
              {ORDENACOES.map(o => <option key={o.valor} value={o.valor}>Ordenar: {o.label}</option>)}
            </select>
          </div>

          <div className="lg-filtros-linha">
            <span className="lg-filtro-rotulo">Situação</span>
            <div className="lg-chips" role="group" aria-label="Situação">
              {SITUACOES.map(s => (
                <button
                  key={s.valor}
                  className={`lg-chip${filtros.situacao === s.valor ? ' lg-chip--ativo' : ''}`}
                  onClick={() => mudarFiltro('situacao', s.valor)}
                >
                  {s.label}
                </button>
              ))}
              <button
                className={`lg-chip${filtros.emAlerta ? ' lg-chip--ativo' : ''}`}
                onClick={() => mudarFiltro('emAlerta', !filtros.emAlerta)}
              >
                <LuTriangleAlert /> Em alerta
              </button>
              <button
                className={`lg-chip${filtros.comPedidos ? ' lg-chip--ativo' : ''}`}
                onClick={() => mudarFiltro('comPedidos', !filtros.comPedidos)}
              >
                <LuHandHeart /> Com pedidos de ajuda
              </button>
            </div>
          </div>

          <div className="lg-filtros-linha">
            <span className="lg-filtro-rotulo">Estrutura</span>
            <div className="lg-chips" role="group" aria-label="Estrutura">
              {ESTRUTURAS.map(e => (
                <button
                  key={e.campo}
                  className={`lg-chip${filtros.estruturas.includes(e.campo) ? ' lg-chip--ativo' : ''}`}
                  onClick={() => alternarEstrutura(e.campo)}
                >
                  {e.icone} {e.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="lg-resultado">
          <span>
            <strong>{abrigosFiltrados.length}</strong> abrigo{abrigosFiltrados.length !== 1 ? 's' : ''} encontrado{abrigosFiltrados.length !== 1 ? 's' : ''}
          </span>
          {filtrosAtivos && (
            <button className="lg-limpar" onClick={() => setFiltros(FILTROS_INICIAIS)}>
              <LuX /> Limpar filtros
            </button>
          )}
        </div>

        {/* ── LISTA DE ABRIGOS ── */}
        {abrigosFiltrados.length === 0 ? (
          <p className="lg-vazio">
            {abrigos.length === 0 ? 'Nenhum abrigo cadastrado ainda.' : 'Nenhum abrigo encontrado com esses filtros.'}
          </p>
        ) : (
          <section className="lg-grade">
            {abrigosFiltrados.map(abrigo => {
              const pct = ocupacaoDe(abrigo)
              const vagas = vagasDe(abrigo)
              const pedidos = pedidosAbertos[abrigo.id] ?? 0
              const estruturas = ESTRUTURAS.filter(e => abrigo[e.campo])
              const status = STATUS_ABRIGO[abrigo.status] ?? { label: abrigo.status, classe: 'lg-selo--cinza' }

              return (
                <article key={abrigo.id} className="lg-card">
                  <div className="lg-card-topo">
                    <span className="lg-tipo">{abrigo.tipoAbrigo}</span>
                    <div className="lg-selos">
                      {abrigo.statusAlerta && <span className="lg-selo lg-selo--vermelho"><LuTriangleAlert /> Em alerta</span>}
                      <span className={`lg-selo ${status.classe}`}>{status.label}</span>
                    </div>
                  </div>

                  <h3 className="lg-card-nome" title={abrigo.nome}>{abrigo.nome}</h3>
                  <p className="lg-card-local">
                    <LuMapPin /> {abrigo.bairro ? `${abrigo.bairro}, ` : ''}{abrigo.cidade}/{abrigo.estado}
                  </p>
                  <p className="lg-card-endereco" title={abrigo.endereco}>{abrigo.endereco}</p>

                  <div className="lg-ocupacao">
                    <div className="lg-ocupacao-texto">
                      <span>{vagas > 0 ? `${vagas} vaga${vagas !== 1 ? 's' : ''} livre${vagas !== 1 ? 's' : ''}` : 'Sem vagas'}</span>
                      <strong style={{ color: corOcupacao(pct) }}>{abrigo.capacidadeOcupada}/{abrigo.capacidadeTotal} · {pct}%</strong>
                    </div>
                    <div className="lg-barra"><div style={{ width: `${pct}%`, background: corOcupacao(pct) }} /></div>
                  </div>

                  <div className="lg-card-infos">
                    <div className="lg-estruturas">
                      {estruturas.length === 0
                        ? <span className="lg-sem-estrutura">Sem estrutura informada</span>
                        : estruturas.map(e => <span key={e.campo} title={e.label}>{e.icone}</span>)}
                    </div>
                    {pedidos > 0 && (
                      <button
                        className="lg-pedidos"
                        title="Ver as solicitações de ajuda deste abrigo"
                        onClick={() => navigate(`/abrigos/${abrigo.id}/solicitacoes-ajuda`)}
                      >
                        <LuHandHeart /> {pedidos} pedido{pedidos !== 1 ? 's' : ''}
                      </button>
                    )}
                  </div>

                  <p className="lg-card-telefone">
                    <LuUser /> {abrigo.responsavel || 'Responsável não informado'}
                    {abrigo.telefone && <> · <LuPhone /> {abrigo.telefone}</>}
                  </p>

                  <div className="lg-card-acoes">
                    <button className="lg-botao-secundario" onClick={() => navigate(`/abrigos/${abrigo.id}/vitimas`)}>
                      <LuUsers /> Vítimas
                    </button>
                    <button className="lg-botao-card" onClick={() => navigate(`/detalhes-abrigos/${abrigo.id}`)}>
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
    </div>
  )
}

export default ListarAbrigos;
