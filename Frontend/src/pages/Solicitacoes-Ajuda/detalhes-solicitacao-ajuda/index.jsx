// ─── Imports ──────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LuBan, LuBuilding2, LuCircleCheck, LuClock, LuPhone, LuTrash2 } from 'react-icons/lu';
import SidebarGlass from '../../../components/SidebarGlass/SidebarGlass';
import '../../../styles/sosvale-glass.css';
import { fetchAdmin } from '../../../services/api';
import { LIMITES } from '../../../utils/campos';
import { Opcional, ContadorCaracteres } from '../../../components/MarcasCampo';

// ─── Badges e labels ──────────────────────────────────────────────────────────
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

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const Sidebar = () => (
  <SidebarGlass ativo="solicitacoes-ajuda" />
)

// ─── Componente principal ─────────────────────────────────────────────────────
function DetalhesSolicitacaoAjuda() {

  const { id } = useParams()   // id da solicitação
  const navigate = useNavigate()

  const [dados, setDados]                 = useState(null)
  const [carregando, setCarregando]       = useState(true)
  const [salvando, setSalvando]           = useState(false)
  const [erro, setErro]                   = useState(null)

  // ─── Modal de fechar/cancelar ────────────────────────────────────────────────
  // tipo: 'concluir' | 'cancelar' | null
  const [modal, setModal]                 = useState(null)
  const [observacao, setObservacao]       = useState('')
  // voluntario selecionado ao concluir (id ou 'anonimo' ou '')
  const [voluntarioId, setVoluntarioId]   = useState('')
  const [voluntarios, setVoluntarios]     = useState([])

  // ─── Busca ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const buscar = async () => {
      try {
        // Rota do backend é /listar/:id, não /:id
        const res = await fetchAdmin(`/solicitacoes-ajuda/listar/${id}`)
        const d = await res.json()
        setDados(d.solicitacao ?? d)

        // Busca lista de voluntários para o select de "quem atendeu"
        const resVol = await fetchAdmin('/voluntarios/listar')
        const dVol = await resVol.json()
        setVoluntarios(dVol.voluntarios ?? [])
      } catch (err) {
        console.error('Erro ao buscar dados:', err)
        setErro('Não foi possível carregar a solicitação.')
      } finally {
        setCarregando(false)
      }
    }
    buscar()
  }, [id])

  // ─── Atualizar status ────────────────────────────────────────────────────────
  const handleAtualizarStatus = async (novoStatus) => {
    setSalvando(true)
    setErro(null)
    try {
      const body = {
        status: novoStatus,
        observacaoFechamento: observacao.trim() || null,
        // Só envia voluntarioId se for concluir e o ADM tiver selecionado alguém
        ...(novoStatus === 'concluido' && voluntarioId && voluntarioId !== 'anonimo'
          ? { voluntarioId: Number(voluntarioId) }
          : {}),
      }

      // Rota do backend é PUT /atualizar/:id, não PATCH /:id
      const res = await fetchAdmin(`/solicitacoes-ajuda/atualizar/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.mensagem ?? 'Erro ao atualizar.')
      }

      const atualizado = await res.json()
      setDados(atualizado.solicitacao ?? atualizado)
      setModal(null)
      setObservacao('')
      setVoluntarioId('')
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  // ─── Excluir ─────────────────────────────────────────────────────────────────
  const handleExcluir = async () => {
    if (!confirm('Tem certeza que deseja apagar esta solicitação? Esta ação não pode ser desfeita.')) return
    try {
      // Rota do backend é DELETE /excluir/:id, não DELETE /:id
      const resposta = await fetchAdmin(`/solicitacoes-ajuda/excluir/${id}`, { method: 'DELETE' })
      // Só sai da tela se a API excluiu de verdade
      if (!resposta.ok) {
        const d = await resposta.json().catch(() => ({}))
        alert(d.mensagem ?? 'Não foi possível excluir a solicitação.')
        return
      }
      navigate(`/abrigos/${dados.abrigoId}/solicitacoes-ajuda`)
    } catch (err) {
      console.error('Erro ao excluir:', err)
    }
  }

  // ─── Loading / erro ───────────────────────────────────────────────────────────
  if (carregando) {
    return (
      <div className="sv-app sv-pagina">
        <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
        <Sidebar />
        <main className="sv-main">
          <p className="sv-vazio">Carregando solicitação...</p>
        </main>
      </div>
    )
  }

  if (!dados) {
    return (
      <div className="sv-app sv-pagina">
        <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
        <Sidebar />
        <main className="sv-main">
          <p className="sv-aviso sv-aviso--erro" role="alert">{erro ?? 'Solicitação não encontrada.'}</p>
        </main>
      </div>
    )
  }

  const badge    = badgeStatus[dados.status]    ?? { label: dados.status,    bg: 'var(--sv-fundo-suave)', cor: 'var(--sv-tinta-2)' }
  const urgBadge = badgeUrgencia[dados.urgencia] ?? { label: dados.urgencia, bg: 'var(--sv-fundo-suave)', cor: 'var(--sv-tinta-2)' }
  const podeMudar = dados.status === 'aberto' || dados.status === 'em_andamento'

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="sv-app sv-pagina">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
      <Sidebar />

      <main className="sv-main">

        {/* Header */}
        <header className="sv-topo">
          <div className="sv-topo-texto">
            <p className="sv-trilha">
              Abrigos &gt;{' '}
              <button type="button" className="sv-link" onClick={() => navigate(`/detalhes-abrigos/${dados.abrigoId}`)}>
                {dados.abrigo?.nome ?? 'Abrigo'}
              </button>
              {' '}&gt;{' '}
              <button type="button" className="sv-link" onClick={() => navigate(`/abrigos/${dados.abrigoId}/solicitacoes-ajuda`)}>
                Solicitações
              </button>
              {' '}&gt; Detalhes
            </p>
            <h1 className="sv-titulo">
              {dados.titulo}
            </h1>
          </div>
        </header>

        {/* Grid principal */}
        <div className="sv-duas-colunas">

          {/* Coluna esquerda — conteúdo */}
          <div className="sv-pilha">

            {/* Card principal */}
            <div className="sv-vidro sv-painel">

              {/* Badges */}
              <div className="sv-etiquetas">
                <span className="sv-tag sv-tag--lisa sv-tag--g" style={{ background: badge.bg, color: badge.cor }}>
                  {badge.label}
                </span>
                <span className="sv-tag sv-tag--lisa sv-tag--g" style={{ background: urgBadge.bg, color: urgBadge.cor }}>
                  Urgência: {urgBadge.label}
                </span>
                <span className="sv-tag sv-tag--lisa sv-tag--g sv-tag--neutro">
                  {categoriaLabel[dados.categoria] ?? dados.categoria}
                </span>
              </div>

              {/* Descrição */}
              <h3 className="sv-secao-titulo">Descrição</h3>
              <p className="sv-texto-longo">
                {dados.descricao}
              </p>

              {/* Observação de fechamento, se houver */}
              {dados.observacaoFechamento && (
                <div className="sv-nota">
                  <p className="sv-nota-rotulo">OBSERVAÇÃO DO FECHAMENTO</p>
                  <p>{dados.observacaoFechamento}</p>
                </div>
              )}

              {/* Voluntário que atendeu, se houver */}
              {dados.voluntario && (
                <div className="sv-nota sv-nota--ok">
                  <p className="sv-nota-rotulo">ATENDIDO POR</p>
                  <p><strong>{dados.voluntario.nome}</strong></p>
                  {dados.voluntario.email && (
                    <p>{dados.voluntario.email}</p>
                  )}
                </div>
              )}
            </div>

            {/* Card do abrigo — contato */}
            {dados.abrigo && (
              <div className="sv-vidro sv-painel">
                <h3 className="sv-secao-titulo">
                  <LuBuilding2 /> Abrigo vinculado
                </h3>
                <p className="sv-destaque">{dados.abrigo.nome}</p>
                <p className="sv-apoio">
                  {dados.abrigo.endereco}{dados.abrigo.bairro ? `, ${dados.abrigo.bairro}` : ''} — {dados.abrigo.cidade}/{dados.abrigo.estado}
                </p>
                {dados.abrigo.telefone && (
                  <p className="sv-apoio sv-apoio--icone">
                    <LuPhone /> {dados.abrigo.telefone}
                  </p>
                )}
                {dados.abrigo.responsavel && (
                  <p className="sv-apoio">
                    Responsável: <strong>{dados.abrigo.responsavel}</strong>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Coluna direita — ações e meta */}
          <div className="sv-pilha">

            {/* Card de ações */}
            <div className="sv-vidro sv-painel">
              <h3 className="sv-secao-titulo">Ações</h3>

              <div className="sv-form-acoes">
                {podeMudar && (
                  <>
                    {/* Botão Em andamento — só aparece se ainda estiver aberto */}
                    {dados.status === 'aberto' && (
                      <button
                        className="sv-btn sv-btn--vidro sv-btn--bloco"
                        onClick={() => handleAtualizarStatus('em_andamento')}
                        disabled={salvando}
                      >
                        <LuClock /> Marcar como Em andamento
                      </button>
                    )}

                    {/* Botão Concluir */}
                    <button
                      className="sv-btn sv-btn--primario sv-btn--bloco"
                      onClick={() => setModal('concluir')}
                    >
                      <LuCircleCheck /> Concluir solicitação
                    </button>

                    {/* Botão Cancelar */}
                    <button
                      className="sv-btn sv-btn--perigo-vidro sv-btn--bloco"
                      onClick={() => setModal('cancelar')}
                    >
                      <LuBan /> Cancelar solicitação
                    </button>
                  </>
                )}

                {/* Botão Apagar — sempre visível */}
                <button
                  className="sv-btn sv-btn--perigo-vidro sv-btn--bloco"
                  onClick={handleExcluir}
                >
                  <LuTrash2 /> Apagar registro
                </button>
              </div>

              {erro && <p className="sv-aviso sv-aviso--erro" role="alert" style={{ marginTop: '12px' }}>{erro}</p>}
            </div>

            {/* Card de metadados */}
            <div className="sv-vidro sv-painel">
              <h3 className="sv-secao-titulo">Informações</h3>

              <div className="sv-pares">
                {[
                  ['Criado por',   dados.criadoPor?.nome ?? '—'],
                  ['Criado em',    dados.createdAt ? new Date(dados.createdAt).toLocaleString('pt-BR') : '—'],
                  ['Atualizado',   dados.updatedAt ? new Date(dados.updatedAt).toLocaleString('pt-BR') : '—'],
                  ['Interesses',   `${dados.interesses?.length ?? 0} voluntário(s)`],
                ].map(([chave, valor]) => (
                  <div key={chave} className="sv-par">
                    <span>{chave}</span>
                    <strong>{valor}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Modal de confirmação ─────────────────────────────────────────────── */}
        {modal && (
          <div className="sv-modal-fundo">
            <div className="sv-modal" role="dialog" aria-modal="true" aria-labelledby="modal-ajuda-titulo">
              <h3 id="modal-ajuda-titulo" className="sv-modal-titulo">
                {modal === 'concluir' ? 'Concluir solicitação' : 'Cancelar solicitação'}
              </h3>
              <p className="sv-apoio" style={{ marginBottom: '18px' }}>
                {modal === 'concluir'
                  ? 'Registre como foi atendida e, se quiser, informe o voluntário que ajudou.'
                  : 'Informe o motivo do cancelamento (opcional).'}
              </p>

              <div className="sv-form">
                {/* Select de voluntário — só no modal de concluir */}
                {modal === 'concluir' && (
                  <div className="sv-campo">
                    <label htmlFor="modal-ajuda-voluntario">
                      Voluntário que atendeu<Opcional />
                    </label>
                    <select
                      id="modal-ajuda-voluntario"
                      value={voluntarioId}
                      onChange={e => setVoluntarioId(e.target.value)}
                    >
                      <option value="">Nenhum / não identificado</option>
                      <option value="anonimo">Anônimo</option>
                      {voluntarios.map(v => (
                        <option key={v.id_voluntario} value={v.id_voluntario}>{v.nome}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Observação */}
                <div className="sv-campo">
                  <label htmlFor="modal-ajuda-observacao">
                    Observação<Opcional />
                  </label>
                  <textarea
                    id="modal-ajuda-observacao"
                    maxLength={LIMITES.observacao}
                    value={observacao}
                    onChange={e => setObservacao(e.target.value)}
                    placeholder="Ex: Recebemos 40 cobertores doados pela empresa X..."
                  />
                  <ContadorCaracteres valor={observacao} limite={LIMITES.observacao} />
                </div>
              </div>

              {/* Botões do modal */}
              <div className="sv-acoes sv-acoes--iguais">
                <button
                  className={`sv-btn ${modal === 'concluir' ? 'sv-btn--primario' : 'sv-btn--perigo'}`}
                  onClick={() => handleAtualizarStatus(modal === 'concluir' ? 'concluido' : 'cancelado')}
                  disabled={salvando}
                >
                  {salvando ? 'Salvando...' : modal === 'concluir' ? 'Confirmar conclusão' : 'Confirmar cancelamento'}
                </button>
                <button
                  className="sv-btn sv-btn--vidro"
                  onClick={() => { setModal(null); setObservacao(''); setVoluntarioId('') }}
                >
                  Voltar
                </button>
              </div>
            </div>
          </div>
        )}

        <footer className="sv-rodape">
          <p>© 2026 S.O.S Vale. Todos os direitos reservados.</p>
          <p>Versão 1.0.0</p>
        </footer>

      </main>
    </div>
  )
}

export default DetalhesSolicitacaoAjuda