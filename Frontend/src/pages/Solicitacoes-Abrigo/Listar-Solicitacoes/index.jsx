// --------- Imports -----------
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuChevronRight, LuClipboardList } from 'react-icons/lu';
import SidebarGlass from '../../../components/SidebarGlass/SidebarGlass';
import '../../../styles/sosvale-glass.css';
import { fetchAdmin } from '../../../services/api';

function ListaSolicitacoesAbrigo() {

  const navigate = useNavigate();

  // ─── ESTADOS ────────────────────────────────────────────────
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('todas');

  // ─── BUSCA DA API ────────────────────────────────────────────
  useEffect(() => {
    const buscarSolicitacoes = async () => {
      try {
        const resposta = await fetchAdmin('/solicitacoes/listar')
        const dados = await resposta.json()
        setSolicitacoes(dados.solicitacoes)
      } catch (erro) {
        console.error('Erro ao buscar solicitações:', erro)
      } finally {
        setCarregando(false)
      }
    }

    buscarSolicitacoes()
  }, [])

  // ─── DERIVAÇÕES ──────────────────────────────────────────────
  // Filtra o array conforme o botão selecionado
  const solicitacoesFiltradas = filtroStatus === 'todas'
    ? solicitacoes
    : solicitacoes.filter(s => s.status === filtroStatus)

  // Badge colorido por status — igual ao DetalhesSolicitacao
  const badgeStatus = {
    pendente: { label: 'Pendente', bg: 'var(--sv-atencao-suave)', cor: 'var(--sv-atencao-forte)' },
    aprovado: { label: 'Aprovado', bg: 'var(--sv-ok-suave)', cor: 'var(--sv-ok-forte)' },
    recusado: { label: 'Recusado', bg: 'var(--sv-sirene-suave)', cor: 'var(--sv-sirene-forte)' },
  }

  // ─── TELA DE LOADING ─────────────────────────────────────────
  if (carregando) {
    return (
      <div className="sv-app sv-pagina">
        <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
        <SidebarGlass ativo="solicitacoes-abrigo" />
        <main className="sv-main">
          <p className="sv-vazio">Carregando solicitações...</p>
        </main>
      </div>
    )
  }

  // ─── TELA PRINCIPAL ──────────────────────────────────────────
  return (
    <div className="sv-app sv-pagina">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>

      {/* Sidebar */}
      <SidebarGlass ativo="solicitacoes-abrigo" />

      <main className="sv-main">

        {/* Header */}
        <header className="sv-topo">
          <div className="sv-topo-texto">
            <p className="sv-trilha">
              Home &gt; <span>Solicitações de Abrigo</span>
            </p>
            <h1 className="sv-titulo">
              Solicitações de Abrigo
            </h1>
            <p className="sv-subtitulo">Gerencie os pedidos de cadastro de novos abrigos</p>
          </div>
        </header>

        {/* Painel da lista */}
        <div className="sv-vidro sv-painel">

          {/* Filtros de status */}
          <div className="sv-filtros">
            <div className="sv-chips" role="group" aria-label="Filtrar por status">
              {['todas', 'pendente', 'aprovado', 'recusado'].map(f => (
                <button
                  key={f}
                  onClick={() => setFiltroStatus(f)}
                  className={`sv-chip${filtroStatus === f ? ' sv-chip--ativo' : ''}`}
                  aria-pressed={filtroStatus === f}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {/* Contador */}
            <span className="sv-contagem">
              {solicitacoesFiltradas.length} resultado{solicitacoesFiltradas.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Lista */}
          {solicitacoesFiltradas.length === 0 ? (

            // Lista vazia
            <div className="sv-vazio">
              <LuClipboardList />
              <p>Nenhuma solicitação encontrada.</p>
            </div>

          ) : (

            // Lista com itens
            <div className="sv-lista">
              {solicitacoesFiltradas.map(s => {
                const badge = badgeStatus[s.status] ?? { label: s.status, bg: 'var(--sv-fundo-suave)', cor: 'var(--sv-tinta-2)' }

                return (
                  <div key={s.id_solicitacao} className="sv-linha">
                    {/* Ícone */}
                    <span className="sv-poco sv-poco--p sv-poco--aceso sv-poco--azul">
                      <LuClipboardList />
                    </span>

                    {/* Informações */}
                    <div className="sv-linha-info">
                      <p className="sv-linha-titulo">
                        {s.nome}
                      </p>
                      <p className="sv-linha-meta">
                        {s.cidade} — {s.responsavel} — {s.tipoAbrigo}
                      </p>
                    </div>

                    {/* Badge de status */}
                    <span className="sv-tag sv-tag--lisa" style={{ background: badge.bg, color: badge.cor }}>
                      {badge.label}
                    </span>

                    {/* Botão */}
                    <button
                      onClick={() => navigate(`/visualizar-solicitação-abrigo/${s.id_solicitacao}`)}
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

export default ListaSolicitacoesAbrigo;