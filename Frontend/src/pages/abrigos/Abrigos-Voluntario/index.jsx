// Abrigos (módulo Voluntário) — /voluntario/abrigos
// O voluntário encontra um abrigo (busca, filtros e ordenação) e se vincula
// a ele para ajudar. Só aparecem abrigos ativos.
import '../../../styles/listagem.css'
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuCheck, LuHandHeart, LuHouse, LuMapPin, LuPhone, LuSearch, LuX } from 'react-icons/lu';
import SidebarGlass from '../../../components/SidebarGlass/SidebarGlass';
import '../../../styles/sosvale-glass.css';
import { LIMITES } from '../../../utils/campos';
import { API_URL } from '../../../services/api';
import { alterarVinculoAbrigo } from '../../../services/voluntario';
import {
  ESTRUTURAS, SITUACOES, ocupacaoDe, vagasDe, corOcupacao, passaSituacao, normalizar
} from '../../../utils/listagem';

const ORDENACOES = [
  { valor: 'nome',   label: 'Nome (A–Z)' },
  { valor: 'vagas',  label: 'Mais vagas' },
  { valor: 'cheios', label: 'Mais cheios' },
  { valor: 'pedidos', label: 'Mais pedidos de ajuda' },
]

const FILTROS_INICIAIS = {
  busca: '', cidade: '', tipo: '', situacao: 'todas', estruturas: [], comPedidos: false, ordem: 'nome',
}

