//--------- Imports-----------
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from "react-router-dom";
import { renderToStaticMarkup } from 'react-dom/server';
import { LuBedDouble, LuChevronRight, LuCircleCheck, LuClock, LuHouse, LuLayers, LuLocateFixed, LuMapPinOff, LuPhone, LuPlus, LuRefreshCw, LuSearch, LuSettings2, LuSiren, LuTriangleAlert, LuX } from 'react-icons/lu';
import { MapContainer, TileLayer, Marker, Popup, Circle, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import SidebarGlass from '../../../components/SidebarGlass/SidebarGlass';
import '../../../styles/sosvale-glass.css';
import { LIMITES } from '../../../utils/campos';
import { API_URL, formatarTempo } from '../../../services/api';
import { geocodificar } from '../../../services/localizacao';
import "./mapa.css";
import { ErroPagina, Vazio } from '../../../components/EstadosPagina';
import { iconeDoTipoAlerta } from '../../../utils/alertas';

// ─── Configuração do mapa ───────────────────────────────────────────────────
// Coordenadas conhecidas das cidades (as outras são buscadas no Nominatim)
const COORDENADAS_CIDADES = {
  'Taubaté':          [-23.0268, -45.5557],
  'Caçapava':         [-23.1008, -45.7069],
  'Pindamonhangaba':  [-22.9238, -45.4603],
  'São José dos Campos': [-23.1896, -45.8841],
  'Tremembé':         [-22.9575, -45.5494],
  'Jacareí':          [-23.3053, -45.9658],
  'Guaratinguetá':    [-22.8075, -45.1938],
}
const CIDADE_PADRAO = 'Taubaté'
const ZOOM_CIDADE = 13
const ZOOM_DETALHE = 16

// Ao abrir, o balão se afasta da barra de vidro do topo do mapa (cidade, busca, camadas)
const FOLGA_BALAO = [16, 130]

// O mapa não deixa "fugir" muito do Vale do Paraíba
const LIMITES_VALE = [[-24.3, -46.9], [-22.1, -44.0]]

// Cores e tamanhos dos círculos de alerta por gravidade
const ESTILO_GRAVIDADE = {
  leve:  { cor: '#eab308', raio: 500, label: 'Leve' },
  medio: { cor: '#f97316', raio: 700, label: 'Médio' },
  grave: { cor: '#dc2626', raio: 900, label: 'Grave' },
}

// Cores dos abrigos pela ocupação
const COR_ABRIGO = {
  livre:   '#16a34a', // menos de 70%
  atencao: '#f59e0b', // 70% a 99%
  lotado:  '#dc2626', // cheio ou inativo
}

// Etiquetas (sv-tag) da lista lateral: as mesmas faixas da legenda
const TAG_GRAVIDADE = {
  leve:  'sv-tag--neutro',
  medio: 'sv-tag--atencao',
  grave: 'sv-tag--sirene',
}
const TAG_ABRIGO = {
  livre:   { label: 'Com vagas',    classe: 'sv-tag--ok' },
  atencao: { label: 'Acima de 70%', classe: 'sv-tag--atencao' },
  lotado:  { label: 'Lotado',       classe: 'sv-tag--sirene' },
}

// Coordenadas já descobertas ficam guardadas no navegador
// (o Nominatim pede no máximo 1 consulta por segundo)
const CHAVE_CACHE = 'sosvale_mapa_coordenadas'
function lerCache() {
  try { return JSON.parse(localStorage.getItem(CHAVE_CACHE)) ?? {} } catch { return {} }
}
function salvarCache(cache) {
  try { localStorage.setItem(CHAVE_CACHE, JSON.stringify(cache)) } catch { /* sem espaço: ignora */ }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const porcentagemOcupacao = (abrigo) => {
  if (!abrigo.capacidadeTotal) return 0
  return Math.min(100, Math.round((abrigo.capacidadeOcupada / abrigo.capacidadeTotal) * 100))
}

const situacaoAbrigo = (abrigo) => {
  const pct = porcentagemOcupacao(abrigo)
  if (abrigo.status !== 'ativo' || pct >= 100) return 'lotado'
  if (pct >= 70) return 'atencao'
  return 'livre'
}

// Pino do abrigo: casinha na cor da ocupação
const iconesAbrigo = {}
function iconeAbrigo(situacao) {
  if (!iconesAbrigo[situacao]) {
    const casa = renderToStaticMarkup(<LuHouse />)
    iconesAbrigo[situacao] = L.divIcon({
      className: 'mapa-pino-wrapper',
      html: `<div class="mapa-pino" style="--cor:${COR_ABRIGO[situacao]}"><span>${casa}</span></div>`,
      iconSize: [34, 42],
      iconAnchor: [17, 40],
      popupAnchor: [0, -36],
    })
  }
  return iconesAbrigo[situacao]
}

// ─── Componentes auxiliares (precisam estar dentro do MapContainer) ─────────
// Entrega a instância do Leaflet para a tela controlar o mapa (voar, abrir popup)
function CapturarMapa({ aoCarregar }) {
  const map = useMap()
  useEffect(() => { aoCarregar(map) }, [map, aoCarregar])
  return null
}


//------- Começo Função Principal -----
// modulo: 'admin' (rota /mapa) ou 'voluntario' (rota /voluntario/mapa)
function Mapa({ modulo = 'admin' }) {

  const ehVoluntario = modulo === 'voluntario'
  const sidebar = ehVoluntario ? <SidebarGlass modulo="voluntario" ativo="mapa" /> : <SidebarGlass ativo="mapa" />
  const navigate = useNavigate()

  // ─── ESTADOS ────────────────────────────────────────────────
  const [abrigos, setAbrigos] = useState([])
  const [alertas, setAlertas] = useState([])          // alertas ativos com coordenadas
  const [cidades, setCidades] = useState([])
  const [cidadeSelecionada, setCidadeSelecionada] = useState(CIDADE_PADRAO)
  // O voluntário vê só os abrigos; os alertas ficam no mapa do admin
  const mostraAlertas = !ehVoluntario
  const [camadas, setCamadas] = useState({ abrigos: true, alertas: mostraAlertas })
  const [busca, setBusca] = useState('')
  const [sugestoes, setSugestoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState(null) // falha ao buscar abrigos/cidades
  const [avisoAlertas, setAvisoAlertas] = useState('')
  const [atualizadoEm, setAtualizadoEm] = useState(null)
  const [abaPainel, setAbaPainel] = useState(null)        // 'alertas' | 'abrigos' (null = automático)
  const [legendaAberta, setLegendaAberta] = useState(false)

  const mapaRef = useRef(null)
  const marcadoresRef = useRef({})   // id do abrigo → marcador Leaflet
  const circulosRef = useRef({})     // id do alerta → círculo Leaflet
  const guardarMapa = useCallback((map) => { mapaRef.current = map }, [])


  //-------- Busca dos dados ----------------
  // Função própria para o botão "Tentar novamente" poder chamar de novo
  const carregar = useCallback(async () => {
      setCarregando(true)
      setErroCarga(null)
      try {
        const [respAbrigos, respCidades] = await Promise.all([
          fetch(`${API_URL}/api/abrigos/listar`).then(r => { if (!r.ok) throw new Error(`Erro ${r.status}`); return r.json() }),
          fetch(`${API_URL}/api/cidades/listar`).then(r => { if (!r.ok) throw new Error(`Erro ${r.status}`); return r.json() }),
        ])
        setAbrigos(respAbrigos.abrigos ?? [])
        setCidades(respCidades.cidades ?? [])
      } catch (erro) {
        console.error('Erro ao carregar o mapa:', erro)
        setErroCarga('O servidor não respondeu. Verifique a conexão e tente novamente.')
      } finally {
        setCarregando(false)
      }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // Alertas ativos: busca agora e a cada 1 minuto
  const buscarAlertas = useCallback(async () => {
    if (!mostraAlertas) return
    // No módulo do voluntário o login é o token_voluntario (antes só lia o do admin
    // e o voluntário nunca via os alertas). A rota /mapa/alertas aceita os dois.
    const token = localStorage.getItem(ehVoluntario ? 'token_voluntario' : 'token_adm')
    if (!token) {
      setAvisoAlertas('Faça login para ver os alertas ativos.')
      return
    }
    try {
      const resposta = await fetch(`${API_URL}/api/mapa/alertas`, { headers: { Authorization: `Bearer ${token}` } })
      const dados = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(dados.mensagem ?? `Erro ${resposta.status}`)
      setAvisoAlertas('')
      setAtualizadoEm(new Date())
      setAlertas(await posicionarAlertas(dados.alertas ?? []))
    } catch (erro) {
      console.error('Erro ao buscar alertas:', erro)
      setAvisoAlertas('Não foi possível carregar os alertas ativos.')
    }
    // posicionarAlertas usa os abrigos já carregados
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostraAlertas, abrigos, ehVoluntario])

  useEffect(() => {
    if (carregando || !mostraAlertas) return
    buscarAlertas()
    const intervalo = setInterval(buscarAlertas, 60 * 1000)
    return () => clearInterval(intervalo)
  }, [carregando, mostraAlertas, buscarAlertas])

  // Descobre onde desenhar cada alerta (o alerta é do bairro, não tem ponto exato):
  // 1) cache do navegador → 2) média dos abrigos do mesmo bairro →
  // 3) Nominatim (bairro, cidade) → 4) centro da cidade
  async function posicionarAlertas(lista) {
    const cache = lerCache()
    const resultado = []

    for (const alerta of lista) {
      const chave = `bairro:${alerta.bairroId}`
      let ponto = cache[chave]

      if (!ponto) {
        const doBairro = abrigos.filter(a => a.bairroId === alerta.bairroId && a.latitude && a.longitude)
        if (doBairro.length > 0) {
          ponto = {
            latitude:  doBairro.reduce((s, a) => s + a.latitude, 0) / doBairro.length,
            longitude: doBairro.reduce((s, a) => s + a.longitude, 0) / doBairro.length,
            precisao: 'bairro',
          }
        } else {
          const achado = await geocodificar({ bairro: alerta.bairro, cidade: alerta.cidade, estado: alerta.estado })
          if (achado) ponto = { latitude: achado.latitude, longitude: achado.longitude, precisao: achado.precisao }
        }
        // Só guarda no cache o que foi achado pelo bairro (o centro da cidade é provisório)
        if (ponto?.precisao === 'bairro') {
          cache[chave] = ponto
          salvarCache(cache)
        }
      }

      if (!ponto && COORDENADAS_CIDADES[alerta.cidade]) {
        const [latitude, longitude] = COORDENADAS_CIDADES[alerta.cidade]
        ponto = { latitude, longitude, precisao: 'cidade' }
      }
      if (ponto) resultado.push({ ...alerta, ...ponto })
    }

    // Vários alertas no mesmo bairro: afasta um pouco os círculos para não ficarem idênticos
    const vistos = {}
    return resultado.map(alerta => {
      const indice = vistos[alerta.bairroId] = (vistos[alerta.bairroId] ?? -1) + 1
      if (indice === 0) return alerta
      const angulo = indice * 2.1
      return { ...alerta, latitude: alerta.latitude + Math.sin(angulo) * 0.003, longitude: alerta.longitude + Math.cos(angulo) * 0.003 }
    })
  }


  //-------- Cidade selecionada ----------------
  // Coordenadas da cidade: tabela conhecida → abrigos da cidade → Nominatim
  const centroDaCidade = useCallback(async (nome) => {
    if (COORDENADAS_CIDADES[nome]) return COORDENADAS_CIDADES[nome]
    const daCidade = abrigos.filter(a => a.cidade === nome && a.latitude && a.longitude)
    if (daCidade.length > 0) return [daCidade[0].latitude, daCidade[0].longitude]

    const cache = lerCache()
    if (cache[`cidade:${nome}`]) return cache[`cidade:${nome}`]
    const cidade = cidades.find(c => c.nome === nome)
    const achado = await geocodificar({ cidade: nome, estado: cidade?.estado })
    if (!achado) return null
    cache[`cidade:${nome}`] = [achado.latitude, achado.longitude]
    salvarCache(cache)
    return cache[`cidade:${nome}`]
  }, [abrigos, cidades])

  // Todos os pontos visíveis (abrigos + alertas) de uma cidade — ou de todas
  const pontosDa = useCallback((nome) => [
    ...(camadas.abrigos ? abrigos.filter(a => a.latitude && a.longitude && (!nome || a.cidade === nome)) : []),
    ...(camadas.alertas ? alertas.filter(a => !nome || a.cidade === nome) : []),
  ].map(p => [p.latitude, p.longitude]), [abrigos, alertas, camadas])

  const enquadrar = useCallback(async (nome) => {
    const map = mapaRef.current
    if (!map) return
    map.closePopup()

    if (nome === 'todas') {
      const pontos = pontosDa(null)
      if (pontos.length > 0) map.flyToBounds(pontos, { padding: [60, 60], maxZoom: 14, duration: 1 })
      else map.flyTo([-23.0, -45.55], 10, { duration: 1 })
      return
    }
    const centro = await centroDaCidade(nome)
    if (centro) map.flyTo(centro, ZOOM_CIDADE, { duration: 1 })
  }, [centroDaCidade, pontosDa])

  // Ao abrir a tela (e ao trocar a cidade), centraliza na cidade escolhida
  useEffect(() => {
    if (!carregando) enquadrar(cidadeSelecionada)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando, cidadeSelecionada])


  //-------- Busca e foco ----------------
  const handleBusca = (e) => {
    const valor = e.target.value
    setBusca(valor)
    if (valor.trim().length < 2) {
      setSugestoes([])
      return
    }
    const termo = valor.toLowerCase()
    const achaAbrigos = abrigos
      .filter(a => [a.nome, a.cidade, a.bairro].some(t => t?.toLowerCase().includes(termo)))
      .map(a => ({ tipo: 'abrigo', item: a, titulo: a.nome, detalhe: [a.bairro, a.cidade].filter(Boolean).join(' — ') }))
    const achaAlertas = alertas
      .filter(a => [a.tipoLabel, a.bairro, a.cidade].some(t => t?.toLowerCase().includes(termo)))
      .map(a => ({ tipo: 'alerta', item: a, titulo: a.tipoLabel, detalhe: `${a.bairro} — ${a.cidade}` }))
    setSugestoes([...achaAlertas, ...achaAbrigos].slice(0, 8))
  }

  // Voa até o abrigo ou alerta e abre o balão dele
  const focar = (tipo, item) => {
    const map = mapaRef.current
    if (!map || !item.latitude || !item.longitude) return
    if (tipo === 'abrigo' && !camadas.abrigos) setCamadas(c => ({ ...c, abrigos: true }))
    if (tipo === 'alerta' && !camadas.alertas) setCamadas(c => ({ ...c, alertas: true }))

    map.flyTo([item.latitude, item.longitude], tipo === 'abrigo' ? ZOOM_DETALHE : 14.5, { duration: 1 })
    map.once('moveend', () => {
      const camada = tipo === 'abrigo' ? marcadoresRef.current[item.id] : circulosRef.current[item.id_alerta]
      camada?.openPopup()
    })
  }

  const selecionarSugestao = (sugestao) => {
    setBusca(sugestao.titulo)
    setSugestoes([])
    focar(sugestao.tipo, sugestao.item)
  }


  //-------- Números do painel ----------------
  const filtroCidade = (item) => cidadeSelecionada === 'todas' || item.cidade === cidadeSelecionada
  const abrigosDaCidade = useMemo(() => abrigos.filter(filtroCidade), [abrigos, cidadeSelecionada]) // eslint-disable-line react-hooks/exhaustive-deps
  const alertasDaCidade = useMemo(() => alertas.filter(filtroCidade), [alertas, cidadeSelecionada]) // eslint-disable-line react-hooks/exhaustive-deps

  const resumo = useMemo(() => ({
    abrigos: abrigosDaCidade.length,
    vagas: abrigosDaCidade
      .filter(a => a.status === 'ativo')
      .reduce((soma, a) => soma + Math.max(0, a.capacidadeTotal - a.capacidadeOcupada), 0),
    quaseLotados: abrigosDaCidade.filter(a => situacaoAbrigo(a) !== 'livre').length,
    alertas: alertasDaCidade.length,
    graves: alertasDaCidade.filter(a => a.gravidade === 'grave').length,
  }), [abrigosDaCidade, alertasDaCidade])

  const semLocalizacao = abrigos.filter(a => !a.latitude || !a.longitude).length

  // Lista lateral: alertas mais graves primeiro; abrigos mais cheios primeiro
  const alertasOrdenados = [...alertasDaCidade].sort((a, b) => b.pesoGravidade - a.pesoGravidade)
  const abrigosOrdenados = [...abrigosDaCidade].sort((a, b) => porcentagemOcupacao(b) - porcentagemOcupacao(a))


  //-------- Textos e destaques do topo ----------------
  const titulo = mostraAlertas ? 'Mapa de abrigos e alertas' : 'Mapa de abrigos'
  const trilha = (
    <p className="sv-trilha">
      <a href={ehVoluntario ? '/painel-voluntario' : '/pg_adm'}>{ehVoluntario ? 'Home' : 'Visão geral'}</a>
      &gt; <span>{ehVoluntario ? 'Mapa de abrigos' : 'Mapa da região'}</span>
    </p>
  )
  const emCidade = cidadeSelecionada === 'todas' ? '' : ` em ${cidadeSelecionada}`

  // A faixa de urgência leva até o alerta mais grave da cidade
  const alertaMaisGrave = alertasOrdenados[0]

  // Aba do painel: até a pessoa escolher, abre em "Alertas" quando há alerta na cidade
  const aba = !mostraAlertas
    ? 'abrigos'
    : (abaPainel ?? (alertasDaCidade.length > 0 ? 'alertas' : 'abrigos'))

  // Linha de números (antes eram 3 cards grandes): mesmos valores e textos
  const numeros = [
    {
      id: 'abrigos', icone: <LuHouse />, tom: 'azul', rotulo: 'Abrigos', valor: resumo.abrigos,
      detalhe: resumo.quaseLotados > 0 ? `${resumo.quaseLotados} quase lotado(s) ou lotado(s)` : 'todos com folga',
    },
    { id: 'vagas', icone: <LuBedDouble />, tom: 'ciano', rotulo: 'Vagas livres', valor: resumo.vagas, detalhe: 'nos abrigos ativos' },
    ...(mostraAlertas ? [{
      id: 'alertas', icone: <LuSiren />, tom: resumo.alertas > 0 ? 'sirene' : 'petroleo', rotulo: 'Alertas ativos',
      valor: resumo.alertas, detalhe: resumo.graves > 0 ? `${resumo.graves} grave(s)` : 'nenhum grave', urgente: resumo.alertas > 0,
    }] : []),
  ]


  //------- Carregando / erro ------
  if (carregando || erroCarga) {
    return (
      <div className="sv-app sv-pagina">
        <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
        {sidebar}
        <main className="sv-main mapa-main">
          <header className="sv-topo">
            <div className="sv-topo-texto">
              {trilha}
              <h1 className="sv-titulo">{titulo}</h1>
            </div>
          </header>
          {carregando ? (
            // Esqueleto no formato da página: números, mapa e painel
            <div className="mapa-esqueleto" aria-busy="true" aria-label="Carregando o mapa">
              <div className="mapa-numeros">
                {numeros.map(n => <div key={n.id} className="sv-esqueleto mapa-esq-numero" />)}
              </div>
              <div className="mapa-layout">
                <div className="sv-esqueleto mapa-esq-mapa" />
                <div className="sv-esqueleto mapa-esq-painel" />
              </div>
            </div>
          ) : (
            <ErroPagina titulo="Não foi possível carregar o mapa" mensagem={erroCarga} onTentar={carregar} />
          )}
        </main>
      </div>
    )
  }


  //------- Tela Principal ------
  return (
    <div className="sv-app sv-pagina">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
      {sidebar}

      <main className="sv-main mapa-main">

        <header className="sv-topo">
          <div className="sv-topo-texto">
            {trilha}
            <h1 className="sv-titulo">{titulo}</h1>
            <p className="sv-subtitulo">
              {mostraAlertas
                ? 'Abrigos cadastrados e alertas ativos nas cidades do Vale do Paraíba'
                : 'Abrigos cadastrados nas cidades do Vale do Paraíba'}
            </p>
          </div>
          {!ehVoluntario && (
            <div className="sv-topo-acoes">
              <button type="button" className="sv-btn sv-btn--vidro sv-anima" onClick={() => navigate('/regioes')}>
                <span data-anim="giro"><LuSettings2 /></span> Gerenciar regiões
              </button>
            </div>
          )}
        </header>

        {/* ─── Faixa de urgência: só aparece com alerta ativo na cidade ─── */}
        {mostraAlertas && alertaMaisGrave && (
          <section className="mapa-urgencia" role="status">
            <span className="mapa-urgencia-icone" aria-hidden="true"><LuSiren /></span>
            <p className="mapa-urgencia-texto">
              <strong>
                {alertasDaCidade.length} {alertasDaCidade.length === 1 ? 'alerta ativo' : 'alertas ativos'}{emCidade}
                {resumo.graves > 0 ? ` · ${resumo.graves} grave(s)` : ' · nenhum grave'}
              </strong>
              <span>Mais grave: {alertaMaisGrave.tipoLabel} — {alertaMaisGrave.bairro}</span>
            </p>
            <button type="button" className="sv-btn sv-btn--perigo sv-btn--p sv-anima" onClick={() => focar('alerta', alertaMaisGrave)}>
              Ver no mapa <span data-anim="pulo"><LuChevronRight /></span>
            </button>
          </section>
        )}

        {/* ─── Números da cidade selecionada ─── */}
        <section className="mapa-numeros" aria-label="Resumo da cidade selecionada">
          {numeros.map(n => (
            <div key={n.id} className={`mapa-numero${n.urgente ? ' mapa-numero--urgente' : ''}`}>
              <span className={`sv-poco sv-poco--p sv-poco--${n.tom}${n.urgente ? ' sv-poco--aceso' : ''}`}>{n.icone}</span>
              <div className="mapa-numero-texto">
                <span className="mapa-numero-rotulo">{n.rotulo}</span>
                <strong>{n.valor}</strong>
                <small>{n.detalhe}</small>
              </div>
            </div>
          ))}
        </section>

        {avisoAlertas && (
          <p className="sv-aviso sv-aviso--atencao mapa-aviso" role="alert"><LuTriangleAlert /> {avisoAlertas}</p>
        )}

        {/* ─── Mapa + painel lateral ─── */}
        <div className="mapa-layout">

          <div className="mapa-area">
            <MapContainer
              center={COORDENADAS_CIDADES[CIDADE_PADRAO]}
              zoom={ZOOM_CIDADE}
              minZoom={8}
              maxZoom={18}
              maxBounds={LIMITES_VALE}
              maxBoundsViscosity={0.8}
              // Zoom mais suave: meio nível por clique e rolagem mais "fina"
              zoomSnap={0.25}
              zoomDelta={0.5}
              wheelPxPerZoomLevel={100}
              scrollWheelZoom={true}
              zoomControl={false}
              style={{ width: '100%', height: '100%' }}
            >
              <CapturarMapa aoCarregar={guardarMapa} />
              <ZoomControl position="bottomright" />

              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
              />

              {/* Círculos dos alertas ativos (mais graves por cima) */}
              {camadas.alertas && [...alertas].sort((a, b) => a.pesoGravidade - b.pesoGravidade).map(alerta => {
                const estilo = ESTILO_GRAVIDADE[alerta.gravidade] ?? ESTILO_GRAVIDADE.leve
                const aproximado = alerta.precisao === 'cidade'
                return (
                  <Circle
                    key={alerta.id_alerta}
                    ref={camada => { if (camada) circulosRef.current[alerta.id_alerta] = camada }}
                    center={[alerta.latitude, alerta.longitude]}
                    radius={estilo.raio}
                    pathOptions={{
                      color: estilo.cor, fillColor: estilo.cor, fillOpacity: 0.22, weight: 2,
                      dashArray: aproximado ? '6 6' : null,
                      className: `mapa-circulo-alerta ${alerta.gravidade}`,
                    }}
                  >
                    <Popup autoPanPaddingTopLeft={FOLGA_BALAO}>
                      <div className="mapa-popup">
                        <span className="mapa-popup-selo" style={{ background: estilo.cor }}>{estilo.label}</span>
                        <strong className="mapa-popup-titulo">{iconeDoTipoAlerta(alerta.tipo)} {alerta.tipoLabel}</strong>
                        <span className="mapa-popup-sub">{alerta.bairro} — {alerta.cidade}/{alerta.estado}</span>
                        <span className="mapa-popup-info">
                          <LuCircleCheck /> Confirmado por {alerta.totalRelatos} morador(es)
                          {alerta.disparadoPorAdmin ? ' + administrador' : ''}
                        </span>
                        {alerta.disparadoEm && <span className="mapa-popup-info"><LuClock /> {formatarTempo(alerta.disparadoEm)}</span>}
                        {aproximado && <span className="mapa-popup-aviso">Localização aproximada (centro da cidade)</span>}
                        {alerta.orientacao && <p className="mapa-popup-orientacao">{alerta.orientacao}</p>}
                        {!ehVoluntario && (
                          <button type="button" className="mapa-popup-botao" onClick={() => navigate(`/alertas/${alerta.id_alerta}`)}>
                            Abrir alerta
                          </button>
                        )}
                      </div>
                    </Popup>
                  </Circle>
                )
              })}

              {/* Pinos dos abrigos */}
              {camadas.abrigos && abrigos.filter(a => a.latitude && a.longitude).map(abrigo => {
                const pct = porcentagemOcupacao(abrigo)
                const situacao = situacaoAbrigo(abrigo)
                const vagas = Math.max(0, abrigo.capacidadeTotal - abrigo.capacidadeOcupada)
                return (
                  <Marker
                    key={abrigo.id}
                    ref={marcador => { if (marcador) marcadoresRef.current[abrigo.id] = marcador }}
                    position={[abrigo.latitude, abrigo.longitude]}
                    icon={iconeAbrigo(situacao)}
                  >
                    <Popup autoPanPaddingTopLeft={FOLGA_BALAO}>
                      <div className="mapa-popup">
                        <strong className="mapa-popup-titulo">{abrigo.nome}</strong>
                        <span className="mapa-popup-sub">
                          {abrigo.tipoAbrigo} · {[abrigo.bairro, abrigo.cidade].filter(Boolean).join(' — ')}
                        </span>
                        <span className="mapa-popup-sub">{abrigo.endereco}</span>

                        <div className="mapa-popup-ocupacao">
                          <span>{abrigo.capacidadeOcupada} / {abrigo.capacidadeTotal} pessoas</span>
                          <span style={{ color: COR_ABRIGO[situacao] }}>{pct}%</span>
                        </div>
                        <div className="mapa-barra">
                          <div style={{ width: `${pct}%`, background: COR_ABRIGO[situacao] }} />
                        </div>
                        <span className="mapa-popup-info">
                          {abrigo.status !== 'ativo' ? 'Abrigo inativo' : vagas > 0 ? `${vagas} vaga(s) livre(s)` : 'Sem vagas'}
                        </span>
                        {abrigo.telefone && <span className="mapa-popup-info"><LuPhone /> {abrigo.telefone}</span>}
                        {mostraAlertas && abrigo.statusAlerta && <span className="mapa-popup-aviso"><LuTriangleAlert /> Há alerta ativo neste bairro</span>}

                        {!ehVoluntario && (
                          <button type="button" className="mapa-popup-botao" onClick={() => navigate(`/detalhes-abrigos/${abrigo.id}`)}>
                            Ver detalhes do abrigo
                          </button>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                )
              })}
            </MapContainer>

            {/* ─── Barra de vidro por cima do mapa: cidade, busca e camadas ─── */}
            <div className="mapa-controles">
              <select
                aria-label="Cidade"
                value={cidadeSelecionada}
                onChange={e => setCidadeSelecionada(e.target.value)}
                className="mapa-select"
              >
                {cidades.map(c => <option key={c.id_cidade} value={c.nome}>{c.nome}</option>)}
                {!cidades.some(c => c.nome === CIDADE_PADRAO) && <option value={CIDADE_PADRAO}>{CIDADE_PADRAO}</option>}
                <option value="todas">Todas as cidades</option>
              </select>

              <div className="mapa-busca">
                <LuSearch className="mapa-busca-icone" aria-hidden="true" />
                <input
                  placeholder={mostraAlertas ? 'Buscar abrigo, bairro, cidade ou tipo de alerta...' : 'Buscar abrigo, bairro ou cidade...'}
                  aria-label="Buscar"
                  maxLength={LIMITES.busca}
                  value={busca}
                  onChange={handleBusca}
                  onBlur={() => setTimeout(() => setSugestoes([]), 200)}
                />
                {sugestoes.length > 0 && (
                  <ul className="mapa-sugestoes">
                    {sugestoes.map(s => (
                      <li key={`${s.tipo}-${s.item.id ?? s.item.id_alerta}`} onMouseDown={() => selecionarSugestao(s)}>
                        <span className={`mapa-sugestao-tipo ${s.tipo}`}>{s.tipo === 'abrigo' ? 'Abrigo' : 'Alerta'}</span>
                        <span className="mapa-sugestao-titulo">{s.titulo}</span>
                        <span className="mapa-sugestao-detalhe">{s.detalhe}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Liga/desliga camadas — só faz sentido quando há alertas */}
              {mostraAlertas && (
                <div className="mapa-camadas" role="group" aria-label="Camadas do mapa">
                  <button
                    type="button"
                    className="mapa-camada"
                    aria-pressed={camadas.abrigos}
                    onClick={() => setCamadas(c => ({ ...c, abrigos: !c.abrigos }))}
                  >
                    <i className="mapa-camada-ponto" style={{ '--cor': COR_ABRIGO.livre }} aria-hidden="true" /> Abrigos
                  </button>
                  <button
                    type="button"
                    className="mapa-camada"
                    aria-pressed={camadas.alertas}
                    onClick={() => setCamadas(c => ({ ...c, alertas: !c.alertas }))}
                  >
                    <i className="mapa-camada-ponto" style={{ '--cor': ESTILO_GRAVIDADE.grave.cor }} aria-hidden="true" /> Alertas
                  </button>
                </div>
              )}
            </div>

            {/* Centralizar e atualizar (acima do zoom) */}
            <div className="mapa-flutuante mapa-acoes">
              <button type="button" title="Centralizar na cidade" aria-label="Centralizar na cidade" onClick={() => enquadrar(cidadeSelecionada)}>
                <LuLocateFixed />
              </button>
              {mostraAlertas && (
                <button type="button" title="Atualizar alertas" aria-label="Atualizar alertas" onClick={buscarAlertas}>
                  <LuRefreshCw />
                </button>
              )}
            </div>

            {/* Legenda: fica fechada num botão e abre por cima do mapa */}
            <div className="mapa-legenda-caixa">
              {legendaAberta && (
                <div id="mapa-legenda" className="mapa-flutuante mapa-legenda">
                  <strong>Abrigos</strong>
                  <span><i style={{ background: COR_ABRIGO.livre }} /> Com vagas</span>
                  <span><i style={{ background: COR_ABRIGO.atencao }} /> Acima de 70%</span>
                  <span><i style={{ background: COR_ABRIGO.lotado }} /> Lotado / inativo</span>
                  {mostraAlertas && <>
                    <strong>Alertas</strong>
                    {Object.entries(ESTILO_GRAVIDADE).map(([chave, e]) => (
                      <span key={chave}><i className="circulo" style={{ borderColor: e.cor, background: `${e.cor}40` }} /> {e.label}</span>
                    ))}
                    <span><i className="circulo tracejado" /> Posição aproximada</span>
                  </>}
                </div>
              )}
              <button
                type="button"
                className="mapa-flutuante mapa-legenda-botao"
                aria-expanded={legendaAberta}
                aria-controls="mapa-legenda"
                onClick={() => setLegendaAberta(a => !a)}
              >
                {legendaAberta ? <LuX /> : <LuLayers />} Legenda
              </button>
            </div>
          </div>

          {/* ─── Painel lateral ─── */}
          <aside className="sv-vidro mapa-painel" aria-label={mostraAlertas ? 'Alertas e abrigos da cidade' : 'Abrigos da cidade'}>
            <div className="mapa-painel-topo">
              {mostraAlertas ? (
                <div
                  className="sv-abas mapa-abas"
                  role="tablist"
                  aria-label="O que listar"
                  style={{ '--aba': aba === 'alertas' ? 0 : 1, '--abas': 2 }}
                >
                  <span className="sv-abas-marcador" aria-hidden="true" />
                  <button type="button" role="tab" className="sv-aba" aria-selected={aba === 'alertas'} onClick={() => setAbaPainel('alertas')}>
                    Alertas<span className="sv-aba-num">{alertasDaCidade.length}</span>
                  </button>
                  <button type="button" role="tab" className="sv-aba" aria-selected={aba === 'abrigos'} onClick={() => setAbaPainel('abrigos')}>
                    Abrigos<span className="sv-aba-num">{abrigosDaCidade.length}</span>
                  </button>
                </div>
              ) : (
                <h2 className="mapa-painel-titulo">Abrigos</h2>
              )}
              <small className="mapa-painel-nota">
                {aba === 'alertas'
                  ? `mais graves primeiro${atualizadoEm ? ` · atualizado ${atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}`
                  : 'mais cheios primeiro'}
              </small>
            </div>

            <div className="mapa-painel-lista">
              {aba === 'alertas' ? (
                alertasOrdenados.length === 0 ? (
                  <Vazio
                    icone={<LuSiren />}
                    titulo={`Nenhum alerta ativo${emCidade}.`}
                    dica="Quando moradores confirmarem uma ocorrência pelo WhatsApp, o alerta aparece aqui e no mapa."
                  />
                ) : alertasOrdenados.map(alerta => {
                  const estilo = ESTILO_GRAVIDADE[alerta.gravidade] ?? ESTILO_GRAVIDADE.leve
                  return (
                    <button key={alerta.id_alerta} type="button" className="mapa-item" style={{ '--cor': estilo.cor }} onClick={() => focar('alerta', alerta)}>
                      <span className="mapa-item-linha">
                        <span className="mapa-item-titulo">{iconeDoTipoAlerta(alerta.tipo)} {alerta.tipoLabel}</span>
                        <span className={`sv-tag sv-tag--lisa ${TAG_GRAVIDADE[alerta.gravidade] ?? 'sv-tag--neutro'}`}>{estilo.label}</span>
                      </span>
                      <span className="mapa-item-sub">{alerta.bairro}{cidadeSelecionada === 'todas' ? ` — ${alerta.cidade}` : ''}</span>
                      {alerta.disparadoEm && <span className="mapa-item-sub"><LuClock /> {formatarTempo(alerta.disparadoEm)}</span>}
                    </button>
                  )
                })
              ) : (
                abrigosOrdenados.length === 0 ? (
                  <Vazio
                    icone={<LuHouse />}
                    titulo={`Nenhum abrigo cadastrado${emCidade}.`}
                    dica={ehVoluntario
                      ? 'Escolha outra cidade no mapa para ver os abrigos de lá.'
                      : 'Os abrigos cadastrados aparecem aqui e no mapa, com a cor da ocupação.'}
                    acao={!ehVoluntario && (
                      <button type="button" className="sv-btn sv-btn--primario sv-btn--p" onClick={() => navigate('/cadastrar-abrigos')}>
                        <LuPlus /> Cadastrar abrigo
                      </button>
                    )}
                  />
                ) : abrigosOrdenados.map(abrigo => {
                  const situacao = situacaoAbrigo(abrigo)
                  const pct = porcentagemOcupacao(abrigo)
                  const semPonto = !abrigo.latitude || !abrigo.longitude
                  const etiqueta = abrigo.status !== 'ativo'
                    ? { label: 'Inativo', classe: 'sv-tag--neutro' }
                    : TAG_ABRIGO[situacao]
                  return (
                    <button
                      key={abrigo.id}
                      type="button"
                      className="mapa-item"
                      style={{ '--cor': COR_ABRIGO[situacao] }}
                      onClick={() => focar('abrigo', abrigo)}
                      disabled={semPonto}
                      title={semPonto ? 'Abrigo sem localização cadastrada' : undefined}
                    >
                      <span className="mapa-item-linha">
                        <span className="mapa-item-titulo">{abrigo.nome}</span>
                        <span className={`sv-tag sv-tag--lisa ${etiqueta.classe}`}>{etiqueta.label}</span>
                      </span>
                      <span className="mapa-item-sub">{abrigo.capacidadeOcupada}/{abrigo.capacidadeTotal} · {pct}%{abrigo.bairro ? ` · ${abrigo.bairro}` : ''}</span>
                      <div className="mapa-barra"><div style={{ width: `${pct}%`, background: COR_ABRIGO[situacao] }} /></div>
                      {semPonto && <span className="mapa-item-sub mapa-item-aviso"><LuMapPinOff /> Sem localização no mapa</span>}
                    </button>
                  )
                })
              )}
            </div>
          </aside>
        </div>

        {semLocalizacao > 0 && (
          <p className="sv-aviso sv-aviso--atencao mapa-aviso">
            <LuMapPinOff /> {semLocalizacao} abrigo(s) sem localização cadastrada (não aparecem no mapa)
          </p>
        )}

        <footer className="sv-rodape">
          <p>© 2026 S.O.S Vale. Todos os direitos reservados.</p>
          <p>Versão 1.0.0</p>
        </footer>

      </main>
    </div>
  )
}

export default Mapa;
