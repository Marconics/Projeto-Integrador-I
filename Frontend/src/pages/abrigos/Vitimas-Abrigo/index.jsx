import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LuArrowLeft, LuExternalLink, LuLink, LuSearch, LuUnlink, LuUser, LuX } from 'react-icons/lu';
import SidebarGlass from '../../../components/SidebarGlass/SidebarGlass';
import '../../../styles/sosvale-glass.css';
import { LIMITES } from '../../../utils/campos';
import { fetchAdmin, formatarDataDia } from '../../../services/api';

// ── Utilitários ────────────────────────────────────────────────────────────
// As datas do banco são "só dia" à meia-noite UTC: lê em UTC para não perder 1 dia
const calcularIdade = (dataNascimento) => {
  if (!dataNascimento) return '—'
  const hoje = new Date()
  const nasc = new Date(dataNascimento)
  let idade = hoje.getFullYear() - nasc.getUTCFullYear()
  const mes = hoje.getMonth() - nasc.getUTCMonth()
  if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getUTCDate())) idade--
  return idade
}

const formatarData = formatarDataDia
// ──────────────────────────────────────────────────────────────────────────

function VitimasDoAbrigo() {
  const { id } = useParams()
  const navigate = useNavigate()

  // ── Estado central ────────────────────────────────────────────────────
  const [nomeAbrigo, setNomeAbrigo] = useState('')
  const [capacidade, setCapacidade] = useState({ total: 0, ocupada: 0 })
  const [vitimasDoAbrigo, setVitimasDoAbrigo] = useState([])
  const [todasVitimas, setTodasVitimas] = useState([])
  const [carregando, setCarregando] = useState(true)

  const [painelVincular, setPainelVincular] = useState(false)
  const [busca, setBusca] = useState('')
  const [vinculando, setVinculando] = useState(null)
  // ──────────────────────────────────────────────────────────────────────

  // ── Carga inicial ─────────────────────────────────────────────────────
  // useCallback: a função só muda quando o id do abrigo muda, então o useEffect
  // abaixo pode depender dela sem recarregar a cada render
  const carregarDados = useCallback(async () => {
    try {
      const resAbrigo = await fetchAdmin(`/abrigos/listar/${id}`)
      const dadosAbrigo = await resAbrigo.json()
      setNomeAbrigo(dadosAbrigo.nome ?? `Abrigo #${id}`)
      setCapacidade({
        total:   dadosAbrigo.capacidadeTotal   ?? 0,
        ocupada: dadosAbrigo.capacidadeOcupada ?? 0,
      })

      // Vítimas já vinculadas — vêm do GET do abrigo com dataNascimento e dataEntrada
      setVitimasDoAbrigo(dadosAbrigo.vitimas ?? [])

      // Todas as vítimas sem abrigo — para o painel de vincular
      const resTodas = await fetchAdmin('/vitimas/listar')
      const dadosTodas = await resTodas.json()
      setTodasVitimas((dadosTodas.vitimas ?? []).filter(v => !v.abrigoId))

    } catch (erro) {
      console.error('Erro ao carregar dados:', erro)
    } finally {
      setCarregando(false)
    }
  }, [id])

  useEffect(() => { carregarDados() }, [carregarDados])
  // ──────────────────────────────────────────────────────────────────────

  // ── Vincular ──────────────────────────────────────────────────────────
  const vincularVitima = async (vitima) => {
    setVinculando(vitima.id)
    try {
      const res = await fetchAdmin(`/vitimas/listar/${vitima.id}`)
      const dados = await res.json()

      const resposta = await fetchAdmin(`/vitimas/atualizar/${vitima.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome:           dados.nome,
          cpf:            dados.cpf,
          telefone:       dados.telefone,
          dataNascimento: dados.dataNascimento,
          genero:         dados.genero,
          fotoVitima:     dados.fotoVitima,
          abrigoId:       Number(id),
        })
      })

      const resultado = await resposta.json()

      if (!resposta.ok) {
        alert(resultado.mensagem ?? 'Erro ao vincular.')
        return
      }

      await carregarDados()
      setBusca('')
    } catch (erro) {
      console.error('Erro ao vincular vítima:', erro)
      alert('Erro ao vincular. Tente novamente.')
    } finally {
      setVinculando(null)
    }
  }
  // ──────────────────────────────────────────────────────────────────────

  // ── Desvincular ───────────────────────────────────────────────────────
  const desvincularVitima = async (vitima) => {
    if (!confirm(`Desvincular "${vitima.nome}" deste abrigo?`)) return
    setVinculando(vitima.id_vitima)
    try {
      const res = await fetchAdmin(`/vitimas/listar/${vitima.id_vitima}`)
      const dados = await res.json()

      const resposta = await fetchAdmin(`/vitimas/atualizar/${vitima.id_vitima}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome:           dados.nome,
          cpf:            dados.cpf,
          telefone:       dados.telefone,
          dataNascimento: dados.dataNascimento,
          genero:         dados.genero,
          fotoVitima:     dados.fotoVitima,
          abrigoId:       null,
        })
      })

      // Antes a resposta não era conferida: um erro passava como sucesso
      if (!resposta.ok) {
        const resultado = await resposta.json().catch(() => ({}))
        alert(resultado.mensagem ?? 'Erro ao desvincular.')
        return
      }

      await carregarDados()
    } catch (erro) {
      console.error('Erro ao desvincular vítima:', erro)
      alert('Erro ao desvincular. Tente novamente.')
    } finally {
      setVinculando(null)
    }
  }
  // ──────────────────────────────────────────────────────────────────────

  const vitmasFiltradas = todasVitimas.filter(v =>
    v.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (v.cpf ?? '').includes(busca)
  )

  // ── Barra de capacidade ───────────────────────────────────────────────
  const pct = capacidade.total > 0
    ? Math.min(100, Math.round((capacidade.ocupada / capacidade.total) * 100))
    : 0
  const corBarra = pct >= 100 ? 'var(--sv-sirene)' : pct >= 80 ? 'var(--sv-atencao)' : 'var(--sv-ok)'
  // ──────────────────────────────────────────────────────────────────────

  const Sidebar = () => (
    <SidebarGlass ativo="abrigos" />
  )

  if (carregando) {
    return (
      <div className="sv-app sv-pagina">
        <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
        <Sidebar />
        <main className="sv-main">
          <p className="sv-vazio">Carregando vítimas do abrigo...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="sv-app sv-pagina">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
      <Sidebar />

      <main className="sv-main">

        {/* ── Cabeçalho ──────────────────────────────────────────────────── */}
        <header className="sv-topo">
          <div className="sv-topo-texto">
            {/* Botão de voltar */}
            <button
              className="sv-voltar"
              onClick={() => navigate(`/detalhes-abrigos/${id}`)}
            >
              <LuArrowLeft />
              Voltar para {nomeAbrigo}
            </button>

            <h1 className="sv-titulo">
              Vítimas do Abrigo
            </h1>
            <p className="sv-subtitulo">
              {vitimasDoAbrigo.length} vítima{vitimasDoAbrigo.length !== 1 ? 's' : ''} vinculada{vitimasDoAbrigo.length !== 1 ? 's' : ''}
            </p>
          </div>

          <button
            className="sv-btn sv-btn--primario"
            onClick={() => { setPainelVincular(true); setBusca('') }}
            disabled={pct >= 100}
            title={pct >= 100 ? 'Abrigo lotado' : 'Vincular vítima'}
          >
            <LuLink /> Vincular Vítima
          </button>
        </header>
        {/* ─────────────────────────────────────────────────────────────── */}

        {/* ── Card de capacidade ─────────────────────────────────────────── */}
        <div className="sv-card">
          <div className="sv-par" style={{ marginBottom: '8px' }}>
            <span>
              Capacidade do abrigo
            </span>
            <strong style={{ color: corBarra, fontWeight: 700 }}>
              {capacidade.ocupada} / {capacidade.total}
              {pct >= 100 && ' — Lotado'}
            </strong>
          </div>
          <div className="sv-barra">
            <div style={{ width: `${pct}%`, background: corBarra, transition: 'width 0.3s' }} />
          </div>
        </div>
        {/* ─────────────────────────────────────────────────────────────── */}

        {/* ── Tabela de vítimas vinculadas ──────────────────────────────── */}
        <div className="sv-tabela-caixa">
          {vitimasDoAbrigo.length > 0 ? (
            <table className="sv-tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th className="sv-centro">Idade</th>
                  <th className="sv-centro">Gênero</th>
                  <th className="sv-centro">Data de Entrada</th>
                  <th className="sv-centro">Ações</th>
                </tr>
              </thead>
              <tbody>
                {vitimasDoAbrigo.map((vitima) => (
                  <tr key={vitima.id_vitima}>
                    {/* Nome — clicável para abrir os detalhes da vítima */}
                    <td>
                      <button
                        className="sv-link sv-link--forte"
                        onClick={() => navigate(`/detalhes-vitimas/${vitima.id_vitima}`)}
                      >
                        {vitima.nome}
                        <LuExternalLink />
                      </button>
                    </td>

                    <td className="sv-centro">
                      {calcularIdade(vitima.dataNascimento)}
                    </td>

                    <td className="sv-centro">
                      {vitima.genero}
                    </td>

                    <td className="sv-centro">
                      {formatarData(vitima.dataEntrada)}
                    </td>

                    {/* Botão desvincular */}
                    <td className="sv-centro">
                      <button
                        className="sv-btn sv-btn--perigo-vidro sv-btn--p"
                        onClick={() => desvincularVitima(vitima)}
                        disabled={vinculando === vitima.id_vitima}
                        title="Desvincular deste abrigo"
                      >
                        <LuUnlink />
                        {vinculando === vitima.id_vitima ? 'Aguarde...' : 'Desvincular'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="sv-vazio">
              <LuUser />
              <strong>
                Nenhuma vítima vinculada
              </strong>
              <p className="sv-apoio">
                Clique em "Vincular Vítima" para adicionar alguém a este abrigo.
              </p>
            </div>
          )}
        </div>
        {/* ─────────────────────────────────────────────────────────────── */}

        {/* ── Painel lateral: Vincular vítima ───────────────────────────── */}
        {painelVincular && (
          <>
            <div
              className="sv-gaveta-fundo"
              onClick={() => setPainelVincular(false)}
            />

            <div className="sv-gaveta" role="dialog" aria-modal="true" aria-labelledby="gaveta-vincular-titulo">

              {/* Cabeçalho do painel */}
              <div className="sv-gaveta-topo">
                <div>
                  <h2 id="gaveta-vincular-titulo" className="sv-modal-titulo" style={{ marginBottom: 0 }}>
                    Vincular Vítima
                  </h2>
                  <p className="sv-apoio">
                    {todasVitimas.length} vítima{todasVitimas.length !== 1 ? 's' : ''} sem abrigo
                  </p>
                </div>
                <button
                  className="sv-btn sv-btn--vidro sv-btn--quadrado"
                  onClick={() => setPainelVincular(false)}
                  aria-label="Fechar"
                >
                  <LuX />
                </button>
              </div>

              {/* Campo de busca */}
              <div className="sv-gaveta-busca sv-campo">
                <label htmlFor="gaveta-vincular-busca" className="sv-oculto">Buscar vítima</label>
                <span className="sv-campo-icone">
                  <LuSearch />
                  <input
                    id="gaveta-vincular-busca"
                    autoFocus
                    type="text"
                    placeholder="Buscar por nome ou CPF..."
                    aria-label="Buscar"
                    maxLength={LIMITES.busca}
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />
                </span>
              </div>

              {/* Lista de vítimas disponíveis */}
              <div className="sv-gaveta-corpo">
                {vitmasFiltradas.length === 0 ? (
                  <div className="sv-vazio">
                    <p>
                      {busca
                        ? 'Nenhuma vítima encontrada com esse nome ou CPF.'
                        : 'Todas as vítimas já estão vinculadas a um abrigo.'
                      }
                    </p>
                  </div>
                ) : (
                  vitmasFiltradas.map((vitima) => (
                    <div key={vitima.id} className="sv-gaveta-item">
                      <div className="sv-linha-info">
                        <p className="sv-linha-titulo">
                          {vitima.nome}
                        </p>
                        <p className="sv-linha-meta">
                          {calcularIdade(vitima.dataNascimento)} anos
                          {vitima.cpf ? ` · CPF: ${vitima.cpf}` : ''}
                        </p>
                      </div>

                      <button
                        className="sv-btn sv-btn--primario sv-btn--p"
                        onClick={() => vincularVitima(vitima)}
                        disabled={vinculando === vitima.id}
                      >
                        <LuLink />
                        {vinculando === vitima.id ? 'Vinculando...' : 'Vincular'}
                      </button>
                    </div>
                  ))
                )}
              </div>

            </div>
          </>
        )}
        {/* ─────────────────────────────────────────────────────────────── */}

        <footer className="sv-rodape">
          <p>© 2026 S.O.S Vale. Todos os direitos reservados.</p>
          <p>Versão 1.0.0</p>
        </footer>
      </main>
    </div>
  )
}

export default VitimasDoAbrigo;