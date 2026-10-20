// Hub de Vítimas (admin) — /vitimas
// Feito para centenas de pessoas: as vítimas aparecem em fichas compactas,
// agrupadas por abrigo (o grupo "Sem abrigo" primeiro) ou por letra (A–Z).
// Clicar numa ficha abre o painel com o resumo da pessoa.
// Peças do tema (styles/sosvale-glass.css) + o que é só desta tela (./style.css).
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuAccessibility, LuBaby, LuChevronDown, LuChevronRight, LuHouse, LuPersonStanding, LuPlus,
  LuSearch, LuSlidersHorizontal, LuTriangleAlert, LuUsers, LuX
} from 'react-icons/lu';

import SidebarGlass from '../../../components/SidebarGlass/SidebarGlass';
import '../../../styles/sosvale-glass.css';
import './style.css';
import { Esqueleto, ErroPagina, Vazio } from '../../../components/EstadosPagina';
import { LIMITES } from '../../../utils/campos';
import { fetchAdmin } from '../../../services/api';
import { normalizar, plural, useCelular } from '../../../utils/listagem';

const GENEROS = [
  { valor: '',          label: 'Todos' },
  { valor: 'feminino',  label: 'Feminino' },
  { valor: 'masculino', label: 'Masculino' },
  { valor: 'outro',     label: 'Outro' },
]

