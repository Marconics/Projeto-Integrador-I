// Responsáveis do abrigo no WhatsApp (tela de Detalhes do abrigo)
//
// O admin confere quem é o responsável e cria um convite dizendo COMO conferiu.
// O vínculo só aparece aqui depois que a própria pessoa aceita pelo WhatsApp
// (responde ACEITAR à mensagem do bot ou envia "vincular 123456").
// Rotas: /api/responsaveis (Backend/src/routes/responsaveis.js).
import { useState, useEffect, useCallback } from 'react';
import {
  LuCheck, LuCopy, LuHandHeart, LuLink, LuMessageCircle, LuPhone, LuSend, LuShieldCheck, LuUserCheck, LuUserPlus, LuUserX, LuX
} from 'react-icons/lu';
import { apiAdmin } from '../../../services/api';
import { LIMITES, EXEMPLOS, mascaraTelefone, somenteNome } from '../../../utils/campos';
import { Obrigatorio, Opcional, ContadorCaracteres } from '../../../components/MarcasCampo';
import './responsaveis.css';

// Como o admin conferiu (o mesmo texto da API, em lib/responsaveis.js).
// Para um celular NOVO, use um dos três primeiros; o último só serve quando o
// telefone do cadastro do abrigo já é um celular.
const METODOS = [
  { valor: 'ligacao_contato_oficial', label: 'Liguei para um contato oficial do local',
    ajuda: 'Ex: telefone fixo da escola, da igreja ou da secretaria — nunca o número que a própria pessoa informou.' },
  { valor: 'orgao_publico',           label: 'Confirmei com a prefeitura / Defesa Civil',
    ajuda: 'Para abrigos públicos, em que o órgão define quem é o responsável.' },
  { valor: 'presencial',              label: 'Entreguei o código pessoalmente no abrigo',
    ajuda: 'A forma mais segura: gere o link e mostre o código (ou o QR do link) no local.' },
  { valor: 'numero_do_cadastro',      label: 'É o celular que já está no cadastro do abrigo',
    ajuda: 'O convite vai para o celular cadastrado antes, não para um número que a pessoa passou agora.' },
]
const METODOS_COM_OBSERVACAO = ['ligacao_contato_oficial', 'orgao_publico']

const STATUS_CONVITE = {
  pendente:  { label: 'Aguardando resposta', classe: 'sv-tag--atencao' },
  recusado:  { label: 'Recusado',            classe: 'sv-tag--sirene' },
  cancelado: { label: 'Cancelado',           classe: 'sv-tag--neutro' },
  expirado:  { label: 'Expirado',            classe: 'sv-tag--neutro' },
}

const ehCelular = (texto) => {
  const d = String(texto ?? '').replace(/\D/g, '')
  return d.length === 11 && d[2] === '9'
}

const formatarData = (data) => new Date(data).toLocaleDateString('pt-BR')

const FORM_INICIAL = { nome: '', telefone: '', forma: 'mensagem', metodoConferencia: '', observacao: '' }

