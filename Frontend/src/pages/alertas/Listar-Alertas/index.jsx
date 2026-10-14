// --------- Imports -----------
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuClock, LuMapPin, LuMapPinned, LuRefreshCw, LuTriangleAlert, LuUsers } from 'react-icons/lu';
import SidebarGlass from '../../../components/SidebarGlass/SidebarGlass';
import '../../../styles/sosvale-glass.css';
import { apiAdmin, formatarTempo } from '../../../services/api';
import { STATUS_ALERTA } from '../constantes';
import '../alertas.css';
import { iconeDoTipoAlerta } from '../../../utils/alertas';

// Recarrega a lista sozinha para acompanhar os relatos chegando
const INTERVALO_ATUALIZACAO_MS = 30000

function ListarAlertas() {

  const navigate = useNavigate();

  // ─── ESTADOS ────────────────────────────────────────────────
  const [alertas, setAlertas] = useState([])
  const [opcoes, setOpcoes] = useState({ tipos: [], confirmacoesNecessarias: 3 })
  const [cidades, setCidades] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroCidade, setFiltroCidade] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')

  // ─── BUSCA DA API ────────────────────────────────────────────
  const buscarAlertas = useCallback(async () => {
    try {
      const dados = await apiAdmin('/alertas/listar')
      setAlertas(dados.alertas)
      setErro('')
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    apiAdmin('/alertas/opcoes').then(setOpcoes).catch(e => setErro(e.message))
    apiAdmin('/cidades/listar').then(d => setCidades(d.cidades)).catch(console.error)

    buscarAlertas()
    const intervalo = setInterval(buscarAlertas, INTERVALO_ATUALIZACAO_MS)
    return () => clearInterval(intervalo)
  }, [buscarAlertas])

  // ─── DERIVAÇÕES ──────────────────────────────────────────────
  // Cidade e tipo filtram tudo; o status filtra só a lista (os cards
  // continuam mostrando o total de cada status)
  const alertasDoFiltro = alertas.filter(a =>
    (!filtroCidade || a.cidadeId === Number(filtroCidade)) &&
    (!filtroTipo || a.tipo === filtroTipo)
  )

  const alertasFiltrados = filtroStatus === 'todos'
    ? alertasDoFiltro
    : alertasDoFiltro.filter(a => a.status === filtroStatus)

  const contagem = (status) => alertasDoFiltro.filter(a => a.status === status).length


  // ─── TELA ────────────────────────────────────────────────────
  return (
    <div className="sv-app sv-pagina">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
      <SidebarGlass ativo="alertas" />

      <main className="sv-main">

        <header className="sv-topo">
          <div className="sv-topo-texto">
            <p className="sv-trilha"><a href="/pg_adm">Home</a> &gt; <span>Alertas</span></p>
            <h1 className="sv-titulo">Alertas</h1>
            <p className="sv-subtitulo">
              Ocorrências relatadas pelos moradores no WhatsApp. O alerta é enviado automaticamente
              quando {opcoes.confirmacoesNecessarias} pessoas diferentes relatam a mesma ocorrência no mesmo bairro.
            </p>
          </div>
          <div className="sv-topo-acoes">
            <button className="sv-btn sv-btn--vidro" onClick={buscarAlertas}><LuRefreshCw /> Atualizar</button>
            <a className="sv-btn sv-btn--vidro" href="/inscritos"><LuUsers /> Inscritos</a>
            <a className="sv-btn sv-btn--vidro" href="/regioes"><LuMapPinned /> Regiões e grupos</a>
          </div>
        </header>

        {/* Cards de resumo — clicar filtra a lista */}
        <section className="resumo-alertas">
          {Object.entries(STATUS_ALERTA).map(([status, label]) => (
            <button
              key={status}
              className={`resumo-alerta-card ${filtroStatus === status ? 'selecionado' : ''}`}
              onClick={() => setFiltroStatus(filtroStatus === status ? 'todos' : status)}
            >
              <div className="resumo-alerta-valor">{contagem(status)}</div>
              <div className="resumo-alerta-label"><span className={`sv-tag sv-tag--lisa sv-status ${status}`}>{label}</span></div>
            </button>
          ))}
        </section>

        <div className="sv-vidro sv-painel">

          <div className="barra-filtros">
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
              <option value="todos">Todos os status</option>
              {Object.entries(STATUS_ALERTA).map(([valor, label]) => (
                <option key={valor} value={valor}>{label}</option>
              ))}
            </select>

            <select value={filtroCidade} onChange={e => setFiltroCidade(e.target.value)}>
              <option value="">Todas as cidades</option>
              {cidades.map(c => (
                <option key={c.id_cidade} value={c.id_cidade}>{c.nome}/{c.estado}</option>
              ))}
            </select>

            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
              <option value="">Todos os tipos</option>
              {opcoes.tipos.map(t => (
                <option key={t.valor} value={t.valor}>{t.label}</option>
              ))}
            </select>

            <span className="contador-resultados">
              {alertasFiltrados.length} resultado{alertasFiltrados.length !== 1 ? 's' : ''}
            </span>
          </div>

          {erro && <p className="sv-aviso sv-aviso--erro" style={{ marginBottom: '12px' }}>{erro}</p>}

          {carregando ? (
            <p style={{ color: 'var(--sv-tinta-2)' }}>Carregando alertas...</p>
          ) : alertasFiltrados.length === 0 ? (
            <div className="sv-vazio">
              <LuTriangleAlert />
              <p>Nenhum alerta encontrado.</p>
            </div>
          ) : (
            alertasFiltrados.map(a => {
              const porcentagem = Math.min(100, (a.totalRelatos / a.confirmacoesNecessarias) * 100)

              return (
                <div className="sv-linha" key={a.id_alerta}>
                  <div className="sv-poco sv-poco--p sv-poco--aceso sv-poco--sirene">{iconeDoTipoAlerta(a.tipo)}</div>

                  <div className="sv-linha-info">
                    <p className="sv-linha-titulo">#{a.id_alerta} · {a.tipoLabel}</p>
                    <p className="sv-linha-meta">
                      <span><LuMapPin /> {a.bairro} — {a.cidade}/{a.estado}</span>
                      <span><LuClock /> {formatarTempo(a.createdAt)}</span>
                    </p>
                  </div>

                  <span className={`sv-tag sv-tag--lisa sv-status ${a.gravidade}`}>{a.gravidadeLabel}</span>

                  {/* Enquanto está em verificação mostra quantos relatos faltam */}
                  <div className="confirmacoes">
                    {a.status === 'em_verificacao'
                      ? `${a.totalRelatos}/${a.confirmacoesNecessarias} relatos`
                      : `${a.totalRelatos} relato${a.totalRelatos !== 1 ? 's' : ''}`}
                    {a.status === 'em_verificacao' && (
                      <div className="confirmacoes-barra">
                        <div style={{ width: `${porcentagem}%` }} />
                      </div>
                    )}
                  </div>

                  <span className={`sv-tag sv-tag--lisa sv-status ${a.status}`}>{STATUS_ALERTA[a.status]}</span>

                  <button
                    onClick={() => navigate(`/alertas/${a.id_alerta}`)}
                    className="sv-btn sv-btn--vidro "
                    
                  >
                    Ver detalhes
                  </button>
                </div>
              )
            })
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

export default ListarAlertas;