// Faixas etárias (idade em anos completos) — viram as abas, com rótulo curto no celular
const FAIXAS = [
  { valor: '',            label: 'Todas',        curto: 'Todas', min: 0,  max: Infinity },
  { valor: 'crianca',     label: 'Crianças',     curto: '0–11',  min: 0,  max: 11 },
  { valor: 'adolescente', label: 'Adolescentes', curto: '12–17', min: 12, max: 17 },
  { valor: 'adulto',      label: 'Adultos',      curto: '18–59', min: 18, max: 59 },
  { valor: 'idoso',       label: 'Idosos',       curto: '60+',   min: 60, max: Infinity },
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

// Fichas mostradas por grupo antes do "Ver mais"
const LIMITE_GRUPO = 24

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

// A pessoa está na faixa etária escolhida? ('' = todas)
const naFaixa = (v, valor) => {
  const faixa = FAIXAS.find(f => f.valor === valor)
  if (!faixa?.valor) return true
  const idade = idadeDe(v.dataNascimento)
  return idade !== null && idade >= faixa.min && idade <= faixa.max
}

const diasDesde = (iso) => iso ? Math.max(0, Math.floor((Date.now() - new Date(iso)) / 86400000)) : null
const textoDias = (dias) => dias === null ? '' : dias === 0 ? 'hoje' : `há ${dias} dia${dias !== 1 ? 's' : ''}`

const iniciais = (nome) => String(nome ?? '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()

const generoLongo = (g) => g ? g.charAt(0).toUpperCase() + g.slice(1) : null
const generoCurto = (g) => ({ feminino: 'Fem.', masculino: 'Masc.', outro: 'Outro' })[normalizar(g)] ?? generoLongo(g)

const localDoAbrigo = (abrigo) => abrigo
  ? [abrigo.bairro, abrigo.cidade && `${abrigo.cidade}${abrigo.estado ? '/' + abrigo.estado : ''}`].filter(Boolean).join(', ')
  : ''

// Foto da pessoa ou, sem foto, as iniciais
function Avatar({ vitima, grande }) {
  const [falhou, setFalhou] = useState(false)
  return (
    <span className={`vt-avatar${grande ? ' vt-avatar--g' : ''}`} aria-hidden="true">
      {vitima.fotoVitima && !falhou
        ? <img src={vitima.fotoVitima} alt="" loading="lazy" decoding="async" onError={() => setFalhou(true)} />
        : iniciais(vitima.nome)}
    </span>
  )
}

const ListarVitimas = () => {
  const navigate = useNavigate()
  const celular = useCelular() // no celular, "Mais filtros" abre numa gaveta

  // ─── ESTADOS ─────────────────────────────────────────────────
  const [vitimas,    setVitimas]    = useState([])
  const [filtros,    setFiltros]    = useState(FILTROS_INICIAIS)
  const [carregando, setCarregando] = useState(true)
  const [erro,       setErro]       = useState(null)
  const [maisAberto, setMaisAberto] = useState(false)  // "Mais filtros" (painel) / "Filtros" (gaveta no celular)
  const [agrupar,    setAgrupar]    = useState('abrigo') // 'abrigo' | 'az'
  const [fechados,   setFechados]   = useState(() => new Set()) // grupos recolhidos
  const [completos,  setCompletos]  = useState(() => new Set()) // grupos com "Ver mais" aberto
  const [selecionadaId, setSelecionadaId] = useState(null)     // pessoa no painel lateral

  const mudarFiltro = (campo, valor) => setFiltros(f => ({ ...f, [campo]: valor }))
  const alternarFiltro = (campo, valor) => setFiltros(f => ({ ...f, [campo]: f[campo] === valor ? FILTROS_INICIAIS[campo] : valor }))
  const alternarNoConjunto = (setConjunto, chave) => setConjunto(atual => {
    const novo = new Set(atual)
    if (novo.has(chave)) novo.delete(chave)
    else novo.add(chave)
    return novo
  })

  // ─── BUSCA DE DADOS ──────────────────────────────────────────
  // Função própria para o botão "Tentar novamente" poder chamar de novo
  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const resposta = await fetchAdmin('/vitimas/listar')
      if (!resposta.ok) throw new Error('Erro ao buscar vítimas')
      const dados = await resposta.json()
      setVitimas(dados.vitimas ?? [])
    } catch (err) {
      console.error('Erro ao carregar as vítimas:', err)
      setErro('O servidor não respondeu. Verifique a conexão e tente novamente.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

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
  // Todos os filtros menos a faixa etária (as abas mostram quantas há em cada faixa)
  const vitimasBase = useMemo(() => {
    const termo = normalizar(filtros.busca.trim())
    const digitos = filtros.busca.replace(/\D/g, '')
    return vitimas.filter(v => {
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
      if (filtros.comDeficiencia && !(v.deficiencias?.length > 0)) return false
      return true
    })
  }, [vitimas, filtros])

  const vitimasFiltradas = useMemo(() => {
    const lista = vitimasBase.filter(v => naFaixa(v, filtros.faixa))
    const tempo = (iso) => iso ? new Date(iso).getTime() : 0
    const ordenar = {
      nome:    (x, y) => x.nome.localeCompare(y.nome),
      entrada: (x, y) => tempo(y.dataEntrada) - tempo(x.dataEntrada),
      velhos:  (x, y) => tempo(x.dataNascimento) - tempo(y.dataNascimento),
      novos:   (x, y) => tempo(y.dataNascimento) - tempo(x.dataNascimento),
    }[filtros.ordem]
    return lista.sort(ordenar)
  }, [vitimasBase, filtros.faixa, filtros.ordem])

  // ─── GRUPOS ──────────────────────────────────────────────────
  const grupos = useMemo(() => {
    if (agrupar === 'az') {
      const mapa = new Map()
      for (const v of vitimasFiltradas) {
        const letra = normalizar(v.nome).trim().charAt(0).toUpperCase()
        const chave = /[A-Z]/.test(letra) ? letra : '#'
        if (!mapa.has(chave)) mapa.set(chave, [])
        mapa.get(chave).push(v)
      }
      return [...mapa.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([letra, pessoas]) => ({ chave: `letra-${letra}`, letra, titulo: `Letra ${letra}`, pessoas }))
    }

    // Por abrigo: "Sem abrigo" primeiro (é quem precisa de ação), depois os abrigos por nome
    const mapa = new Map()
    const semAbrigo = []
    for (const v of vitimasFiltradas) {
      if (!v.abrigoId) { semAbrigo.push(v); continue }
      if (!mapa.has(v.abrigoId)) {
        mapa.set(v.abrigoId, {
          chave: `abrigo-${v.abrigoId}`, abrigoId: v.abrigoId,
          titulo: v.abrigo?.nome ?? `Abrigo #${v.abrigoId}`, local: localDoAbrigo(v.abrigo), pessoas: [],
        })
      }
      mapa.get(v.abrigoId).pessoas.push(v)
    }
    const porAbrigo = [...mapa.values()].sort((a, b) => a.titulo.localeCompare(b.titulo))
    return semAbrigo.length > 0
      ? [{ chave: 'sem', sem: true, titulo: 'Sem abrigo', local: 'Precisam de um lugar. Para vincular, abra o abrigo e use "Vincular vítima".', pessoas: semAbrigo }, ...porAbrigo]
      : porAbrigo
  }, [vitimasFiltradas, agrupar])

  const buscando = filtros.busca.trim().length > 0 // buscando: todos os grupos abertos

  const filtrosAtivos =
    Boolean(filtros.busca || filtros.abrigo || filtros.cidade || filtros.genero || filtros.faixa || filtros.comDeficiencia)

  // Quantos filtros estão ligados dentro de "Mais filtros" (no celular, o abrigo também fica lá)
  const filtrosExtras =
    [filtros.cidade, filtros.genero, filtros.comDeficiencia, celular && filtros.abrigo].filter(Boolean).length

  const nomeDoAbrigo = (valor) => valor === 'sem' ? 'Sem abrigo' : (abrigos.find(a => String(a.id) === String(valor))?.nome ?? 'Abrigo')
  const etiquetasAtivas = [
    filtros.busca          && { id: 'busca',  label: `“${filtros.busca}”`, remover: () => mudarFiltro('busca', '') },
    filtros.abrigo         && { id: 'abrigo', label: nomeDoAbrigo(filtros.abrigo), remover: () => mudarFiltro('abrigo', '') },
    filtros.cidade         && { id: 'cidade', label: filtros.cidade, remover: () => mudarFiltro('cidade', '') },
    filtros.genero         && { id: 'genero', label: GENEROS.find(g => g.valor === filtros.genero)?.label, remover: () => mudarFiltro('genero', '') },
    filtros.comDeficiencia && { id: 'deficiencia', label: 'Com deficiência', remover: () => mudarFiltro('comDeficiencia', false) },
  ].filter(Boolean)

  // ─── RESUMO (sobre todas as vítimas, sem filtro) ─────────────
  const emAbrigos        = vitimas.filter(v => v.abrigoId).length
  const semAbrigo        = vitimas.length - emAbrigos
  const comDeficiencia   = vitimas.filter(v => v.deficiencias?.length > 0).length
  const criancas         = vitimas.filter(v => naFaixa(v, 'crianca')).length
  const adolescentes     = vitimas.filter(v => naFaixa(v, 'adolescente')).length
  const idosos           = vitimas.filter(v => naFaixa(v, 'idoso')).length

  const resumo = [
    {
      id: 'total', icone: <LuUsers />, anim: 'pulo', tom: 'azul', valor: vitimas.length, label: 'Pessoas cadastradas',
      detalhe: `${emAbrigos} em abrigos · ${comDeficiencia} com deficiência`,
    },
    {
      id: 'sem', icone: <LuTriangleAlert />, anim: 'pulso', tom: semAbrigo > 0 ? 'sirene' : 'petroleo', valor: semAbrigo, label: 'Sem abrigo',
      detalhe: semAbrigo > 0 ? 'precisam de um lugar' : 'todas acolhidas', urgente: semAbrigo > 0,
      ativo: filtros.abrigo === 'sem', aoClicar: () => alternarFiltro('abrigo', 'sem'),
    },
    {
      id: 'criancas', icone: <LuBaby />, anim: 'pulo', tom: 'ciano', valor: criancas, label: 'Crianças (0–11)',
      detalhe: `+ ${plural(adolescentes, 'adolescente', 'adolescentes')}`,
      ativo: filtros.faixa === 'crianca', aoClicar: () => alternarFiltro('faixa', 'crianca'),
    },
    {
      id: 'idosos', icone: <LuPersonStanding />, anim: 'pulo', tom: 'anil', valor: idosos, label: 'Idosos (60+)',
      detalhe: 'acima de 60 anos',
      ativo: filtros.faixa === 'idoso', aoClicar: () => alternarFiltro('faixa', 'idoso'),
    },
  ]

  const indiceFaixa = Math.max(0, FAIXAS.findIndex(f => f.valor === filtros.faixa))
  const selecionada = vitimas.find(v => v.id === selecionadaId) ?? null

  // ─── PEÇAS REPETIDAS (painel e gaveta) ───────────────────────
  const selectAbrigo = (id) => (
    <select id={id} className="sv-entrada sv-filtro-select" value={filtros.abrigo} onChange={e => mudarFiltro('abrigo', e.target.value)}>
      <option value="">Todos os abrigos</option>
      <option value="sem">Sem abrigo</option>
      {abrigos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
    </select>
  )
  const selectCidade = (id) => (
    <select id={id} className="sv-entrada sv-filtro-select" value={filtros.cidade} onChange={e => mudarFiltro('cidade', e.target.value)}>
      <option value="">Todas as cidades</option>
      {cidades.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  )
  const selectOrdem = (id) => (
    <select id={id} className="sv-entrada sv-filtro-select" value={filtros.ordem} onChange={e => mudarFiltro('ordem', e.target.value)}>
      {ORDENACOES.map(o => <option key={o.valor} value={o.valor}>Ordenar: {o.label}</option>)}
    </select>
  )
  const chipsGenero = (
    <div className="sv-filtro-grupo" role="group" aria-label="Gênero">
      <span className="sv-filtro-grupo-rotulo" aria-hidden="true">Gênero</span>
      {GENEROS.map(g => (
        <button key={g.valor || 'todos'} type="button" className={`sv-chip${filtros.genero === g.valor ? ' sv-chip--ativo' : ''}`}
          aria-pressed={filtros.genero === g.valor} onClick={() => mudarFiltro('genero', g.valor)}>
          {g.label}
        </button>
      ))}
      <button type="button" className={`sv-chip${filtros.comDeficiencia ? ' sv-chip--ativo' : ''}`} aria-pressed={filtros.comDeficiencia}
        onClick={() => mudarFiltro('comDeficiencia', !filtros.comDeficiencia)}>
        <LuAccessibility /> Com deficiência
      </button>
    </div>
  )

  const cabecalho = (
    <header className="sv-topo">
      <div className="sv-topo-texto">
        <p className="sv-trilha"><a href="/pg_adm">Visão geral</a> &gt; <span>Vítimas</span></p>
        <h1 className="sv-titulo">Vítimas</h1>
        <p className="sv-subtitulo">
          {carregando || erro
            ? 'Pessoas atendidas e onde cada uma está'
            : `${plural(vitimas.length, 'pessoa cadastrada', 'pessoas cadastradas')} · ${emAbrigos} em abrigos · ${semAbrigo} sem abrigo`}
        </p>
      </div>
      <div className="sv-topo-acoes">
        <button type="button" className="sv-btn sv-btn--primario sv-anima" onClick={() => navigate('/cadastro-vitima')}>
          <span data-anim="giro"><LuPlus /></span> Nova vítima
        </button>
      </div>
    </header>
  )

  // ─── TELA DE CARREGANDO / ERRO ───────────────────────────────
  if (carregando || erro) {
    return (
      <div className="sv-app sv-pagina">
        <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
        <SidebarGlass ativo="vitimas" />
        <main className="sv-main">
          {cabecalho}
          {carregando
            ? <Esqueleto forma="lista" resumo={4} linhas={4} />
            : <ErroPagina titulo="Não foi possível carregar as vítimas" mensagem={erro} onTentar={carregar} />}
        </main>
      </div>
    )
  }

  return (
    <div className="sv-app sv-pagina">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
      <SidebarGlass ativo="vitimas" />

      <main className="sv-main">

        {cabecalho}

        {/* ── RESUMO ── */}
        <section className="sv-resumo" aria-label="Resumo das vítimas">
          {resumo.map(card => card.aoClicar ? (
            <button
              key={card.id}
              type="button"
              className={`sv-resumo-card sv-anima${card.urgente ? ' sv-resumo-card--urgente' : ''}${card.ativo ? ' sv-resumo-card--ativo' : ''}`}
              aria-pressed={card.ativo}
              onClick={card.aoClicar}
            >
              <span className={`sv-poco sv-poco--${card.tom}${card.urgente ? ' sv-poco--aceso' : ''}`}><span data-anim={card.anim}>{card.icone}</span></span>
              <span className="sv-resumo-valor">{card.valor}</span>
              <span className="sv-resumo-rotulo">{card.label}</span>
              <span className="sv-resumo-detalhe">{card.detalhe}</span>
            </button>
          ) : (
            <div key={card.id} className="sv-resumo-card">
              <span className={`sv-poco sv-poco--${card.tom}`}>{card.icone}</span>
              <span className="sv-resumo-valor">{card.valor}</span>
              <span className="sv-resumo-rotulo">{card.label}</span>
              <span className="sv-resumo-detalhe">{card.detalhe}</span>
            </div>
          ))}
        </section>

        {/* ── FILTROS ── */}
        <section className="sv-vidro sv-painel sv-filtro-painel" aria-label="Filtros">
          <div className="sv-filtro-linha">
            <label htmlFor="busca-vitima" className="sv-oculto">Buscar por nome, CPF ou telefone</label>
            <span className="sv-campo-icone sv-filtro-busca">
              <LuSearch />
              <input
                id="busca-vitima"
                type="search"
                className="sv-entrada"
                placeholder="Buscar por nome, CPF ou telefone..."
                maxLength={LIMITES.busca}
                value={filtros.busca}
                onChange={e => mudarFiltro('busca', e.target.value)}
              />
            </span>
            <label htmlFor="filtro-abrigo" className="sv-oculto">Abrigo</label>
            {selectAbrigo('filtro-abrigo')}
            <label htmlFor="filtro-ordem" className="sv-oculto">Ordenar por</label>
            {selectOrdem('filtro-ordem')}
            <button type="button" className="sv-btn sv-btn--vidro sv-so-celular" aria-haspopup="dialog" onClick={() => setMaisAberto(true)}>
              <LuSlidersHorizontal /> Filtros
              {filtrosExtras > 0 && <span className="sv-btn-num">{filtrosExtras}</span>}
            </button>
          </div>

          <div className="sv-filtro-linha sv-filtro-linha--abas">
            <div className="sv-abas vt-faixas" role="tablist" aria-label="Faixa etária" style={{ '--aba': indiceFaixa, '--abas': FAIXAS.length }}>
              <span className="sv-abas-marcador" aria-hidden="true" />
              {FAIXAS.map(f => (
                <button key={f.valor || 'todas'} type="button" role="tab" className="sv-aba"
                  aria-selected={filtros.faixa === f.valor} onClick={() => mudarFiltro('faixa', f.valor)}>
                  <span className="sv-rotulo-longo">{f.label}</span>
                  <span className="sv-rotulo-curto">{f.curto}</span>
                  <span className="sv-aba-num">{vitimasBase.filter(v => naFaixa(v, f.valor)).length}</span>
                </button>
              ))}
            </div>
            <button type="button" className="sv-btn sv-btn--vidro sv-so-desktop" aria-expanded={maisAberto && !celular}
              aria-controls="mais-filtros" onClick={() => setMaisAberto(a => !a)}>
              <LuSlidersHorizontal /> Mais filtros
              {filtrosExtras > 0 && <span className="sv-btn-num">{filtrosExtras}</span>}
            </button>
          </div>

          {/* Mais filtros: no desktop abre aqui mesmo, no celular abre a gaveta */}
          {maisAberto && !celular && (
            <div id="mais-filtros" className="sv-filtro-mais">
              <div className="sv-filtro-linha">
                <label htmlFor="filtro-cidade" className="sv-oculto">Cidade do abrigo</label>
                {selectCidade('filtro-cidade')}
              </div>
              {chipsGenero}
            </div>
          )}

          <div className="sv-filtro-ativos">
            {etiquetasAtivas.length > 0 && <span className="sv-contagem">Filtros:</span>}
            {etiquetasAtivas.map(e => (
              <button key={e.id} type="button" className="sv-chip sv-chip--removivel" onClick={e.remover} aria-label={`Remover filtro ${e.label}`}>
                {e.label} <LuX aria-hidden="true" />
              </button>
            ))}
            {filtrosAtivos && (
              <button type="button" className="sv-link" onClick={() => setFiltros(FILTROS_INICIAIS)}>Limpar filtros</button>
            )}
            <div className="vt-fim">
              <span className="sv-contagem">
                <strong>{vitimasFiltradas.length}</strong> {vitimasFiltradas.length === 1 ? 'vítima encontrada' : 'vítimas encontradas'}
              </span>
              <div className="vt-agrupar">
                <span className="vt-agrupar-rotulo" id="agrupar-rotulo">Agrupar por</span>
                <div className="sv-abas" role="tablist" aria-labelledby="agrupar-rotulo" style={{ '--aba': agrupar === 'abrigo' ? 0 : 1, '--abas': 2 }}>
                  <span className="sv-abas-marcador" aria-hidden="true" />
                  <button type="button" role="tab" className="sv-aba" aria-selected={agrupar === 'abrigo'} onClick={() => setAgrupar('abrigo')}>Abrigo</button>
                  <button type="button" role="tab" className="sv-aba" aria-selected={agrupar === 'az'} onClick={() => setAgrupar('az')}>A–Z</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── GRUPOS DE VÍTIMAS ── */}
        {vitimasFiltradas.length === 0 ? (
          <Vazio
            icone={<LuUsers />}
            titulo={vitimas.length === 0 ? 'Nenhuma vítima cadastrada ainda.' : 'Nenhuma vítima encontrada com esses filtros.'}
            dica={vitimas.length === 0
              ? 'As pessoas atendidas aparecem aqui, agrupadas pelo abrigo onde estão.'
              : 'Tente outra busca ou limpe os filtros para ver todas as vítimas.'}
            acao={vitimas.length === 0 ? (
              <button type="button" className="sv-btn sv-btn--primario" onClick={() => navigate('/cadastro-vitima')}>
                <LuPlus /> Cadastrar vítima
              </button>
            ) : (
              <button type="button" className="sv-btn sv-btn--vidro" onClick={() => setFiltros(FILTROS_INICIAIS)}>
                <LuX /> Limpar filtros
              </button>
            )}
          />
        ) : (
          <div className="vt-grupos">
            {grupos.map(grupo => {
              const aberto = buscando || !fechados.has(grupo.chave)
              const todas = completos.has(grupo.chave)
              const visiveis = todas ? grupo.pessoas : grupo.pessoas.slice(0, LIMITE_GRUPO)
              const faltam = grupo.pessoas.length - visiveis.length
              const idLista = `grupo-${grupo.chave}`

              return (
                <section key={grupo.chave} className={`vt-grupo${grupo.sem ? ' vt-grupo--sem' : ''}`} aria-label={grupo.titulo}>
                  <div className="vt-grupo-topo">
                    <button type="button" className="vt-grupo-alternar" aria-expanded={aberto} aria-controls={idLista}
                      onClick={() => alternarNoConjunto(setFechados, grupo.chave)}>
                      {grupo.letra
                        ? <span className="vt-letra" aria-hidden="true">{grupo.letra}</span>
                        : <span className={`sv-poco sv-poco--p ${grupo.sem ? 'sv-poco--sirene sv-poco--aceso' : 'sv-poco--azul'}`}>{grupo.sem ? <LuTriangleAlert /> : <LuHouse />}</span>}
                      {/* No A–Z a letra já aparece no quadrado ao lado */}
                      {!grupo.letra && (
                        <span className="vt-grupo-texto">
                          <strong>{grupo.titulo}</strong>
                          {grupo.local && <small>{grupo.local}</small>}
                        </span>
                      )}
                      <span className={`sv-tag sv-tag--lisa ${grupo.sem ? 'sv-tag--sirene' : 'sv-tag--azul'}`}>
                        {plural(grupo.pessoas.length, 'pessoa', 'pessoas')}
                      </span>
                      <LuChevronDown className="vt-seta" aria-hidden="true" />
                    </button>
                    {grupo.abrigoId && (
                      <button type="button" className="sv-btn sv-btn--vidro sv-btn--p" onClick={() => navigate(`/detalhes-abrigos/${grupo.abrigoId}`)}>
                        <LuHouse /> Abrir abrigo
                      </button>
                    )}
                  </div>

                  {aberto && (
                    <>
                      <div id={idLista} className="vt-fichas">
                        {visiveis.map(v => {
                          const idade = idadeDe(v.dataNascimento)
                          return (
                            <button key={v.id} type="button" aria-haspopup="dialog"
                              className={`vt-ficha${selecionadaId === v.id ? ' vt-ficha--aberta' : ''}`}
                              onClick={() => setSelecionadaId(v.id)}>
                              <Avatar vitima={v} />
                              <span className="vt-ficha-texto">
                                <span className="vt-ficha-nome" title={v.nome}>{v.nome}</span>
                                <span className="vt-ficha-sub">
                                  {[idade !== null ? `${idade} ano${idade !== 1 ? 's' : ''}` : null, generoCurto(v.genero)].filter(Boolean).join(' · ') || '—'}
                                  {v.deficiencias?.length > 0 && (
                                    <><LuAccessibility aria-hidden="true" /><span className="sv-oculto">, com deficiência</span></>
                                  )}
                                </span>
                                {/* No A–Z, a ficha diz onde a pessoa está */}
                                {agrupar === 'az' && (
                                  <span className={`vt-ficha-abrigo${v.abrigoId ? '' : ' vt-ficha-abrigo--sem'}`}>
                                    {v.abrigo ? v.abrigo.nome : 'Sem abrigo'}
                                  </span>
                                )}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                      {faltam > 0 && (
                        <button type="button" className="sv-btn sv-btn--vidro sv-btn--p vt-ver-mais" onClick={() => alternarNoConjunto(setCompletos, grupo.chave)}>
                          Ver mais {faltam} <LuChevronDown aria-hidden="true" />
                        </button>
                      )}
                    </>
                  )}
                </section>
              )
            })}
          </div>
        )}

        <footer className="sv-rodape">
          <p>© 2026 S.O.S Vale. Todos os direitos reservados.</p>
          <p>Versão 1.0.0</p>
        </footer>
      </main>

      {/* ── PAINEL DA PESSOA (gaveta à direita) ── */}
      {selecionada && (() => {
        const idade = idadeDe(selecionada.dataNascimento)
        const fechar = () => setSelecionadaId(null)
        return (
          <>
            <div className="sv-gaveta-fundo" onClick={fechar} aria-hidden="true" />
            <div className="sv-gaveta" role="dialog" aria-modal="true" aria-labelledby="painel-pessoa-nome"
              onKeyDown={e => { if (e.key === 'Escape') fechar() }}>
              <div className="sv-gaveta-topo">
                <div className="vt-painel-pessoa">
                  <Avatar vitima={selecionada} grande />
                  <div>
                    <h2 id="painel-pessoa-nome">{selecionada.nome}</h2>
                    <p>{[idade !== null ? `${idade} ano${idade !== 1 ? 's' : ''}` : null, generoLongo(selecionada.genero)].filter(Boolean).join(' · ')}</p>
                  </div>
                </div>
                <button type="button" className="sv-btn sv-btn--quadrado sv-btn--vidro" aria-label="Fechar" autoFocus onClick={fechar}><LuX /></button>
              </div>

              <div className="sv-gaveta-corpo vt-painel-corpo">
                <div className="vt-painel-secao">
                  <h3>Onde está</h3>
                  {selecionada.abrigo ? (
                    <div className="vt-onde">
                      <strong>{selecionada.abrigo.nome}</strong>
                      {localDoAbrigo(selecionada.abrigo) && <span>{localDoAbrigo(selecionada.abrigo)}</span>}
                      {selecionada.dataEntrada && (
                        <span>Entrada em {formatarData(selecionada.dataEntrada)} · {textoDias(diasDesde(selecionada.dataEntrada))}</span>
                      )}
                    </div>
                  ) : (
                    <p className="sv-aviso sv-aviso--atencao">
                      <LuTriangleAlert /> Sem abrigo. Para vincular, abra o abrigo e use “Vincular vítima”.
                    </p>
                  )}
                </div>

                <div className="vt-painel-secao">
                  <h3>Dados</h3>
                  <div className="sv-pares">
                    <p className="sv-par"><span>Nascimento</span><strong>{formatarData(selecionada.dataNascimento) ?? '—'}</strong></p>
                    <p className="sv-par"><span>CPF</span><strong>{selecionada.cpf || '—'}</strong></p>
                    <p className="sv-par"><span>Telefone</span><strong>{selecionada.telefone || '—'}</strong></p>
                  </div>
                </div>

                <div className="vt-painel-secao">
                  <h3>Deficiências</h3>
                  {selecionada.deficiencias?.length > 0 ? (
                    <div className="sv-etiquetas">
                      {selecionada.deficiencias.map(d => <span key={d} className="sv-tag sv-tag--lisa sv-tag--anil">{d}</span>)}
                    </div>
                  ) : (
                    <p className="sv-apoio">Nenhuma deficiência informada</p>
                  )}
                </div>
              </div>

              <div className={`sv-gaveta-rodape${selecionada.abrigoId ? '' : ' vt-painel-rodape--um'}`}>
                {selecionada.abrigoId && (
                  <button type="button" className="sv-btn sv-btn--vidro" onClick={() => navigate(`/detalhes-abrigos/${selecionada.abrigoId}`)}>
                    <LuHouse /> Abrigo
                  </button>
                )}
                <button type="button" className="sv-btn sv-btn--primario" onClick={() => navigate(`/detalhes-vitimas/${selecionada.id}`)}>
                  Ver detalhes <LuChevronRight aria-hidden="true" />
                </button>
              </div>
            </div>
          </>
        )
      })()}

      {/* ── GAVETA DE FILTROS (celular) ── */}
      {maisAberto && celular && (
        <>
          <div className="sv-gaveta-fundo" onClick={() => setMaisAberto(false)} aria-hidden="true" />
          <div className="sv-gaveta sv-gaveta--baixo" role="dialog" aria-modal="true" aria-labelledby="gaveta-filtros-titulo"
            onKeyDown={e => { if (e.key === 'Escape') setMaisAberto(false) }}>
            <div className="sv-gaveta-topo">
              <h2 id="gaveta-filtros-titulo" className="sv-painel-titulo">Filtros</h2>
              <button type="button" className="sv-btn sv-btn--quadrado sv-btn--vidro" aria-label="Fechar filtros" autoFocus onClick={() => setMaisAberto(false)}>
                <LuX />
              </button>
            </div>
            <div className="sv-gaveta-corpo">
              <div className="sv-gaveta-campos">
                <label htmlFor="gaveta-abrigo">Abrigo{selectAbrigo('gaveta-abrigo')}</label>
                <label htmlFor="gaveta-cidade">Cidade{selectCidade('gaveta-cidade')}</label>
                <label htmlFor="gaveta-ordem">Ordenar por{selectOrdem('gaveta-ordem')}</label>
              </div>
              {chipsGenero}
            </div>
            <div className="sv-gaveta-rodape">
              <button type="button" className="sv-btn sv-btn--discreto" onClick={() => setFiltros(FILTROS_INICIAIS)}>Limpar</button>
              <button type="button" className="sv-btn sv-btn--primario" onClick={() => setMaisAberto(false)}>
                Ver {plural(vitimasFiltradas.length, 'vítima', 'vítimas')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ListarVitimas;