// aoCarregar({ responsaveis, voluntarios }): avisa a tela quantos contatos o abrigo tem no WhatsApp
function ResponsaveisWhatsapp({ abrigoId, telefoneAbrigo, nomeResponsavelAbrigo, aoCarregar }) {
  const [responsaveis, setResponsaveis] = useState([])
  const [convites,     setConvites]     = useState([])
  const [voluntarios,  setVoluntarios]  = useState([])   // voluntários do abrigo no WhatsApp
  const [erroCarga,    setErroCarga]    = useState(null)
  const [aviso,        setAviso]        = useState(null)   // { texto, erro }

  const [modalAberto, setModalAberto] = useState(false)
  const [form,        setForm]        = useState(FORM_INICIAL)
  const [erroForm,    setErroForm]    = useState(null)
  const [enviando,    setEnviando]    = useState(false)
  const [resultado,   setResultado]   = useState(null)   // convite por link: { codigo, link }
  const [copiado,     setCopiado]     = useState(false)

  const [desvincular, setDesvincular] = useState(null)   // { tipo: 'responsavel' | 'voluntario', ...pessoa } a confirmar
  const [ocupado,     setOcupado]     = useState(false)

  const celularCadastro = ehCelular(telefoneAbrigo) ? mascaraTelefone(telefoneAbrigo) : null

  const carregar = useCallback(async () => {
    setErroCarga(null)
    try {
      const dados = await apiAdmin(`/responsaveis/listar?abrigoId=${abrigoId}`)
      setResponsaveis(dados.responsaveis)
      setConvites(dados.convites)
      setVoluntarios(dados.voluntarios ?? [])
      aoCarregar?.({ responsaveis: dados.responsaveis.length, voluntarios: (dados.voluntarios ?? []).length })
    } catch (erro) {
      setErroCarga(erro.message)
    }
  }, [abrigoId, aoCarregar])

  useEffect(() => { carregar() }, [carregar])

  const mudar = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }))

  // "Número do cadastro": a mensagem vai obrigatoriamente para o celular cadastrado
  const escolherMetodo = (valor) => setForm(f => ({
    ...f,
    metodoConferencia: valor,
    ...(valor === 'numero_do_cadastro' ? { forma: 'mensagem', telefone: celularCadastro ?? '' } : {}),
    ...(valor === 'presencial' ? { forma: 'link' } : {}),
  }))

  function abrirConvite() {
    setForm({ ...FORM_INICIAL, nome: nomeResponsavelAbrigo ?? '' })
    setErroForm(null)
    setResultado(null)
    setCopiado(false)
    setModalAberto(true)
  }

  const fecharModal = () => { if (!enviando) setModalAberto(false) }

  async function enviarConvite(e) {
    e.preventDefault()
    setErroForm(null)

    if (!form.metodoConferencia) return setErroForm('Escolha como você conferiu que a pessoa é responsável pelo abrigo.')
    if (METODOS_COM_OBSERVACAO.includes(form.metodoConferencia) && !form.observacao.trim()) {
      return setErroForm('Anote com quem você confirmou (nome, cargo ou telefone do contato oficial).')
    }
    if (form.forma === 'mensagem' && !ehCelular(form.telefone)) {
      return setErroForm('Para enviar por mensagem, informe um celular com DDD, ex: (12) 99999-0000.')
    }

    setEnviando(true)
    try {
      const dados = await apiAdmin('/responsaveis/convidar', {
        metodo: 'POST',
        corpo: { abrigoId, ...form, telefone: form.telefone || null },
      })
      await carregar()
      if (dados.codigo) {
        setResultado({ codigo: dados.codigo, link: dados.link })
      } else {
        setModalAberto(false)
        setAviso({ texto: dados.mensagem })
      }
    } catch (erro) {
      setErroForm(erro.message)
    } finally {
      setEnviando(false)
    }
  }

  async function copiar(texto) {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
    } catch {
      setCopiado(false)
    }
  }

  async function cancelarConvite(id) {
    setOcupado(true)
    setAviso(null)
    try {
      const dados = await apiAdmin(`/responsaveis/convites/cancelar/${id}`, { metodo: 'PATCH' })
      setAviso({ texto: dados.mensagem })
      await carregar()
    } catch (erro) {
      setAviso({ texto: erro.message, erro: true })
    } finally {
      setOcupado(false)
    }
  }

  async function confirmarDesvincular() {
    setOcupado(true)
    try {
      const caminho = desvincular.tipo === 'voluntario'
        ? `/responsaveis/voluntarios/desativar/${desvincular.id_voluntario_whatsapp}`
        : `/responsaveis/desativar/${desvincular.id_responsavel}`
      const dados = await apiAdmin(caminho, { metodo: 'PATCH' })
      setAviso({ texto: dados.mensagem })
      setDesvincular(null)
      await carregar()
    } catch (erro) {
      setAviso({ texto: erro.message, erro: true })
      setDesvincular(null)
    } finally {
      setOcupado(false)
    }
  }

  const metodoEscolhido = METODOS.find(m => m.valor === form.metodoConferencia)
  const textoCodigo = resultado ? `vincular ${resultado.codigo}` : ''

  return (
    <>
      <section className="sv-vidro sv-painel sv-pilha" aria-labelledby="titulo-responsaveis">
        <div className="sv-secao-linha">
          <h2 id="titulo-responsaveis" className="sv-secao-titulo">
            <LuMessageCircle /> Responsáveis e voluntários no WhatsApp
          </h2>
          <button type="button" className="sv-btn sv-btn--primario sv-btn--p" onClick={abrirConvite}>
            <LuUserPlus /> Convidar responsável
          </button>
        </div>
        <p className="sv-apoio">
          Recebem pelo WhatsApp os avisos do abrigo (voluntários interessados nos pedidos de ajuda). Antes de convidar,
          confira quem é o responsável por um canal que você já conhece — o vínculo só vale depois que a pessoa aceita do próprio número.
        </p>

        {aviso && (
          <p className={`sv-aviso ${aviso.erro ? 'sv-aviso--erro' : 'sv-aviso--sucesso'}`} role={aviso.erro ? 'alert' : 'status'}>
            {aviso.texto}
          </p>
        )}
        {erroCarga && <p className="sv-aviso sv-aviso--erro" role="alert">Não foi possível carregar os responsáveis: {erroCarga}</p>}

        {/* ── Vinculados ── */}
        {responsaveis.length === 0 ? (
          <p className="sv-apoio sv-apoio--icone"><LuUserX /> Nenhum responsável recebe os avisos deste abrigo ainda.</p>
        ) : (
          <div className="sv-lista">
            {responsaveis.map(r => (
              <div key={r.id_responsavel} className="sv-linha">
                <span className="sv-poco sv-poco--p sv-poco--aceso sv-poco--azul"><LuUserCheck /></span>
                <div className="sv-linha-info">
                  <p className="sv-linha-titulo">{r.nome}</p>
                  <p className="sv-linha-meta">
                    {r.telefone && <span><LuPhone /> {r.telefone}</span>}
                    <span><LuShieldCheck /> {r.metodoTexto ?? 'Conferência não registrada'}</span>
                  </p>
                  <p className="sv-linha-meta">
                    <span>Desde {formatarData(r.createdAt)}{r.conferidoPor ? ` · conferido por ${r.conferidoPor}` : ''}</span>
                    {r.observacao && <span>{r.observacao}</span>}
                  </p>
                </div>
                <button type="button" className="sv-btn sv-btn--perigo-vidro sv-btn--p" onClick={() => setDesvincular({ ...r, tipo: 'responsavel' })}>
                  Desvincular
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Voluntários no WhatsApp (indicaram o local pelo bot e quiseram ajudar) ── */}
        {voluntarios.length > 0 && (
          <>
            <h3 className="rw-subtitulo">Voluntários no WhatsApp</h3>
            <p className="sv-apoio">Recebem pelo WhatsApp cada novo pedido de ajuda deste abrigo.</p>
            <div className="sv-lista">
              {voluntarios.map(v => (
                <div key={v.id_voluntario_whatsapp} className="sv-linha">
                  <span className="sv-poco sv-poco--p sv-poco--aceso sv-poco--ciano"><LuHandHeart /></span>
                  <div className="sv-linha-info">
                    <p className="sv-linha-titulo">{v.nome}</p>
                    <p className="sv-linha-meta">
                      {v.telefone && <span><LuPhone /> {v.telefone}</span>}
                      <span>{v.origem} · desde {formatarData(v.createdAt)}</span>
                    </p>
                  </div>
                  <button type="button" className="sv-btn sv-btn--perigo-vidro sv-btn--p" onClick={() => setDesvincular({ ...v, tipo: 'voluntario' })}>
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Convites ── */}
        {convites.length > 0 && (
          <>
            <h3 className="rw-subtitulo">Convites</h3>
            <div className="sv-lista">
              {convites.map(c => {
                const status = STATUS_CONVITE[c.status] ?? { label: c.status, classe: 'sv-tag--neutro' }
                return (
                  <div key={c.id_convite} className="sv-linha">
                    <span className="sv-poco sv-poco--p sv-poco--ciano">{c.forma === 'link' ? <LuLink /> : <LuSend />}</span>
                    <div className="sv-linha-info">
                      <p className="sv-linha-titulo">{c.nome ?? 'Sem nome'}{c.telefone ? ` · ${c.telefone}` : ''}</p>
                      <p className="sv-linha-meta">
                        <span>{c.forma === 'link' ? 'Por link/código' : 'Por mensagem do bot'}</span>
                        <span><LuShieldCheck /> {c.metodoTexto}</span>
                      </p>
                      <p className="sv-linha-meta">
                        <span>
                          {c.status === 'pendente' ? `Vale até ${formatarData(c.expiraEm)}` : `Criado em ${formatarData(c.createdAt)}`}
                          {c.criadoPor ? ` · ${c.criadoPor}` : ''}
                        </span>
                      </p>
                    </div>
                    <span className={`sv-tag sv-tag--lisa ${status.classe}`}>{status.label}</span>
                    {c.status === 'pendente' && (
                      <button type="button" className="sv-btn sv-btn--discreto sv-btn--p" disabled={ocupado} onClick={() => cancelarConvite(c.id_convite)}>
                        Cancelar convite
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

      </section>

      {/* Modais fora do painel: o sv-vidro usa backdrop-filter, que prende o
          position: fixed dentro dele (o fundo escuro cobriria só a seção) */}

      {/* ── Modal: convidar ── */}
      {modalAberto && (
        <div className="sv-modal-fundo" onClick={(e) => { if (e.target === e.currentTarget) fecharModal() }}>
          <div className="sv-modal" role="dialog" aria-modal="true" aria-labelledby="modal-convite-titulo"
            onKeyDown={(e) => { if (e.key === 'Escape') fecharModal() }}>

            {resultado ? (
              <>
                <h2 id="modal-convite-titulo" className="sv-modal-titulo">Convite criado</h2>
                <p className="sv-apoio">
                  Repasse para o responsável. Ele vale por 3 dias e só pode ser usado uma vez.
                  Este código não aparece de novo.
                </p>
                <div className="rw-codigo" aria-label={`Código ${resultado.codigo}`}>{resultado.codigo}</div>
                <p className="sv-apoio">
                  {resultado.link
                    ? 'Ao abrir o link, o WhatsApp já vem com a mensagem pronta — é só enviar.'
                    : <>A pessoa envia ao WhatsApp do S.O.S Vale a mensagem <strong>{textoCodigo}</strong>.</>}
                </p>
                {resultado.link && <p className="sv-apoio rw-link">{resultado.link}</p>}
                <div className="sv-acoes">
                  <button type="button" className="sv-btn sv-btn--vidro" onClick={() => copiar(resultado.link ?? textoCodigo)}>
                    {copiado ? <><LuCheck /> Copiado</> : <><LuCopy /> Copiar {resultado.link ? 'link' : 'mensagem'}</>}
                  </button>
                  <button type="button" className="sv-btn sv-btn--primario" autoFocus onClick={() => setModalAberto(false)}>Concluir</button>
                </div>
              </>
            ) : (
              <form onSubmit={enviarConvite} className="sv-form-coluna" noValidate>
                <h2 id="modal-convite-titulo" className="sv-modal-titulo">Convidar responsável</h2>

                <div className="sv-campo">
                  <label htmlFor="conv-nome">Nome do responsável<Obrigatorio /></label>
                  <input id="conv-nome" required maxLength={LIMITES.nomePessoa} placeholder="Ex: Maria Souza"
                    value={form.nome} onChange={e => mudar('nome', somenteNome(e.target.value))} autoFocus />
                </div>

                <div className="sv-campo">
                  <label htmlFor="conv-metodo">Como você conferiu que é o responsável?<Obrigatorio /></label>
                  <select id="conv-metodo" required value={form.metodoConferencia} onChange={e => escolherMetodo(e.target.value)}>
                    <option value="">Escolha uma opção</option>
                    {METODOS.map(m => (
                      <option key={m.valor} value={m.valor} disabled={m.valor === 'numero_do_cadastro' && !celularCadastro}>
                        {m.label}{m.valor === 'numero_do_cadastro' && !celularCadastro ? ' (indisponível: o cadastro não tem celular)' : ''}
                      </option>
                    ))}
                  </select>
                  {metodoEscolhido
                    ? <p className="sv-campo-ajuda">{metodoEscolhido.ajuda}</p>
                    : <p className="sv-campo-ajuda">
                        {celularCadastro
                          ? `O celular do cadastro é ${celularCadastro}. Para outro número, escolha como você conferiu a pessoa.`
                          : 'Este abrigo não tem celular no cadastro (o telefone dele é fixo ou está vazio). Para convidar um celular novo, escolha como você conferiu a pessoa e digite o celular mais abaixo.'}
                      </p>}
                </div>

                {form.metodoConferencia && form.metodoConferencia !== 'numero_do_cadastro' && (
                  <div className="sv-campo">
                    <label htmlFor="conv-obs">
                      Com quem confirmou{METODOS_COM_OBSERVACAO.includes(form.metodoConferencia) ? <Obrigatorio /> : <Opcional />}
                    </label>
                    <textarea id="conv-obs" maxLength={LIMITES.observacao} rows={2}
                      placeholder="Ex: Liguei para a secretaria da escola (12) 3600-0000, falei com a diretora Ana"
                      value={form.observacao} onChange={e => mudar('observacao', e.target.value)} />
                    <ContadorCaracteres valor={form.observacao} limite={LIMITES.observacao} />
                  </div>
                )}

                <fieldset className="rw-formas">
                  <legend>Como enviar o convite<Obrigatorio /></legend>
                  <div className="rw-formas-opcoes">
                    <label className="sv-opcao">
                      <input type="radio" name="conv-forma" value="mensagem" checked={form.forma === 'mensagem'}
                        disabled={form.metodoConferencia === 'presencial'} onChange={() => mudar('forma', 'mensagem')} />
                      <span className="sv-opcao-caixa"><LuSend className="sv-opcao-icone" /> Mensagem do bot para o celular</span>
                    </label>
                    <label className="sv-opcao">
                      <input type="radio" name="conv-forma" value="link" checked={form.forma === 'link'}
                        disabled={form.metodoConferencia === 'numero_do_cadastro'} onChange={() => mudar('forma', 'link')} />
                      <span className="sv-opcao-caixa"><LuLink className="sv-opcao-icone" /> Gerar link/código para eu repassar</span>
                    </label>
                  </div>
                </fieldset>

                <div className="sv-campo">
                  <label htmlFor="conv-telefone">
                    Celular (WhatsApp){form.forma === 'mensagem' ? <Obrigatorio /> : <Opcional />}
                  </label>
                  <input id="conv-telefone" inputMode="tel" maxLength={LIMITES.telefone} placeholder={EXEMPLOS.telefone}
                    required={form.forma === 'mensagem'} readOnly={form.metodoConferencia === 'numero_do_cadastro'}
                    value={form.telefone} onChange={e => mudar('telefone', mascaraTelefone(e.target.value))} />
                  <p className="sv-campo-ajuda">
                    {form.forma === 'mensagem'
                      ? 'O bot pergunta se a pessoa é responsável; ela responde ACEITAR do próprio WhatsApp.'
                      : 'Só para registro. Vale quem enviar o código primeiro, então entregue-o só ao responsável.'}
                  </p>
                </div>

                {erroForm && <p className="sv-aviso sv-aviso--erro" role="alert">{erroForm}</p>}

                <div className="sv-acoes">
                  <button type="button" className="sv-btn sv-btn--discreto" onClick={fecharModal} disabled={enviando}>Cancelar</button>
                  <button type="submit" className="sv-btn sv-btn--primario" disabled={enviando}>
                    {enviando ? 'Criando...' : form.forma === 'mensagem' ? <><LuSend /> Enviar convite</> : <><LuLink /> Gerar link</>}
                  </button>
                </div>
              </form>
            )}

            <button type="button" className="sv-btn sv-btn--quadrado sv-btn--discreto rw-fechar" aria-label="Fechar" onClick={fecharModal}>
              <LuX />
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: desvincular ── */}
      {desvincular && (
        <div className="sv-modal-fundo" onClick={(e) => { if (e.target === e.currentTarget && !ocupado) setDesvincular(null) }}>
          <div className="sv-modal" role="dialog" aria-modal="true" aria-labelledby="modal-desvincular-titulo"
            onKeyDown={(e) => { if (e.key === 'Escape' && !ocupado) setDesvincular(null) }}>
            <h2 id="modal-desvincular-titulo" className="sv-modal-titulo">
              {desvincular.tipo === 'voluntario' ? 'Remover' : 'Desvincular'} {desvincular.nome}?
            </h2>
            <p className="sv-apoio">
              A pessoa recebe uma mensagem avisando que não recebe mais {desvincular.tipo === 'voluntario' ? 'os pedidos de ajuda' : 'os avisos'} deste abrigo.
            </p>
            <div className="sv-acoes">
              <button type="button" className="sv-btn sv-btn--discreto" autoFocus disabled={ocupado} onClick={() => setDesvincular(null)}>Cancelar</button>
              <button type="button" className="sv-btn sv-btn--perigo" disabled={ocupado} onClick={confirmarDesvincular}>
                <LuUserX /> {ocupado ? 'Salvando...' : desvincular.tipo === 'voluntario' ? 'Remover' : 'Desvincular'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ResponsaveisWhatsapp
