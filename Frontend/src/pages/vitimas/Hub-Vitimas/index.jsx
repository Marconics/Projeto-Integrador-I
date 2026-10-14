// Hub de Vítimas (admin) — /vitimas
// Lista as vítimas com busca, filtros e ordenação (mesmo padrão das telas de
// Abrigos — estilos em styles/listagem.css).
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { LuAccessibility, LuHouse, LuPlus, LuSearch, LuX } from 'react-icons/lu';

import "../../../styles/listagem.css";
import SidebarGlass from '../../../components/SidebarGlass/SidebarGlass';
import '../../../styles/sosvale-glass.css';
import { API_URL } from '../../../services/api';
import { normalizar, plural } from '../../../utils/listagem';

const GENEROS = [
  { valor: '',          label: 'Todos' },
  { valor: 'feminino',  label: 'Feminino' },
  { valor: 'masculino', label: 'Masculino' },
  { valor: 'outro',     label: 'Outro' },
]

// Faixas etárias (idade em anos completos)
const FAIXAS = [
  { valor: '',             label: 'Todas',         min: 0,  max: Infinity },
  { valor: 'crianca',      label: 'Crianças (0–11)',      min: 0,  max: 11 },
  { valor: 'adolescente',  label: 'Adolescentes (12–17)', min: 12, max: 17 },
  { valor: 'adulto',       label: 'Adultos (18–59)',      min: 18, max: 59 },
  { valor: 'idoso',        label: 'Idosos (60+)',         min: 60, max: Infinity },
]

const ORDENACOES = [
  { valor: 'nome',     label: 'Nome (A–Z)' },
  { valor: 'entrada',  label: 'Entrada mais recente' },
  { valor: 'velhos',   label: 'Mais velhos primeiro' },
  { valor: 'novos',    label: 'Mais novos primeiro' },
]

// abrigo: '' = todos | 'sem' = sem abrigo | id do abrigo
const FILTROS_INICIAIS = {
  busca: '', abrigo: '', cidade: '', genero: '', faixa: '', comDeficiencia: false, ordem: 'nome',
}

// As datas vêm como "2000-01-31T00:00:00.000Z" (campo Date): usar UTC evita mostrar o dia anterior
const formatarData = (iso) => iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : null

const idadeDe = (iso) => {
  if (!iso) return null
  const nascimento = new Date(iso)
  const hoje = new Date()
  let idade = hoje.getUTCFullYear() - nascimento.getUTCFullYear()
  const fezAniversario =
    hoje.getUTCMonth() > nascimento.getUTCMonth() ||
    (hoje.getUTCMonth() === nascimento.getUTCMonth() && hoje.getUTCDate() >= nascimento.getUTCDate())
  if (!fezAniversario) idade--
  return idade
}

const diasDesde = (iso) => iso ? Math.max(0, Math.floor((Date.now() - new Date(iso)) / 86400000)) : null

