// ─── Imports ──────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LuBuilding2, LuHandHeart, LuHeart, LuPhone, LuX } from 'react-icons/lu';
import SidebarGlass from '../../../components/SidebarGlass/SidebarGlass';
import '../../../styles/sosvale-glass.css';

// ─── Badges e labels ──────────────────────────────────────────────────────────
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

const CATEGORIAS = ['todas', 'doacao', 'medicamento', 'voluntariado', 'infraestrutura', 'outro']

// TODO: substituir pelo id real do voluntário logado (contexto de auth / JWT)
const VOLUNTARIO_LOGADO_ID = 1


// ─── Componente principal ─────────────────────────────────────────────────────
function SolicitacoesAjudaVoluntario() {


  const [solicitacoes, setSolicitacoes]   = useState([])
  const [carregando, setCarregando]       = useState(true)
  const [filtroCategoria, setFiltroCategoria] = useState('todas')

  // ?abrigo=ID na URL (vindo do "Quero ajudar" do painel) mostra só as solicitações daquele abrigo
  const [parametros, setParametros] = useSearchParams()
  const filtroAbrigo = Number(parametros.get('abrigo')) || null

  // Guarda os IDs das solicitações em que o voluntário marcou interesse
  const [interesses, setInteresses]       = useState(new Set())
  const [carregandoInteresse, setCarregandoInteresse] = useState(null) // id sendo processado

  // ─── Busca — só solicitações abertas ou em andamento ────────────────────────
  useEffect(() => {
    const buscar = async () => {
      try {
        // Rota pública — já filtra status aberto/em_andamento no backend
        const res = await fetch('http://localhost:3000/api/solicitacoes-ajuda/publico')
        const dados = await res.json()
        setSolicitacoes(dados.solicitacoes ?? [])

        // Busca os interesses já marcados pelo voluntário logado
        const resInt = await fetch(
          `http://localhost:3000/api/solicitacoes-ajuda/meus-interesses?voluntarioId=${VOLUNTARIO_LOGADO_ID}`
        )
        const dadosInt = await resInt.json()
        const ids = new Set((dadosInt.interesses ?? []).map(i => i.solicitacaoId))
        setInteresses(ids)
      } catch (err) {
        console.error('Erro ao buscar solicitações:', err)
      } finally {
        setCarregando(false)
      }
    }
    buscar()
  }, [])

  // ─── Marcar / desmarcar interesse ───────────────────────────────────────────
  const handleInteresse = async (solicitacaoId) => {
    setCarregandoInteresse(solicitacaoId)
    const jaTemInteresse = interesses.has(solicitacaoId)

    // Atualiza o estado local imediatamente (optimistic update)
    setInteresses(prev => {
      const novo = new Set(prev)
      jaTemInteresse ? novo.delete(solicitacaoId) : novo.add(solicitacaoId)
      return novo
    })

    try {
      // Rota do backend é /interesse/:id (id da solicitação vem depois de "interesse")
      const resposta = await fetch(`http://localhost:3000/api/solicitacoes-ajuda/interesse/${solicitacaoId}`, {
        method: jaTemInteresse ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voluntarioId: VOLUNTARIO_LOGADO_ID }),
      })

      if (!resposta.ok) {
        const d = await resposta.json()
        throw new Error(d.mensagem ?? 'Erro ao registrar interesse.')
      }
    } catch (err) {
      // Reverte se a API falhar
      console.error('Erro ao registrar interesse:', err)
      setInteresses(prev => {
        const revertido = new Set(prev)
        jaTemInteresse ? revertido.add(solicitacaoId) : revertido.delete(solicitacaoId)
        return revertido
      })
    } finally {
      setCarregandoInteresse(null)
    }
  }

  // ─── Filtro ──────────────────────────────────────────────────────────────────
  const lista = solicitacoes
    .filter(s => filtroCategoria === 'todas' || s.categoria === filtroCategoria)
    .filter(s => !filtroAbrigo || s.abrigoId === filtroAbrigo)

  const abrigoFiltrado = filtroAbrigo ? solicitacoes.find(s => s.abrigoId === filtroAbrigo)?.abrigo : null

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (carregando) {
    return (
      <div className="sv-app sv-pagina">
        <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
        <SidebarGlass modulo="voluntario" ativo="ajuda" />
        <main className="sv-main">
          <p className="sv-vazio">Carregando solicitações...</p>
        </main>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="sv-app sv-pagina">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
      <SidebarGlass modulo="voluntario" ativo="ajuda" />

      <main className="sv-main">

        {/* Header */}
        <header className="sv-topo">
          <div className="sv-topo-texto">
            <p className="sv-trilha">
              Voluntário &gt; Solicitações de Ajuda
            </p>
            <h1 className="sv-titulo">
              Solicitações de Ajuda
            </h1>
            <p className="sv-subtitulo">
              Veja os pedidos dos abrigos e indique interesse em ajudar
            </p>
          </div>
        </header>

        {/* Painel */}
        <div className="sv-vidro sv-painel">

          {/* Filtros por categoria */}
          <div className="sv-filtros">
            <div className="sv-chips" role="group" aria-label="Filtrar por categoria">
              {CATEGORIAS.map(c => (
                <button
                  key={c}
                  onClick={() => setFiltroCategoria(c)}
                  className={`sv-chip${filtroCategoria === c ? ' sv-chip--ativo' : ''}`}
                  aria-pressed={filtroCategoria === c}
                >
                  {c === 'todas' ? 'Todas' : categoriaLabel[c]}
                </button>
              ))}

              {/* Filtro de abrigo vindo do painel — dá para remover */}
              {filtroAbrigo && (
                <button
                  onClick={() => setParametros({})}
                  title="Mostrar todos os abrigos"
                  className="sv-chip sv-chip--removivel"
                >
                  Abrigo: {abrigoFiltrado?.nome ?? `#${filtroAbrigo}`} <LuX aria-hidden="true" />
                </button>
              )}
            </div>

            <span className="sv-contagem">
              {lista.length} solicitaç{lista.length !== 1 ? 'ões' : 'ão'}
            </span>
          </div>

          {/* Lista vazia */}
          {lista.length === 0 ? (
            <div className="sv-vazio">
              <LuHandHeart />
              <p>Nenhuma solicitação aberta no momento.</p>
            </div>
          ) : (

            /* Grid de cards */
            <div className="sv-grade">
              {lista.map(s => {
                const urgBadge = badgeUrgencia[s.urgencia] ?? { label: s.urgencia, bg: 'var(--sv-fundo-suave)', cor: 'var(--sv-tinta-2)' }
                const temInteresse = interesses.has(s.id_solicitacao)
                const processando = carregandoInteresse === s.id_solicitacao

                return (
                  <div
                    key={s.id_solicitacao}
                    className={`sv-card sv-card--branco sv-pilha${temInteresse ? ' sv-card--marcado' : ''}`}
                  >
                    {/* Topo: ícone + título + badges */}
                    <div className="sv-card-topo">
                      <span className="sv-poco sv-poco--p sv-poco--aceso sv-poco--ciano">
                        <LuHandHeart />
                      </span>
                      <div className="sv-linha-info">
                        <p className="sv-linha-titulo">
                          {s.titulo}
                        </p>
                        <div className="sv-etiquetas">
                          <span className="sv-tag sv-tag--lisa" style={{ background: urgBadge.bg, color: urgBadge.cor }}>
                            {urgBadge.label}
                          </span>
                          <span className="sv-tag sv-tag--lisa sv-tag--neutro">
                            {categoriaLabel[s.categoria] ?? s.categoria}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Descrição resumida */}
                    <p className="sv-apoio sv-tres-linhas">
                      {s.descricao}
                    </p>

                    {/* Abrigo */}
                    {s.abrigo && (
                      <div className="sv-apoio sv-apoio--icone">
                        <LuBuilding2 />
                        <strong>{s.abrigo.nome}</strong>
                        {s.abrigo.cidade && (
                          <span>— {s.abrigo.cidade}/{s.abrigo.estado}</span>
                        )}
                      </div>
                    )}

                    {/* Contato do abrigo */}
                    {s.abrigo?.telefone && (
                      <div className="sv-apoio sv-apoio--icone">
                        <LuPhone />
                        <a className="sv-link" href={`tel:${s.abrigo.telefone}`}>
                          {s.abrigo.telefone}
                        </a>
                      </div>
                    )}

                    {/* Rodapé do card: interesse + data */}
                    <div className="sv-card-rodape">

                      {/* Data */}
                      <span className="sv-campo-ajuda">
                        {new Date(s.createdAt).toLocaleDateString('pt-BR')}
                      </span>

                      {/* Botão de interesse */}
                      <button
                        onClick={() => handleInteresse(s.id_solicitacao)}
                        disabled={processando}
                        className={`sv-btn sv-btn--p ${temInteresse ? 'sv-btn--primario' : 'sv-btn--vidro'}`}
                        aria-pressed={temInteresse}
                      >
                        {temInteresse
                          ? <><LuHeart fill="currentColor" /> Tenho interesse</>
                          : <><LuHeart /> Quero ajudar</>
                        }
                      </button>

                    </div>
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

export default SolicitacoesAjudaVoluntario