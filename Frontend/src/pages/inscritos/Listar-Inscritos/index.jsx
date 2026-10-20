// --------- Imports -----------
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuEye, LuHouse, LuMail, LuPhone, LuTriangleAlert, LuUsers } from 'react-icons/lu';
import SidebarGlass from '../../../components/SidebarGlass/SidebarGlass';
import '../../../styles/sosvale-glass.css';
import { Esqueleto, ErroPagina, Vazio } from '../../../components/EstadosPagina';
import { LIMITES } from '../../../utils/campos';
import { apiAdmin, formatarTelefone } from '../../../services/api';
import '../../alertas/alertas.css';

// Minúsculo e sem acento — para a busca achar "joao" em "João"
const normalizar = (texto) => String(texto ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function ListarInscritos() {

  const navigate = useNavigate();

  // ─── ESTADOS ────────────────────────────────────────────────
  const [inscritos, setInscritos] = useState([])
  const [cidades, setCidades] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const [busca, setBusca] = useState('')
  const [filtroCidade, setFiltroCidade] = useState('')
  const [filtroAtivo, setFiltroAtivo] = useState('')

  // ─── BUSCA DA API ────────────────────────────────────────────
  // Função própria para o botão "Tentar novamente" poder chamar de novo
  const buscar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    apiAdmin('/cidades/listar').then(d => setCidades(d.cidades)).catch(console.error)
    try {
      const dados = await apiAdmin('/inscritos/listar')
      setInscritos(dados.inscritos)
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { buscar() }, [buscar])

  // ─── DERIVAÇÕES ──────────────────────────────────────────────
  // O filtro de cidade considera onde a pessoa mora E os bairros que ela acompanha
  const inscritosFiltrados = inscritos.filter(i => {
    const termo = normalizar(busca.trim())
    const digitos = termo.replace(/\D/g, '')
    const bateBusca = !termo ||
      normalizar(i.nome).includes(termo) ||
      normalizar(i.email).includes(termo) ||
      (digitos !== '' && (i.telefone ?? '').includes(digitos))

    const bateCidade = !filtroCidade ||
      i.cidadeId === Number(filtroCidade) ||
      i.bairrosInteresse.some(b => b.cidadeId === Number(filtroCidade))

    const bateAtivo = !filtroAtivo || String(i.ativo) === filtroAtivo

    return bateBusca && bateCidade && bateAtivo
  })

  const totalAtivos = inscritos.filter(i => i.ativo).length

  // ─── TELA ────────────────────────────────────────────────────
  return (
    <div className="sv-app sv-pagina">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
      <SidebarGlass ativo="inscritos" />

      <main className="sv-main">

        <header className="sv-topo">
          <div className="sv-topo-texto">
            <p className="sv-trilha"><a href="/alertas">Alertas</a> &gt; <span>Inscritos</span></p>
            <h1 className="sv-titulo">Inscritos nos alertas</h1>
            <p className="sv-subtitulo">
              Moradores que se inscreveram pelo WhatsApp. {totalAtivos} ativo{totalAtivos !== 1 ? 's' : ''} de {inscritos.length}.
            </p>
          </div>
          <div className="sv-topo-acoes">
            <a className="sv-btn sv-btn--vidro" href="/alertas"><LuTriangleAlert /> Alertas</a>
          </div>
        </header>

        <div className="sv-vidro sv-painel">

          <div className="barra-filtros">
            <input
              placeholder="Buscar por nome, e-mail ou telefone..."
              aria-label="Buscar"
              maxLength={LIMITES.busca}
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />

            <select aria-label="Cidade" value={filtroCidade} onChange={e => setFiltroCidade(e.target.value)}>
              <option value="">Todas as cidades</option>
              {cidades.map(c => (
                <option key={c.id_cidade} value={c.id_cidade}>{c.nome}/{c.estado}</option>
              ))}
            </select>

            <select aria-label="Situação" value={filtroAtivo} onChange={e => setFiltroAtivo(e.target.value)}>
              <option value="">Ativos e inativos</option>
              <option value="true">Só ativos</option>
              <option value="false">Só inativos</option>
            </select>

            <span className="contador-resultados">
              {inscritosFiltrados.length} resultado{inscritosFiltrados.length !== 1 ? 's' : ''}
            </span>
          </div>

          {carregando ? (
            <Esqueleto forma="linhas" />
          ) : erro ? (
            <ErroPagina titulo="Não foi possível carregar os inscritos" mensagem={erro} onTentar={buscar} />
          ) : inscritosFiltrados.length === 0 ? (
            <Vazio
              icone={<LuUsers />}
              titulo={inscritos.length === 0 ? 'Nenhum inscrito ainda.' : 'Nenhum inscrito encontrado com esses filtros.'}
              dica="As inscrições são feitas pelo WhatsApp (opção 1 do menu do bot). Cada morador inscrito aparece aqui."
            />
          ) : (
            inscritosFiltrados.map(i => (
              <div className="sv-linha" key={i.id_inscrito}>
                <div className="sv-poco sv-poco--p">{i.nome.charAt(0).toUpperCase()}</div>

                <div className="sv-linha-info">
                  <p className="sv-linha-titulo">{i.nome}</p>
                  <p className="sv-linha-meta">
                    <span><LuMail /> {i.email}</span>
                    {i.telefone && !(i.whatsappId.endsWith('@lid') && i.telefone === i.whatsappId.split('@')[0]) && <span><LuPhone /> {formatarTelefone(i.telefone)}</span>}
                    <span><LuHouse /> {i.bairro} — {i.cidade}/{i.estado}</span>
                    {i.bairrosInteresse.length > 0 && (
                      <span><LuEye /> +{i.bairrosInteresse.length} bairro{i.bairrosInteresse.length !== 1 ? 's' : ''}</span>
                    )}
                  </p>
                </div>

                <span style={{ fontSize: '12px', color: 'var(--sv-tinta-2)', flexShrink: 0 }}>
                  {i.totalRelatos} relato{i.totalRelatos !== 1 ? 's' : ''}<br />
                  desde {new Date(i.createdAt).toLocaleDateString('pt-BR')}
                </span>

                <span className={`sv-tag sv-tag--lisa sv-status ${i.ativo ? 'inscrito-ativo' : 'inscrito-inativo'}`}>
                  {i.ativo ? 'Ativo' : 'Inativo'}
                </span>

                <button
                  onClick={() => navigate(`/inscritos/${i.id_inscrito}`)}
                  className="sv-btn sv-btn--vidro "
                  
                >
                  Ver / editar
                </button>
              </div>
            ))
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

export default ListarInscritos;