function AbrigosVoluntario() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token_voluntario')

  // ─── ESTADOS ─────────────────────────────────────────────────
  const [abrigos,        setAbrigos]        = useState([])
  const [pedidosAbertos, setPedidosAbertos] = useState({})   // abrigoId → nº de solicitações abertas
  const [meuAbrigoId,    setMeuAbrigoId]    = useState(null)
  const [filtros,        setFiltros]        = useState(FILTROS_INICIAIS)
  const [carregando,     setCarregando]     = useState(true)
  const [erro,           setErro]           = useState(null)
  const [vinculando,     setVinculando]     = useState(null)  // id do abrigo sendo salvo ('sair' = desvinculando)
  const [aviso,          setAviso]          = useState(null)  // { texto, erro }

  const mudarFiltro = (campo, valor) => setFiltros(f => ({ ...f, [campo]: valor }))

  const alternarEstrutura = (campo) => setFiltros(f => ({
    ...f,
    estruturas: f.estruturas.includes(campo) ? f.estruturas.filter(c => c !== campo) : [...f.estruturas, campo],
  }))

  // ─── BUSCA DE DADOS ──────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      navigate('/login-voluntario')
      return
    }

    const carregar = async () => {
      try {
        const [resAbrigos, resSolicitacoes, resVoluntario] = await Promise.all([
          fetch(`${API_URL}/api/abrigos/listar?status=ativo`),
          fetch(`${API_URL}/api/solicitacoes-ajuda/publico`),
          fetch(`${API_URL}/api/voluntarios/me`, { headers: { Authorization: `Bearer ${token}` } }),
        ])

        if (resVoluntario.status === 401) {
          navigate('/login-voluntario')
          return
        }
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

        if (resVoluntario.ok) {
          const { voluntario } = await resVoluntario.json()
          setMeuAbrigoId(voluntario.abrigo?.id_abrigo ?? null)
        }
      } catch (err) {
        setErro(err.message)
      } finally {
        setCarregando(false)
      }
    }
    carregar()
  }, [navigate, token])

  // ─── VINCULAR / DESVINCULAR ──────────────────────────────────
  async function alterarVinculo(abrigoId) {
    setVinculando(abrigoId ?? 'sair')
    setAviso(null)
    try {
      const dados = await alterarVinculoAbrigo(abrigoId)
      setMeuAbrigoId(dados.abrigo?.id_abrigo ?? null)
      setAviso({ texto: dados.mensagem })
    } catch (err) {
      setAviso({ texto: err.message, erro: true })
    } finally {
      setVinculando(null)
    }
  }

  // ─── OPÇÕES DOS SELECTS (a partir dos abrigos carregados) ────
  const cidades = useMemo(() => [...new Set(abrigos.map(a => a.cidade))].sort(), [abrigos])
  const tipos   = useMemo(() => [...new Set(abrigos.map(a => a.tipoAbrigo).filter(Boolean))].sort(), [abrigos])

  // ─── FILTRAGEM E ORDENAÇÃO ───────────────────────────────────
  const abrigosFiltrados = useMemo(() => {
    const termo = normalizar(filtros.busca.trim())

    const lista = abrigos.filter(a => {
      if (termo && ![a.nome, a.bairro, a.endereco, a.cidade].some(t => normalizar(t).includes(termo))) return false
      if (filtros.cidade && a.cidade !== filtros.cidade) return false
      if (filtros.tipo && a.tipoAbrigo !== filtros.tipo) return false
      if (!passaSituacao(a, filtros.situacao)) return false
      if (filtros.estruturas.some(campo => !a[campo])) return false
      if (filtros.comPedidos && !pedidosAbertos[a.id]) return false
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

  const meuAbrigo = abrigos.find(a => a.id === meuAbrigoId) ?? null

  const filtrosAtivos =
    Boolean(filtros.busca || filtros.cidade || filtros.tipo || filtros.comPedidos) ||
    filtros.situacao !== 'todas' || filtros.estruturas.length > 0

  // ─── TELA DE CARREGANDO / ERRO ───────────────────────────────
  if (carregando || erro) {
    return (
      <div className="sv-app sv-pagina">
        <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
        <SidebarGlass modulo="voluntario" ativo="abrigos" />
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
      <SidebarGlass modulo="voluntario" ativo="abrigos" />

      <main className="sv-main pagina-listagem">

        {/* ── CABEÇALHO ── */}
        <header className="lg-topo">
          <p className="sv-trilha">Abrigos &gt;</p>
          <h1 className="sv-titulo">Abrigos</h1>
          <p className="sv-subtitulo">Encontre um abrigo e vincule-se a ele para ajudar</p>
        </header>

        {/* ── MEU ABRIGO ── */}
        <section className={`lg-meu${meuAbrigo ? '' : ' lg-meu--vazio'}`}>
          {meuAbrigo ? (
            <>
              <div className="lg-meu-icone"><LuHouse /></div>
              <div className="lg-meu-info">
                <span className="lg-meu-rotulo">Meu abrigo</span>
                <strong>{meuAbrigo.nome}</strong>
                <span>
                  <LuMapPin /> {[meuAbrigo.endereco, meuAbrigo.bairro, meuAbrigo.cidade].filter(Boolean).join(' — ')}
                  {meuAbrigo.telefone && <> · <LuPhone /> {meuAbrigo.telefone}</>}
                </span>
              </div>
              <div className="lg-meu-acoes">
                <button className="lg-botao-secundario" onClick={() => navigate(`/solicitacoes-ajuda-voluntario?abrigo=${meuAbrigo.id}`)}>
                  <LuHandHeart /> Ver solicitações
                </button>
                <button className="lg-botao-sair" disabled={vinculando !== null} onClick={() => alterarVinculo(null)}>
                  {vinculando === 'sair' ? 'Saindo...' : 'Sair do abrigo'}
                </button>
              </div>
            </>
          ) : (
            <p><LuHouse /> Você ainda não está vinculado a nenhum abrigo. Escolha um abaixo e clique em <strong>Vincular</strong>.</p>
          )}
        </section>

        {aviso && (
          <p className={`lg-aviso${aviso.erro ? ' lg-aviso--erro' : ''}`}>
            {aviso.texto}
            <button aria-label="Fechar aviso" onClick={() => setAviso(null)}><LuX /></button>
          </p>
        )}

        {/* ── FILTROS ── */}
        <section className="lg-filtros">
          <div className="lg-filtros-linha">
            <div className="lg-busca">
              <LuSearch className="lg-busca-icone" />
              <input
                placeholder="Buscar por nome, bairro ou endereço..."
                aria-label="Buscar"
                maxLength={LIMITES.busca}
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
              <button
                className={`lg-chip${filtros.comPedidos ? ' lg-chip--ativo' : ''}`}
                onClick={() => mudarFiltro('comPedidos', !filtros.comPedidos)}
              >
                <LuHandHeart /> Com pedidos de ajuda
              </button>
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
            {abrigos.length === 0 ? 'Nenhum abrigo ativo cadastrado.' : 'Nenhum abrigo encontrado com esses filtros.'}
          </p>
        ) : (
          <section className="lg-grade">
            {abrigosFiltrados.map(abrigo => {
              const pct = ocupacaoDe(abrigo)
              const vagas = vagasDe(abrigo)
              const meu = abrigo.id === meuAbrigoId
              const pedidos = pedidosAbertos[abrigo.id] ?? 0
              const estruturas = ESTRUTURAS.filter(e => abrigo[e.campo])

              return (
                <article key={abrigo.id} className={`lg-card${meu ? ' lg-card--meu' : ''}`}>
                  <div className="lg-card-topo">
                    <span className="lg-tipo">{abrigo.tipoAbrigo}</span>
                    {meu && <span className="lg-selo-meu"><LuCheck /> Meu abrigo</span>}
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
                      <span className="lg-pedidos"><LuHandHeart /> {pedidos} pedido{pedidos !== 1 ? 's' : ''}</span>
                    )}
                  </div>

                  {abrigo.telefone && <p className="lg-card-telefone"><LuPhone /> {abrigo.telefone}</p>}

                  <div className="lg-card-acoes">
                    <button
                      className="lg-botao-secundario"
                      onClick={() => navigate(`/solicitacoes-ajuda-voluntario?abrigo=${abrigo.id}`)}
                    >
                      Ver solicitações
                    </button>
                    {meu ? (
                      <button className="lg-botao-vinculado" disabled>
                        <LuCheck /> Vinculado
                      </button>
                    ) : (
                      <button
                        className="lg-botao-vincular"
                        disabled={vinculando !== null}
                        onClick={() => alterarVinculo(abrigo.id)}
                      >
                        {vinculando === abrigo.id ? 'Salvando...' : meuAbrigoId ? 'Trocar para este' : 'Vincular'}
                      </button>
                    )}
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

export default AbrigosVoluntario
