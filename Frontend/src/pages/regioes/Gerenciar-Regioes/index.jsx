// --------- Imports -----------
import { useState, useEffect, useCallback } from 'react';
import { LuCircleCheck, LuMapPinned, LuMessageCircle, LuPencil, LuPlus, LuSave, LuSearch, LuTrash2, LuTriangleAlert, LuX } from 'react-icons/lu';
import SidebarGlass from '../../../components/SidebarGlass/SidebarGlass';
import '../../../styles/sosvale-glass.css';
import { apiAdmin } from '../../../services/api';
import { NIVEIS_RISCO } from '../../alertas/constantes';
import '../../alertas/alertas.css';

const bairroVazio = { nome: '', nivelRisco: 'baixo', populacaoEstimada: '', areaKm2: '' }

function GerenciarRegioes() {

  // ─── ESTADOS ────────────────────────────────────────────────
  const [estados, setEstados] = useState([])
  const [cidades, setCidades] = useState([])
  const [cidadeSelecionadaId, setCidadeSelecionadaId] = useState(null)
  const [bairros, setBairros] = useState([])

  const [filtroEstado, setFiltroEstado] = useState('')
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  // Formulário de nova cidade
  const [novaCidade, setNovaCidade] = useState({ nome: '', estadoId: '' })

  // Edição da cidade selecionada
  const [nomeCidade, setNomeCidade] = useState('')
  const [grupoCidade, setGrupoCidade] = useState('')
  const [linkGrupoCidade, setLinkGrupoCidade] = useState('')

  // Formulário de novo bairro + busca por CEP
  const [novoBairro, setNovoBairro] = useState(bairroVazio)
  const [cep, setCep] = useState('')
  const [resultadoCep, setResultadoCep] = useState(null)

  // Edição de um bairro na tabela
  const [editandoBairroId, setEditandoBairroId] = useState(null)
  const [bairroEditado, setBairroEditado] = useState(bairroVazio)

  const cidadeSelecionada = cidades.find(c => c.id_cidade === cidadeSelecionadaId) ?? null

  // Mostra a mensagem da API (sucesso ou erro)
  const avisar = (texto, ehErro = false) => {
    setErro(ehErro ? texto : '')
    setMensagem(ehErro ? '' : texto)
  }

  // ─── BUSCA DOS DADOS ────────────────────────────────────────
  const buscarCidades = useCallback(async () => {
    const dados = await apiAdmin('/cidades/listar')
    setCidades(dados.cidades)
    return dados.cidades
  }, [])

  const buscarBairros = useCallback(async (cidadeId) => {
    const dados = await apiAdmin(`/bairros/listar?cidadeId=${cidadeId}`)
    setBairros(dados.bairros)
  }, [])

  useEffect(() => {
    apiAdmin('/estados/listar').then(d => setEstados(d.estados)).catch(e => avisar(e.message, true))
    buscarCidades()
      .then(lista => { if (lista.length > 0) selecionarCidade(lista[0]) })
      .catch(e => avisar(e.message, true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscarCidades])

  const selecionarCidade = (cidade) => {
    setCidadeSelecionadaId(cidade.id_cidade)
    setNomeCidade(cidade.nome)
    setGrupoCidade(cidade.grupoWhatsappId ?? '')
    setLinkGrupoCidade(cidade.grupoWhatsappLink ?? '')
    setEditandoBairroId(null)
    setNovoBairro(bairroVazio)
    setResultadoCep(null)
    setBairros([])
    buscarBairros(cidade.id_cidade).catch(e => avisar(e.message, true))
  }

  // ─── CIDADES ────────────────────────────────────────────────
  const handleCadastrarCidade = async (e) => {
    e.preventDefault()
    try {
      const dados = await apiAdmin('/cidades/cadastrar', { metodo: 'POST', corpo: novaCidade })
      avisar(dados.mensagem)
      setNovaCidade({ nome: '', estadoId: novaCidade.estadoId })
      await buscarCidades()
      selecionarCidade(dados.cidade)
    } catch (e) {
      avisar(e.message, true)
    }
  }

  const handleSalvarCidade = async () => {
    try {
      const dados = await apiAdmin(`/cidades/atualizar/${cidadeSelecionadaId}`, {
        metodo: 'PUT',
        corpo: {
          nome: nomeCidade,
          grupoWhatsappId: grupoCidade.trim() || null,
          grupoWhatsappLink: linkGrupoCidade.trim() || null,
        }
      })
      avisar(dados.mensagem)
      // O link volta normalizado pela API (ex: sem espaços, com https://)
      setLinkGrupoCidade(dados.cidade.grupoWhatsappLink ?? '')
      await buscarCidades()
    } catch (e) {
      avisar(e.message, true)
    }
  }

  const handleExcluirCidade = async () => {
    if (!confirm(`Excluir a cidade ${cidadeSelecionada.nome}?`)) return
    try {
      const dados = await apiAdmin(`/cidades/excluir/${cidadeSelecionadaId}`, { metodo: 'DELETE' })
      avisar(dados.mensagem)
      const lista = await buscarCidades()
      setCidadeSelecionadaId(null)
      if (lista.length > 0) selecionarCidade(lista[0])
    } catch (e) {
      avisar(e.message, true)
    }
  }

  // ─── BAIRROS ────────────────────────────────────────────────
  // Consulta o CEP e preenche o nome do bairro
  const handleBuscarCep = async () => {
    setResultadoCep(null)
    try {
      const dados = await apiAdmin(`/bairros/cep/${cep.replace(/\D/g, '')}`)
      setResultadoCep(dados)

      if (dados.cidadeId !== cidadeSelecionadaId) {
        avisar(`Este CEP é de ${dados.cidade}/${dados.uf}, não de ${cidadeSelecionada.nome}.`, true)
      } else if (dados.bairroId) {
        avisar(`O bairro ${dados.bairro} já está cadastrado.`, true)
      } else if (!dados.bairro) {
        avisar('Este CEP não informa o bairro.', true)
      } else {
        setNovoBairro({ ...novoBairro, nome: dados.bairro })
        avisar(`Bairro encontrado: ${dados.bairro}. Confira os dados e clique em Adicionar.`)
      }
    } catch (e) {
      avisar(e.message, true)
    }
  }

  const handleCadastrarBairro = async (e) => {
    e.preventDefault()
    try {
      const dados = await apiAdmin('/bairros/cadastrar', {
        metodo: 'POST',
        corpo: { ...novoBairro, cidadeId: cidadeSelecionadaId }
      })
      avisar(dados.mensagem)
      setNovoBairro(bairroVazio)
      setCep('')
      setResultadoCep(null)
      await Promise.all([buscarBairros(cidadeSelecionadaId), buscarCidades()])
    } catch (e) {
      avisar(e.message, true)
    }
  }

  const iniciarEdicaoBairro = (bairro) => {
    setEditandoBairroId(bairro.id_bairro)
    setBairroEditado({
      nome: bairro.nome,
      nivelRisco: bairro.nivelRisco,
      populacaoEstimada: bairro.populacaoEstimada ?? '',
      areaKm2: bairro.areaKm2 ?? '',
    })
  }

  const handleSalvarBairro = async () => {
    try {
      const dados = await apiAdmin(`/bairros/atualizar/${editandoBairroId}`, { metodo: 'PUT', corpo: bairroEditado })
      avisar(dados.mensagem)
      setEditandoBairroId(null)
      await buscarBairros(cidadeSelecionadaId)
    } catch (e) {
      avisar(e.message, true)
    }
  }

  const handleExcluirBairro = async (bairro) => {
    if (!confirm(`Excluir o bairro ${bairro.nome}?`)) return
    try {
      const dados = await apiAdmin(`/bairros/excluir/${bairro.id_bairro}`, { metodo: 'DELETE' })
      avisar(dados.mensagem)
      await Promise.all([buscarBairros(cidadeSelecionadaId), buscarCidades()])
    } catch (e) {
      avisar(e.message, true)
    }
  }

  // ─── DERIVAÇÕES ──────────────────────────────────────────────
  const cidadesFiltradas = filtroEstado
    ? cidades.filter(c => c.estadoId === Number(filtroEstado))
    : cidades

  const estadosComCidades = estados.filter(e => cidades.some(c => c.estadoId === e.id_estado))

  // ─── TELA ────────────────────────────────────────────────────
  return (
    <div className="sv-app sv-pagina">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
      <SidebarGlass ativo="regioes" />

      <main className="sv-main">
        <header className="sv-topo">
          <div className="sv-topo-texto">
            <p className="sv-trilha"><a href="/pg_adm">Home</a> &gt; <span>Regiões</span></p>
            <h1 className="sv-titulo">Regiões</h1>
            <p className="sv-subtitulo">Cidades, bairros, nível de risco e o grupo de WhatsApp que recebe os alertas de cada cidade</p>
          </div>
          <div className="sv-topo-acoes">
            <a className="sv-btn sv-btn--vidro" href="/alertas"><LuTriangleAlert /> Alertas</a>
            <a className="sv-btn sv-btn--vidro" href="/mapa"><LuMapPinned /> Mapa</a>
          </div>
        </header>

        {mensagem && <p className="sv-aviso sv-aviso--sucesso">{mensagem}</p>}
        {erro && <p className="sv-aviso sv-aviso--erro">{erro}</p>}

        <section className="regioes-grade">

          {/* ── CIDADES ── */}
          <div className="sv-vidro sv-painel">
            <h3 className="sv-secao-titulo">Cidades</h3>

            <div className="barra-filtros">
              <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ width: '100%' }}>
                <option value="">Todos os estados</option>
                {estadosComCidades.map(e => (
                  <option key={e.id_estado} value={e.id_estado}>{e.nome}</option>
                ))}
              </select>
            </div>

            {cidadesFiltradas.length === 0 && (
              <p style={{ fontSize: '14px', color: 'var(--sv-tinta-3)', marginBottom: '16px' }}>Nenhuma cidade cadastrada.</p>
            )}

            {cidadesFiltradas.map(c => (
              <button
                key={c.id_cidade}
                className={`cidade-item ${c.id_cidade === cidadeSelecionadaId ? 'selecionada' : ''}`}
                onClick={() => selecionarCidade(c)}
              >
                <span>
                  {c.nome}/{c.estado}<br />
                  <small>{c.totalBairros} bairro{c.totalBairros !== 1 ? 's' : ''} · {c.totalAbrigos} abrigo{c.totalAbrigos !== 1 ? 's' : ''}</small>
                </span>
                {c.grupoWhatsappId && <LuMessageCircle title="Grupo de alertas vinculado" style={{ color: 'var(--sv-ok)' }} />}
              </button>
            ))}

            <h3 className="sv-secao-titulo">Nova cidade</h3>
            <form onSubmit={handleCadastrarCidade} className="painel-decisao">
              <select
                className="sv-entrada"
                value={novaCidade.estadoId}
                onChange={e => setNovaCidade({ ...novaCidade, estadoId: e.target.value })}
                required
              >
                <option value="" disabled>Estado</option>
                {estados.map(e => <option key={e.id_estado} value={e.id_estado}>{e.nome} ({e.sigla})</option>)}
              </select>
              <input
                className="sv-entrada"
                placeholder="Nome da cidade"
                value={novaCidade.nome}
                onChange={e => setNovaCidade({ ...novaCidade, nome: e.target.value })}
                required
              />
              <button type="submit" className="sv-btn sv-btn--primario"><LuPlus /> Cadastrar cidade</button>
            </form>
          </div>

          {/* ── CIDADE SELECIONADA: dados, grupo e bairros ── */}
          <div className="sv-vidro sv-painel">
            {!cidadeSelecionada ? (
              <p style={{ color: 'var(--sv-tinta-3)' }}>Cadastre ou selecione uma cidade.</p>
            ) : (
              <>
                <h3 className="sv-secao-titulo">{cidadeSelecionada.nome}/{cidadeSelecionada.estado}</h3>

                <div className="formulario-linha formulario-linha--cidade">
                  <label>
                    Nome
                    <input value={nomeCidade} onChange={e => setNomeCidade(e.target.value)} />
                  </label>
                  <label>
                    <span><LuMessageCircle /> Grupo de alertas (ID do grupo)</span>
                    <input
                      value={grupoCidade}
                      onChange={e => setGrupoCidade(e.target.value)}
                      placeholder="Ex: 120363012345678901@g.us"
                    />
                  </label>
                  <button type="button" className="sv-btn sv-btn--primario" onClick={handleSalvarCidade}><LuSave /> Salvar</button>
                  <button type="button" className="sv-btn sv-btn--perigo-vidro sv-btn--quadrado" title="Excluir cidade" onClick={handleExcluirCidade}><LuTrash2 /></button>
                </div>

                {/* Link de convite: o bot envia para quem quiser entrar no grupo (menu Alertas) */}
                <div className="formulario-linha formulario-linha--uma">
                  <label>
                    <span><LuMessageCircle /> Link de convite do grupo (enviado pelo bot a quem quiser entrar)</span>
                    <input
                      value={linkGrupoCidade}
                      onChange={e => setLinkGrupoCidade(e.target.value)}
                      placeholder="Ex: https://chat.whatsapp.com/AbCdEf123456"
                    />
                  </label>
                </div>

                <p className="sv-aviso">
                  {cidadeSelecionada.grupoWhatsappId
                    ? <><LuCircleCheck /> Os alertas confirmados desta cidade também são publicados no grupo vinculado.</>
                    : <>Para vincular um grupo: adicione o número do bot ao grupo e, como administrador do grupo, envie
                      <strong> !alertas vincular {cidadeSelecionada.nome}</strong>. Ou envie <strong>!alertas id</strong> e cole o ID aqui.</>}
                </p>

                <h3 className="sv-secao-titulo">Bairros ({bairros.length})</h3>

                {/* Busca por CEP para preencher o nome do bairro */}
                <div className="barra-filtros">
                  <input
                    placeholder="Preencher pelo CEP (ex: 12070-610)"
                    value={cep}
                    onChange={e => setCep(e.target.value)}
                    style={{ maxWidth: '260px' }}
                  />
                  <button type="button" className="sv-btn sv-btn--vidro" onClick={handleBuscarCep} disabled={cep.replace(/\D/g, '').length !== 8}>
                    <LuSearch /> Buscar CEP
                  </button>
                  {resultadoCep && (
                    <span style={{ fontSize: '13px', color: 'var(--sv-tinta-2)' }}>
                      {resultadoCep.logradouro ? `${resultadoCep.logradouro}, ` : ''}{resultadoCep.bairro ?? 'sem bairro'} — {resultadoCep.cidade}/{resultadoCep.uf}
                    </span>
                  )}
                </div>

                <form className="formulario-linha" onSubmit={handleCadastrarBairro}>
                  <label>
                    Novo bairro
                    <input value={novoBairro.nome} onChange={e => setNovoBairro({ ...novoBairro, nome: e.target.value })} placeholder="Nome do bairro" required />
                  </label>
                  <label>
                    Risco
                    <select value={novoBairro.nivelRisco} onChange={e => setNovoBairro({ ...novoBairro, nivelRisco: e.target.value })}>
                      {NIVEIS_RISCO.map(n => <option key={n.valor} value={n.valor}>{n.label}</option>)}
                    </select>
                  </label>
                  <label>
                    População
                    <input type="number" min="0" value={novoBairro.populacaoEstimada} onChange={e => setNovoBairro({ ...novoBairro, populacaoEstimada: e.target.value })} placeholder="Opcional" />
                  </label>
                  <label>
                    Área (km²)
                    <input type="number" min="0" step="0.01" value={novoBairro.areaKm2} onChange={e => setNovoBairro({ ...novoBairro, areaKm2: e.target.value })} placeholder="Opcional" />
                  </label>
                  <button type="submit" className="sv-btn sv-btn--primario"><LuPlus /> Adicionar</button>
                </form>

                <div style={{ overflowX: 'auto' }}>
                  <div className="sv-tabela-caixa">
                  <table className="sv-tabela">
                    <thead>
                      <tr>
                        <th>Bairro</th>
                        <th>Risco</th>
                        <th>População</th>
                        <th>Área</th>
                        <th title="Moradores inscritos + pessoas que acompanham">Inscritos</th>
                        <th>Abrigos</th>
                        <th>Alertas abertos</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {bairros.length === 0 && (
                        <tr><td colSpan={8} style={{ color: 'var(--sv-tinta-3)' }}>Nenhum bairro cadastrado nesta cidade.</td></tr>
                      )}
                      {bairros.map(b => editandoBairroId === b.id_bairro ? (
                        <tr key={b.id_bairro}>
                          <td><input value={bairroEditado.nome} onChange={e => setBairroEditado({ ...bairroEditado, nome: e.target.value })} /></td>
                          <td>
                            <select value={bairroEditado.nivelRisco} onChange={e => setBairroEditado({ ...bairroEditado, nivelRisco: e.target.value })}>
                              {NIVEIS_RISCO.map(n => <option key={n.valor} value={n.valor}>{n.label}</option>)}
                            </select>
                          </td>
                          <td><input type="number" min="0" value={bairroEditado.populacaoEstimada} onChange={e => setBairroEditado({ ...bairroEditado, populacaoEstimada: e.target.value })} /></td>
                          <td><input type="number" min="0" step="0.01" value={bairroEditado.areaKm2} onChange={e => setBairroEditado({ ...bairroEditado, areaKm2: e.target.value })} /></td>
                          <td>{b.totalMoradores + b.totalInteressados}</td>
                          <td>{b.totalAbrigos}</td>
                          <td>{b.alertasAbertos}</td>
                          <td>
                            <div className="sv-tabela-acoes">
                              <button type="button" className="sv-btn sv-btn--vidro sv-btn--quadrado" title="Salvar" onClick={handleSalvarBairro}><LuSave /></button>
                              <button type="button" className="sv-btn sv-btn--vidro sv-btn--quadrado" title="Cancelar" onClick={() => setEditandoBairroId(null)}><LuX /></button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={b.id_bairro}>
                          <td>{b.nome}</td>
                          <td><span className={`sv-tag sv-tag--lisa sv-status ${b.nivelRisco}`}>{NIVEIS_RISCO.find(n => n.valor === b.nivelRisco)?.label}</span></td>
                          <td>{b.populacaoEstimada != null ? Number(b.populacaoEstimada).toLocaleString('pt-BR') : '—'}</td>
                          <td>{b.areaKm2 != null ? `${Number(b.areaKm2).toLocaleString('pt-BR')} km²` : '—'}</td>
                          <td>{b.totalMoradores + b.totalInteressados}</td>
                          <td>{b.totalAbrigos}</td>
                          <td>
                            {b.alertasAbertos > 0
                              ? <a href="/alertas" className="sv-tag sv-tag--lisa sv-status ativo">{b.alertasAbertos}</a>
                              : 0}
                          </td>
                          <td>
                            <div className="sv-tabela-acoes">
                              <button type="button" className="sv-btn sv-btn--vidro sv-btn--quadrado" title="Editar" onClick={() => iniciarEdicaoBairro(b)}><LuPencil /></button>
                              <button type="button" className="sv-btn sv-btn--perigo-vidro sv-btn--quadrado" title="Excluir" onClick={() => handleExcluirBairro(b)}><LuTrash2 /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        <footer className="sv-rodape">
          <p>© 2026 S.O.S Vale. Todos os direitos reservados.</p>
          <p>Versão 1.0.0</p>
        </footer>
      </main>
    </div>
  )
}

export default GerenciarRegioes;
