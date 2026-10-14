// --------- Imports -----------
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LuClock, LuIdCard, LuMail, LuMessageCircle, LuPhone, LuPlus, LuX } from 'react-icons/lu';
import SidebarGlass from '../../../components/SidebarGlass/SidebarGlass';
import '../../../styles/sosvale-glass.css';
import SeletorLocalidade from '../../../components/SeletorLocalidade';
import { apiAdmin, formatarDataHora, formatarTempo, formatarTelefone } from '../../../services/api';
import { STATUS_ALERTA } from '../../alertas/constantes';
import '../../alertas/alertas.css';

function DetalhesInscrito() {

  const { id } = useParams();
  const navigate = useNavigate();

  // ─── ESTADOS ────────────────────────────────────────────────
  const [inscrito, setInscrito] = useState(null)   // dados como vieram da API
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  // Campos editáveis (o telefone NÃO é editável — vem do WhatsApp da pessoa)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [residencia, setResidencia] = useState({ cidadeId: null, bairroId: null })
  const [interesses, setInteresses] = useState([])

  // Bairro que está sendo escolhido para acompanhar
  const [novoInteresse, setNovoInteresse] = useState({ cidadeId: null, bairroId: null })

  // ─── BUSCA DOS DADOS ────────────────────────────────────────
  const preencher = (dados) => {
    setInscrito(dados)
    setNome(dados.nome)
    setEmail(dados.email)
    setAtivo(dados.ativo)
    setResidencia({ cidadeId: dados.cidadeId, bairroId: dados.bairroId })
    setInteresses(dados.bairrosInteresse)
  }

  const buscarInscrito = useCallback(async () => {
    try {
      preencher(await apiAdmin(`/inscritos/listar/${id}`))
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }, [id])

  useEffect(() => {
    buscarInscrito()
  }, [buscarInscrito])

  // ─── HANDLERS ───────────────────────────────────────────────
  const handleAdicionarInteresse = () => {
    const { bairroId, bairro, cidade, estado, cidadeId } = novoInteresse
    if (!bairroId) return

    if (bairroId === residencia.bairroId) {
      setErro('Este já é o bairro onde a pessoa mora.')
      return
    }
    if (interesses.some(b => b.id_bairro === bairroId)) {
      setErro('Este bairro já está na lista.')
      return
    }

    setErro('')
    setInteresses([...interesses, { id_bairro: bairroId, nome: bairro, cidade, estado, cidadeId }])
    setNovoInteresse({ cidadeId, bairroId: null })
  }

  const handleSalvar = async (e) => {
    e.preventDefault()
    if (!residencia.bairroId) {
      setErro('Selecione o bairro onde a pessoa mora.')
      return
    }

    setSalvando(true)
    setErro('')
    setMensagem('')

    try {
      const dados = await apiAdmin(`/inscritos/atualizar/${id}`, {
        metodo: 'PUT',
        corpo: {
          nome, email, ativo,
          bairroId: residencia.bairroId,
          bairrosInteresse: interesses.map(b => b.id_bairro),
        }
      })
      setMensagem(dados.mensagem)
      preencher({ ...inscrito, ...dados.inscrito })
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  const handleDescartar = () => {
    preencher(inscrito)
    setErro('')
    setMensagem('')
  }

  const handleExcluir = async () => {
    if (!confirm(`Excluir ${inscrito.nome}? A pessoa deixa de receber alertas. Os relatos já enviados continuam valendo, mas sem autor.`)) return

    try {
      await apiAdmin(`/inscritos/excluir/${id}`, { metodo: 'DELETE' })
      navigate('/inscritos')
    } catch (e) {
      setErro(e.message)
    }
  }

  // ─── TELA DE LOADING / ERRO ─────────────────────────────────
  if (carregando || !inscrito) {
    return (
      <div className="sv-app sv-pagina">
        <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
        <SidebarGlass ativo="inscritos" />
        <main className="sv-main">
          <p style={{ padding: '40px', color: erro ? 'var(--sv-sirene)' : 'var(--sv-tinta-2)' }}>
            {erro || 'Carregando inscrito...'}
          </p>
        </main>
      </div>
    )
  }

  // Contatos no formato "@lid" chegavam com o código interno do WhatsApp salvo no
  // lugar do telefone; o bot corrige ao ser reiniciado
  // (em "@c.us" o próprio ID é o telefone, então está certo)
  const telefoneIdentificado = Boolean(inscrito.telefone) &&
    !(inscrito.whatsappId.endsWith('@lid') && inscrito.telefone === inscrito.whatsappId.split('@')[0])

  // ─── TELA PRINCIPAL ─────────────────────────────────────────
  return (
    <div className="sv-app sv-pagina">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
      <SidebarGlass ativo="inscritos" />

      <main className="sv-main">
        <header className="sv-topo">
          <div className="sv-topo-texto">
            <p className="sv-trilha"><a href="/inscritos">Inscritos</a> &gt; <span>{inscrito.nome}</span></p>
            <h1 className="sv-titulo">{inscrito.nome}</h1>
            <p className="sv-subtitulo">Inscrito desde {formatarDataHora(inscrito.createdAt)}</p>
          </div>
          <span className={`sv-tag sv-tag--lisa sv-status ${inscrito.ativo ? 'inscrito-ativo' : 'inscrito-inativo'}`} style={{ fontSize: '14px', padding: '6px 16px' }}>
            {inscrito.ativo ? 'Recebendo alertas' : 'Inativo'}
          </span>
        </header>

        <form className="sv-vidro sv-painel sv-form-duas" onSubmit={handleSalvar}>

          {/* ── COLUNA ESQUERDA: dados e bairro ── */}
          <div className="sv-form-coluna">
            <h3 className="sv-secao-titulo">Dados pessoais</h3>

            <div className="sv-campo">
              <label><LuIdCard /> Nome</label>
              <input value={nome} onChange={e => setNome(e.target.value)} required minLength={2} />
            </div>

            <div className="sv-campo">
              <label><LuMail /> E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>

            {/* Telefone e WhatsApp só leitura: vêm do WhatsApp da pessoa e são o que
                identifica quem recebe os alertas — trocar por engano mandaria os avisos
                para outra pessoa */}
            <div className="sv-campo">
              <label><LuPhone /> Telefone</label>
              <p style={{ fontSize: '15px', color: 'var(--sv-tinta)', fontWeight: 600 }}>
                {telefoneIdentificado
                  ? formatarTelefone(inscrito.telefone)
                  : <span style={{ color: 'var(--sv-tinta-3)', fontWeight: 400 }}>
                      Ainda não identificado — o bot descobre o número quando for reiniciado
                    </span>}
              </p>
            </div>

            <div className="sv-campo">
              <label><LuMessageCircle /> Código do WhatsApp (usado para enviar os alertas)</label>
              <p style={{ fontSize: '13px', color: 'var(--sv-tinta-2)', fontFamily: 'monospace' }}>{inscrito.whatsappId}</p>
              <span style={{ fontSize: '12px', color: 'var(--sv-tinta-3)' }}>
                Telefone e WhatsApp não podem ser alterados. Se a pessoa trocou de número, ela deve se inscrever de novo pelo bot.
              </span>
            </div>

            <label className="sv-opcao">
              <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} />
              <div className="sv-opcao-caixa">
                <span>Recebendo alertas (inscrição ativa)</span>
              </div>
            </label>

            <h3 className="sv-secao-titulo">Onde mora</h3>
            <SeletorLocalidade
              cidadeId={residencia.cidadeId}
              bairroId={residencia.bairroId}
              bairroObrigatorio
              onChange={setResidencia}
            />
          </div>

          {/* ── COLUNA DIREITA: bairros acompanhados e relatos ── */}
          <div className="sv-form-coluna">
            <h3 className="sv-secao-titulo">Bairros acompanhados</h3>
            <p style={{ fontSize: '13px', color: 'var(--sv-tinta-2)', marginBottom: '10px' }}>
              Além do bairro onde mora, a pessoa recebe os alertas destes bairros.
            </p>

            {interesses.length === 0 ? (
              <p style={{ fontSize: '14px', color: 'var(--sv-tinta-3)', marginBottom: '12px' }}>Nenhum bairro extra.</p>
            ) : (
              <div className="chips" style={{ marginBottom: '16px' }}>
                {interesses.map(b => (
                  <span className="chip" key={b.id_bairro}>
                    {b.nome} ({b.cidade}/{b.estado})
                    <button
                      type="button"
                      title="Remover"
                      onClick={() => setInteresses(interesses.filter(i => i.id_bairro !== b.id_bairro))}
                     aria-label="Remover"><LuX /></button>
                  </span>
                ))}
              </div>
            )}

            {/* obrigatorio={false}: escolher um bairro para adicionar é opcional —
                sem isso o navegador bloqueava o "Salvar" ao editar só o nome */}
            <SeletorLocalidade
              cidadeId={novoInteresse.cidadeId}
              bairroId={novoInteresse.bairroId}
              bairroObrigatorio
              obrigatorio={false}
              onChange={setNovoInteresse}
            />
            <button
              type="button"
              className="sv-btn sv-btn--vidro"
              disabled={!novoInteresse.bairroId}
              onClick={handleAdicionarInteresse}
              style={{ marginBottom: '24px' }}
            >
              <LuPlus /> Adicionar bairro
            </button>

            <h3 className="sv-secao-titulo">Últimos relatos</h3>
            {inscrito.relatos.length === 0 ? (
              <p style={{ fontSize: '14px', color: 'var(--sv-tinta-3)' }}>Nenhum relato enviado.</p>
            ) : (
              inscrito.relatos.map(r => (
                <div className="relato-item" key={r.id_relato}>
                  <div className="sv-linha-info">
                    <p className="sv-linha-titulo" style={{ fontSize: '14px' }}>
                      <a href={`/alertas/${r.alertaId}`}>#{r.alertaId} · {r.tipoLabel}</a>
                    </p>
                    <p className="sv-linha-meta">
                      <span>{r.local}</span>
                      <span><LuClock /> {formatarTempo(r.createdAt)}</span>
                    </p>
                  </div>
                  <span className={`sv-tag sv-tag--lisa sv-status ${r.statusAlerta}`}>{STATUS_ALERTA[r.statusAlerta]}</span>
                </div>
              ))
            )}

            {mensagem && <p className="sv-aviso sv-aviso--sucesso" style={{ margin: '16px 0 0' }}>{mensagem}</p>}
            {erro && <p className="sv-aviso sv-aviso--erro" style={{ margin: '16px 0 0' }}>{erro}</p>}

            <div className="sv-form-acoes" style={{ marginTop: '24px' }}>
              <button type="submit" className="sv-btn sv-btn--primario sv-btn--bloco" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar alterações'}
              </button>
              <button type="button" className="sv-btn sv-btn--vidro sv-btn--bloco" onClick={handleDescartar}>
                Descartar alterações
              </button>
              <button type="button" className="sv-btn sv-btn--perigo-vidro sv-btn--bloco" onClick={handleExcluir}>
                Excluir inscrito
              </button>
            </div>
          </div>
        </form>

        <footer className="sv-rodape">
          <p>© 2026 S.O.S Vale. Todos os direitos reservados.</p>
          <p>Versão 1.0.0</p>
        </footer>
      </main>
    </div>
  )
}

export default DetalhesInscrito;