const iniciais = (nome) => String(nome ?? '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()

const ListarVitimas = () => {
  const navigate = useNavigate()

  // ─── ESTADOS ─────────────────────────────────────────────────
  const [vitimas,    setVitimas]    = useState([])
  const [filtros,    setFiltros]    = useState(FILTROS_INICIAIS)
  const [carregando, setCarregando] = useState(true)
  const [erro,       setErro]       = useState(null)

  const mudarFiltro = (campo, valor) => setFiltros(f => ({ ...f, [campo]: valor }))

  // ─── BUSCA DE DADOS ──────────────────────────────────────────
  useEffect(() => {
    const carregar = async () => {
      try {
        const resposta = await fetch(`${API_URL}/api/vitimas/listar`)
        if (!resposta.ok) throw new Error('Erro ao buscar vítimas')
        const dados = await resposta.json()
        setVitimas(dados.vitimas ?? [])
      } catch (err) {
        setErro(err.message)
      } finally {
        setCarregando(false)
      }
    }
    carregar()
  }, [])

  // ─── OPÇÕES DOS SELECTS (a partir das vítimas carregadas) ────
  const abrigos = useMemo(() => {
    const mapa = new Map()
    for (const v of vitimas) if (v.abrigoId && v.abrigo) mapa.set(v.abrigoId, v.abrigo.nome)
    return [...mapa.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [vitimas])

  const cidades = useMemo(
    () => [...new Set(vitimas.map(v => v.abrigo?.cidade).filter(Boolean))].sort(),
    [vitimas]
  )

  // ─── FILTRAGEM E ORDENAÇÃO ───────────────────────────────────
  const vitimasFiltradas = useMemo(() => {
    const termo = normalizar(filtros.busca.trim())
    const digitos = filtros.busca.replace(/\D/g, '')
    const faixa = FAIXAS.find(f => f.valor === filtros.faixa)

    const lista = vitimas.filter(v => {
      if (termo) {
        const achouTexto = normalizar(v.nome).includes(termo)
        // CPF e telefone: compara só os números ("123.456" acha "12345678900")
        const achouNumero = digitos.length >= 3 &&
          [v.cpf, v.telefone].some(campo => String(campo ?? '').replace(/\D/g, '').includes(digitos))
        if (!achouTexto && !achouNumero) return false
      }
      if (filtros.abrigo === 'sem' && v.abrigoId) return false
      if (filtros.abrigo && filtros.abrigo !== 'sem' && v.abrigoId !== Number(filtros.abrigo)) return false
      if (filtros.cidade && v.abrigo?.cidade !== filtros.cidade) return false
      if (filtros.genero && normalizar(v.genero) !== filtros.genero) return false
      if (faixa?.valor) {
        const idade = idadeDe(v.dataNascimento)
        if (idade === null || idade < faixa.min || idade > faixa.max) return false
      }
      if (filtros.comDeficiencia && !(v.deficiencias?.length > 0)) return false
      return true
    })

    const tempo = (iso) => iso ? new Date(iso).getTime() : 0
    const ordenar = {
      nome:    (x, y) => x.nome.localeCompare(y.nome),
      entrada: (x, y) => tempo(y.dataEntrada) - tempo(x.dataEntrada),
      velhos:  (x, y) => tempo(x.dataNascimento) - tempo(y.dataNascimento),
      novos:   (x, y) => tempo(y.dataNascimento) - tempo(x.dataNascimento),
    }[filtros.ordem]

    return lista.sort(ordenar)
  }, [vitimas, filtros])

  const filtrosAtivos =
    Boolean(filtros.busca || filtros.abrigo || filtros.cidade || filtros.genero || filtros.faixa || filtros.comDeficiencia)

  const emAbrigos = vitimas.filter(v => v.abrigoId).length

  // ─── TELA DE CARREGANDO / ERRO ───────────────────────────────
  if (carregando || erro) {
    return (
      <div className="sv-app sv-pagina">
        <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
        <SidebarGlass ativo="vitimas" />
        <main className="sv-main pagina-listagem">
          <p className={erro ? 'lg-estado lg-estado--erro' : 'lg-estado'}>
            {erro ? `Não foi possível carregar as vítimas: ${erro}` : 'Carregando vítimas...'}
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="sv-app sv-pagina">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
      <SidebarGlass ativo="vitimas" />

      <main className="sv-main pagina-listagem">

        {/* ── CABEÇALHO ── */}
        <header className="lg-topo-linha">
          <div>
            <p className="sv-trilha">Vítimas &gt;</p>
            <h1 className="sv-titulo">Hub de Vítimas</h1>
            <p className="sv-subtitulo">
              {plural(vitimas.length, 'vítima cadastrada', 'vítimas cadastradas')} · {emAbrigos} em abrigos · {vitimas.length - emAbrigos} sem abrigo
            </p>
          </div>
          <div className="lg-topo-acoes">
            <button className="lg-botao-primario" onClick={() => navigate('/cadastro-vitima')}>
              <LuPlus /> Nova vítima
            </button>
          </div>
        </header>

        {/* ── FILTROS ── */}
        <section className="lg-filtros">
          <div className="lg-filtros-linha">
            <div className="lg-busca">
              <LuSearch className="lg-busca-icone" />
              <input
                placeholder="Buscar por nome, CPF ou telefone..."
                value={filtros.busca}
                onChange={e => mudarFiltro('busca', e.target.value)}
              />
            </div>

            <select value={filtros.abrigo} onChange={e => mudarFiltro('abrigo', e.target.value)} aria-label="Abrigo">
              <option value="">Todos os abrigos</option>
              <option value="sem">Sem abrigo</option>
              {abrigos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>

            <select value={filtros.cidade} onChange={e => mudarFiltro('cidade', e.target.value)} aria-label="Cidade do abrigo">
              <option value="">Todas as cidades</option>
              {cidades.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select value={filtros.ordem} onChange={e => mudarFiltro('ordem', e.target.value)} aria-label="Ordenar por">
              {ORDENACOES.map(o => <option key={o.valor} value={o.valor}>Ordenar: {o.label}</option>)}
            </select>
          </div>

          <div className="lg-filtros-linha">
            <span className="lg-filtro-rotulo">Gênero</span>
            <div className="lg-chips" role="group" aria-label="Gênero">
              {GENEROS.map(g => (
                <button
                  key={g.valor || 'todos'}
                  className={`lg-chip${filtros.genero === g.valor ? ' lg-chip--ativo' : ''}`}
                  onClick={() => mudarFiltro('genero', g.valor)}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="lg-filtros-linha">
            <span className="lg-filtro-rotulo">Idade</span>
            <div className="lg-chips" role="group" aria-label="Faixa etária">
              {FAIXAS.map(f => (
                <button
                  key={f.valor || 'todas'}
                  className={`lg-chip${filtros.faixa === f.valor ? ' lg-chip--ativo' : ''}`}
                  onClick={() => mudarFiltro('faixa', f.valor)}
                >
                  {f.label}
                </button>
              ))}
              <button
                className={`lg-chip${filtros.comDeficiencia ? ' lg-chip--ativo' : ''}`}
                onClick={() => mudarFiltro('comDeficiencia', !filtros.comDeficiencia)}
              >
                <LuAccessibility /> Com deficiência
              </button>
            </div>
          </div>
        </section>

        <div className="lg-resultado">
          <span>
            <strong>{vitimasFiltradas.length}</strong> vítima{vitimasFiltradas.length !== 1 ? 's' : ''} encontrada{vitimasFiltradas.length !== 1 ? 's' : ''}
          </span>
          {filtrosAtivos && (
            <button className="lg-limpar" onClick={() => setFiltros(FILTROS_INICIAIS)}>
              <LuX /> Limpar filtros
            </button>
          )}
        </div>

        {/* ── LISTA DE VÍTIMAS ── */}
        {vitimasFiltradas.length === 0 ? (
          <p className="lg-vazio">
            {vitimas.length === 0 ? 'Nenhuma vítima cadastrada ainda.' : 'Nenhuma vítima encontrada com esses filtros.'}
          </p>
        ) : (
          <section className="lg-grade">
            {vitimasFiltradas.map(vitima => {
              const idade = idadeDe(vitima.dataNascimento)
              const dias = diasDesde(vitima.dataEntrada)
              const genero = vitima.genero ? vitima.genero.charAt(0).toUpperCase() + vitima.genero.slice(1) : null

              return (
                <article key={vitima.id} className="lg-card">
                  <div className="lg-card-topo">
                    <div className="lg-pessoa">
                      {vitima.fotoVitima
                        ? <img src={vitima.fotoVitima} alt="" className="lg-avatar" />
                        : <div className="lg-avatar">{iniciais(vitima.nome)}</div>}
                      <div className="lg-pessoa-info">
                        <h3 className="lg-card-nome" title={vitima.nome}>{vitima.nome}</h3>
                        <p className="lg-pessoa-sub">
                          {[idade !== null ? `${idade} ano${idade !== 1 ? 's' : ''}` : null, genero].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                    </div>
                    {!vitima.abrigoId && <span className="lg-selo lg-selo--cinza">Sem abrigo</span>}
                  </div>

                  <div className="lg-dados">
                    <div className="lg-dado">
                      <span>Abrigo</span>
                      <strong title={vitima.abrigo?.nome}>{vitima.abrigo ? vitima.abrigo.nome : '—'}</strong>
                    </div>
                    <div className="lg-dado">
                      <span>Entrada</span>
                      <strong>
                        {vitima.dataEntrada
                          ? `${formatarData(vitima.dataEntrada)}${dias !== null ? ` · ${dias === 0 ? 'hoje' : `há ${dias} dia${dias !== 1 ? 's' : ''}`}` : ''}`
                          : '—'}
                      </strong>
                    </div>
                    <div className="lg-dado">
                      <span>CPF</span>
                      <strong>{vitima.cpf || '—'}</strong>
                    </div>
                    <div className="lg-dado">
                      <span>Telefone</span>
                      <strong>{vitima.telefone || '—'}</strong>
                    </div>
                  </div>

                  <div className="lg-tags">
                    {vitima.deficiencias?.length > 0
                      ? vitima.deficiencias.map(d => <span key={d} className="lg-tag">{d}</span>)
                      : <span className="lg-sem-tags">Nenhuma deficiência informada</span>}
                  </div>

                  <div className="lg-card-acoes">
                    <button
                      className="lg-botao-secundario"
                      disabled={!vitima.abrigoId}
                      title={vitima.abrigoId ? 'Abrir o abrigo' : 'Vítima sem abrigo'}
                      onClick={() => navigate(`/detalhes-abrigos/${vitima.abrigoId}`)}
                    >
                      <LuHouse /> Abrigo
                    </button>
                    <button className="lg-botao-card" onClick={() => navigate(`/detalhes-vitimas/${vitima.id}`)}>
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

export default ListarVitimas;
