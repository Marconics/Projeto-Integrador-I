// Detalhes da vítima (admin) — /detalhes-vitimas/:id
// Mostra o cadastro da pessoa, onde ela está agora e as deficiências; permite
// editar os dados e a foto, editar as deficiências (no próprio painel) e
// excluir o cadastro (com confirmação).
// O vínculo com o abrigo não muda aqui: é feito na tela "Vítimas do abrigo".
//--------- Imports-----------
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import {
  LuCalendar, LuHouse, LuIdCard, LuMapPin, LuPencil, LuPhone, LuTrash2, LuTriangleAlert, LuUpload, LuUserRound, LuUsers
} from 'react-icons/lu';

import SidebarGlass from '../../../components/SidebarGlass/SidebarGlass';
import '../../../styles/sosvale-glass.css';
import './style.css';
import { Esqueleto, ErroPagina } from '../../../components/EstadosPagina';
import { fetchAdmin, formatarDataDia, hojeISO } from '../../../services/api';
import { LIMITES, EXEMPLOS, somenteNome, mascaraCpf, mascaraTelefone, erroDosCampos } from '../../../utils/campos';
import { Obrigatorio, Opcional, AvisoObrigatorios } from '../../../components/MarcasCampo';
import SeletorDeficiencias from '../../../components/SeletorDeficiencias';

// Idade a partir de "AAAA-MM-DD" (sem fuso, para não errar o dia)
const idadeDe = (texto) => {
  const [ano, mes, dia] = String(texto ?? '').slice(0, 10).split('-').map(Number)
  if (!ano) return null
  const hoje = new Date()
  let idade = hoje.getFullYear() - ano
  if (hoje.getMonth() + 1 < mes || (hoje.getMonth() + 1 === mes && hoje.getDate() < dia)) idade--
  return idade
}
const diasDesde = (iso) => iso ? Math.max(0, Math.floor((Date.now() - new Date(iso)) / 86400000)) : null
const textoDias = (dias) => dias === null ? '' : dias === 0 ? 'hoje' : `há ${dias} dia${dias !== 1 ? 's' : ''}`
const iniciais = (nome) => String(nome ?? '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()

//------- Começo Função Principal -----
function DetalhesVitimas() {

  // ─── ESTADOS ────────────────────────────────────────────────
  const { id } = useParams();
  const navigate = useNavigate();

  const [dadosVitima, setDadosVitima] = useState({})
  const [carregando, setCarregando]   = useState(true);
  const [erroCarga, setErroCarga]     = useState(null); // falha ao buscar a vítima
  const [editando, setEditando]       = useState(false);
  const [salvando, setSalvando]       = useState(false);
  const [aviso, setAviso]             = useState(null); // { tipo: 'sucesso' | 'erro', texto }
  const [erroFoto, setErroFoto]       = useState('');

  // Exclusão: confirmação na janela do tema (em vez do confirm() do navegador)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [excluindo, setExcluindo]     = useState(false);
  const [erroExcluir, setErroExcluir] = useState('');

  const [nomeVitima, setNomeVitima]       = useState('');
  const [cpf, setCpf]                     = useState('');
  const [telefone, setTelefone]           = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [genero, setGenero]               = useState('');

  // Dados do abrigo vinculado — lidos mas não editáveis aqui
  const [abrigoVinculado, setAbrigoVinculado] = useState(null)  // { id, nome, cidade, endereco, ... }

  const [fotoUrl, setFotoUrl]   = useState(null);
  const [novaFoto, setNovaFoto] = useState(null);
  const fotoExibida = novaFoto ?? fotoUrl;

  // Edição das deficiências: independente do "Editar cadastro" (salva sozinha)
  const [tiposDeficiencia, setTiposDeficiencia] = useState(null); // [{ id, nome }] — carregados ao abrir a edição
  const [editandoDef, setEditandoDef]   = useState(false);
  const [carregandoTipos, setCarregandoTipos] = useState(false);
  const [marcadas, setMarcadas]         = useState([]);   // IDs marcados
  const [salvandoDef, setSalvandoDef]   = useState(false);
  const [avisoDef, setAvisoDef]         = useState(null); // { tipo: 'sucesso' | 'erro', texto }

  // ── Busca dos dados ao carregar ───────────────────────────────────────
  // Função própria para o botão "Tentar novamente" poder chamar de novo
  const buscarVitima = useCallback(async () => {
      setCarregando(true);
      setErroCarga(null);
      try {
        const resposta = await fetchAdmin(`/vitimas/listar/${id}`);
        if (!resposta.ok) {
          throw new Error(resposta.status === 404 ? 'Esta vítima não foi encontrada. O cadastro pode ter sido excluído.' : `Erro ${resposta.status}`)
        }
        const dados    = await resposta.json();

        setDadosVitima(dados)
        setNomeVitima(dados.nome);
        setCpf(dados.cpf ?? '');
        setTelefone(dados.telefone ?? '');
        // A API devolve AAAA-MM-DD, o formato que o <input type="date"> entende
        setDataNascimento(dados.dataNascimento ?? '');
        setGenero(dados.genero ?? '');
        setFotoUrl(dados.fotoVitima ? dados.fotoVitima + '?t=' + Date.now() : null)

        // O GET /vitimas/listar/:id já inclui o abrigo (nome, endereço, telefone e local)
        if (dados.abrigoId && dados.abrigo) {
          setAbrigoVinculado({
            id:          dados.abrigoId,
            nome:        dados.abrigo.nome,
            cidade:      dados.abrigo.cidade,
            estado:      dados.abrigo.estado ?? null,
            bairro:      dados.abrigo.bairro ?? null,
            endereco:    dados.abrigo.endereco ?? null,
            telefone:    dados.abrigo.telefone ?? null,
            dataEntrada: dados.dataEntrada ?? null,
          })
        } else {
          setAbrigoVinculado(null)
        }

      } catch (erro) {
        console.error("Erro ao buscar vitima:", erro);
        setErroCarga(erro.message?.startsWith('Esta vítima') ? erro.message : 'O servidor não respondeu. Verifique a conexão e tente novamente.');
      } finally {
        setCarregando(false);
      }
  }, [id]);

  useEffect(() => { buscarVitima() }, [buscarVitima]);

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleImagem = (e) => {
    const arquivo = e.target.files[0]
    // Cancelou a janela de seleção: não há arquivo
    if (!arquivo) return
    const limiteMB = 2
    if (arquivo.size > limiteMB * 1024 * 1024) {
      setErroFoto(`A imagem deve ter no máximo ${limiteMB}MB.`)
      return
    }
    setErroFoto('')
    const reader = new FileReader()
    reader.onloadend = () => { setNovaFoto(reader.result) }
    reader.readAsDataURL(arquivo)
  }

  const handleSalvar = async (e) => {
    e.preventDefault();
    setAviso(null);

    // Confere CPF e telefone só se foram alterados — cadastros antigos fora do
    // padrão continuam editáveis (a API faz a mesma coisa)
    const erroCampos = erroDosCampos({
      cpf:      cpf      !== (dadosVitima.cpf ?? '')      ? cpf      : null,
      telefone: telefone !== (dadosVitima.telefone ?? '') ? telefone : null,
    })
    if (erroCampos) {
      setAviso({ tipo: 'erro', texto: erroCampos })
      return
    }

    setSalvando(true);
    try {
      const resposta = await fetchAdmin(`/vitimas/atualizar/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nomeVitima.trim(),
          cpf,
          telefone,
          dataNascimento,
          genero,
          fotoVitima: novaFoto === false ? null : novaFoto ? novaFoto.split(',')[1] : fotoUrl,
          // Não envia abrigoId aqui — o vínculo de abrigo é gerenciado pela página VitimasDoAbrigo
        }),
      });

      const dadosResultado = await resposta.json()

      if (!resposta.ok) {
        setAviso({ tipo: 'erro', texto: dadosResultado.mensagem ?? 'Erro ao salvar.' })
        return
      }

      setDadosVitima({ ...dadosVitima, nome: nomeVitima, cpf, telefone, dataNascimento, genero, fotoVitima: dadosResultado.fotoVitima })
      setFotoUrl(dadosResultado.fotoVitima ? dadosResultado.fotoVitima + '?t=' + Date.now() : null);
      setNovaFoto(null);
      setEditando(false);
      setAviso({ tipo: 'sucesso', texto: 'Cadastro atualizado com sucesso.' })

    } catch (erro) {
      console.error("Erro ao salvar:", erro);
      setAviso({ tipo: 'erro', texto: 'Não foi possível salvar. Verifique a conexão e tente novamente.' })
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    setExcluindo(true);
    setErroExcluir('');
    try {
      const resposta = await fetchAdmin(`/vitimas/excluir/${id}`, { method: 'DELETE' });
      // Só volta para a lista se a API excluiu de verdade
      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => ({}))
        setErroExcluir(dados.mensagem ?? 'Não foi possível excluir a vítima.')
        return
      }
      navigate('/vitimas');
    } catch (erro) {
      console.error("Erro ao excluir:", erro);
      setErroExcluir('Não foi possível excluir. Verifique a conexão e tente novamente.')
    } finally {
      setExcluindo(false);
    }
  };

  // ── Deficiências ─────────────────────────────────────────────────────
  // Abre a edição: busca os tipos (só na primeira vez) e marca os que a pessoa já tem
  const handleEditarDeficiencias = async () => {
    setAvisoDef(null);
    let tipos = tiposDeficiencia;
    if (!tipos) {
      setCarregandoTipos(true);
      try {
        const resposta = await fetchAdmin('/vitimas/deficiencias');
        if (!resposta.ok) throw new Error(`Erro ${resposta.status}`);
        tipos = (await resposta.json()).deficiencias ?? [];
        setTiposDeficiencia(tipos);
      } catch (erro) {
        console.error('Erro ao buscar tipos de deficiência:', erro);
        setAvisoDef({ tipo: 'erro', texto: 'Não foi possível carregar as opções. Verifique a conexão e tente novamente.' });
        return;
      } finally {
        setCarregandoTipos(false);
      }
    }
    const atuais = dadosVitima.deficiencias ?? [];
    setMarcadas(tipos.filter(t => atuais.includes(t.nome)).map(t => t.id));
    setEditandoDef(true);
  }

  const alternarDeficiencia = (idTipo) => {
    setMarcadas(lista => lista.includes(idTipo) ? lista.filter(d => d !== idTipo) : [...lista, idTipo]);
  }

  const cancelarDeficiencias = () => { setEditandoDef(false); setAvisoDef(null) }

  const salvarDeficiencias = async () => {
    setSalvandoDef(true);
    setAvisoDef(null);
    try {
      // Só as deficiências: os demais campos não vão no corpo e a API mantém como estão
      const resposta = await fetchAdmin(`/vitimas/atualizar/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deficienciaIds: marcadas }),
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) {
        setAvisoDef({ tipo: 'erro', texto: dados.mensagem ?? 'Erro ao salvar as deficiências.' });
        return;
      }
      setDadosVitima(atual => ({ ...atual, deficiencias: dados.deficiencias ?? [] }));
      setEditandoDef(false);
      setAvisoDef({ tipo: 'sucesso', texto: 'Deficiências atualizadas.' });
    } catch (erro) {
      console.error('Erro ao salvar deficiências:', erro);
      setAvisoDef({ tipo: 'erro', texto: 'Não foi possível salvar. Verifique a conexão e tente novamente.' });
    } finally {
      setSalvandoDef(false);
    }
  }

  const fecharConfirmacao = () => { if (!excluindo) { setConfirmarExclusao(false); setErroExcluir('') } }

  const handleEditar = () => { setAviso(null); setEditando(true) }

  // Cancelar a edição volta tudo ao que está salvo (inclusive a foto)
  const handleCancelExcluir = () => {
    setEditando(false);
    setAviso(null);
    setErroFoto('');
    setNomeVitima(dadosVitima.nome);
    setCpf(dadosVitima.cpf ?? '');
    setTelefone(dadosVitima.telefone ?? '');
    setDataNascimento(dadosVitima.dataNascimento ?? '');
    setGenero(dadosVitima.genero ?? '');
    setNovaFoto(null);
    setFotoUrl(dadosVitima.fotoVitima ? dadosVitima.fotoVitima + '?t=' + Date.now() : null);
  }

  // ── Formata data para exibição (em UTC, para não mostrar 1 dia a menos) ──
  const formatarData = formatarDataDia

  // ── Carregando / erro ─────────────────────────────────────────────────
  if (carregando || erroCarga) {
    return (
      <div className="sv-app sv-pagina">
        <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
        <SidebarGlass ativo="vitimas" />
        <main className="sv-main">
          <header className="sv-topo">
            <div className="sv-topo-texto">
              <p className="sv-trilha"><a href="/pg_adm">Visão geral</a> &gt; <a href="/vitimas">Vítimas</a> &gt; <span>Detalhes</span></p>
              <h1 className="sv-titulo">Detalhes da vítima</h1>
            </div>
          </header>
          {carregando
            ? <Esqueleto forma="detalhe" />
            : <ErroPagina titulo="Não foi possível carregar a vítima" mensagem={erroCarga} onTentar={buscarVitima} />}
        </main>
      </div>
    );
  }

  const idade = idadeDe(dadosVitima.dataNascimento)
  const deficiencias = dadosVitima.deficiencias ?? []
  const diasNoAbrigo = diasDesde(abrigoVinculado?.dataEntrada)

  // ── Tela principal ────────────────────────────────────────────────────
  return (
    <div className="sv-app sv-pagina">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>

      <SidebarGlass ativo="vitimas" />

      <main className="sv-main">

        {/* ── Cabeçalho: o nome da pessoa é o título ── */}
        <header className="sv-topo">
          <div className="sv-topo-texto">
            <p className="sv-trilha">
              <a href="/pg_adm">Visão geral</a> &gt; <a href="/vitimas">Vítimas</a> &gt; <span>{dadosVitima.nome}</span>
            </p>
            <h1 className="sv-titulo">{dadosVitima.nome}</h1>
            <p className="dv-meta">
              {[idade !== null ? `${idade} ano${idade !== 1 ? 's' : ''}` : null, dadosVitima.genero].filter(Boolean).join(' · ')}
              {abrigoVinculado
                ? <span className="sv-tag sv-tag--ok">No abrigo</span>
                : <span className="sv-tag sv-tag--atencao">Sem abrigo</span>}
              {editando && <span className="sv-tag sv-tag--azul">Editando</span>}
            </p>
          </div>
          {!editando && (
            <div className="sv-topo-acoes">
              <button type="button" className="sv-btn sv-btn--vidro sv-anima" onClick={handleEditar}>
                <span data-anim="giro"><LuPencil /></span> Editar cadastro
              </button>
            </div>
          )}
        </header>

        {aviso && (
          <p className={`sv-aviso ${aviso.tipo === 'erro' ? 'sv-aviso--erro' : 'sv-aviso--sucesso'}`} role={aviso.tipo === 'erro' ? 'alert' : 'status'}>
            {aviso.texto}
          </p>
        )}

        <div className="dv-grade">

          {/* ── Cadastro (leitura ou edição) ── */}
          <section className="sv-vidro sv-painel" aria-labelledby="titulo-cadastro">
            <h2 id="titulo-cadastro" className="sv-secao-titulo"><LuUserRound /> Cadastro</h2>

            {!editando ? (
              <div className="dv-pessoa">
                <span className="dv-foto">
                  {fotoExibida ? <img src={fotoExibida} alt={`Foto de ${dadosVitima.nome}`} /> : <span aria-hidden="true">{iniciais(dadosVitima.nome)}</span>}
                </span>
                <div className="sv-pares">
                  <p className="sv-par"><span>CPF</span><strong>{cpf || '—'}</strong></p>
                  <p className="sv-par"><span>Telefone</span><strong>{telefone || '—'}</strong></p>
                  <p className="sv-par"><span>Nascimento</span><strong>{formatarData(dataNascimento)}{idade !== null ? ` (${idade} anos)` : ''}</strong></p>
                  <p className="sv-par"><span>Gênero</span><strong>{genero || '—'}</strong></p>
                  {dadosVitima.createdAt && (
                    <p className="sv-par"><span>Cadastrada em</span><strong>{new Date(dadosVitima.createdAt).toLocaleDateString('pt-BR')}</strong></p>
                  )}
                  {!fotoExibida && <p className="sv-apoio">Sem foto cadastrada</p>}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSalvar} className="dv-form">
                <AvisoObrigatorios />
                <div className="dv-form-campos">
                  <div className="sv-campo sv-campo--largo">
                    <label htmlFor="nome-vitima"><LuUserRound /> Nome da vítima<Obrigatorio /></label>
                    <input id="nome-vitima" value={nomeVitima} maxLength={LIMITES.nomePessoa} minLength={2} required
                      onChange={(e) => setNomeVitima(somenteNome(e.target.value))} />
                  </div>

                  <div className="sv-campo">
                    <label htmlFor="cpf-vitima"><LuIdCard /> CPF<Obrigatorio /></label>
                    <input id="cpf-vitima" value={cpf} maxLength={LIMITES.cpf} inputMode="numeric" placeholder={EXEMPLOS.cpf} required
                      onChange={(e) => setCpf(mascaraCpf(e.target.value))} />
                  </div>

                  <div className="sv-campo">
                    <label htmlFor="telefone-vitima"><LuPhone /> Telefone<Opcional /></label>
                    <input id="telefone-vitima" type="tel" value={telefone} maxLength={LIMITES.telefone} inputMode="numeric" placeholder={EXEMPLOS.telefone}
                      onChange={(e) => setTelefone(mascaraTelefone(e.target.value))} />
                  </div>

                  <div className="sv-campo">
                    <label htmlFor="nascimento-vitima"><LuCalendar /> Data de nascimento<Obrigatorio /></label>
                    <input id="nascimento-vitima" type="date" value={dataNascimento} min="1900-01-01" max={hojeISO()} required onChange={(e) => setDataNascimento(e.target.value)} />
                  </div>

                  <div className="sv-campo">
                    <label htmlFor="genero-vitima"><LuUserRound /> Gênero<Obrigatorio /></label>
                    <select id="genero-vitima" required value={genero} onChange={(e) => setGenero(e.target.value)} className="sv-entrada">
                      <option value="Masculino">Masculino</option>
                      <option value="Feminino">Feminino</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>

                  <div className="sv-campo sv-campo--largo">
                    <span className="sv-rotulo"><LuUpload /> Foto<Opcional /></span>
                    <div className="sv-upload">
                      {fotoExibida ? (
                        <div className="sv-upload-previa">
                          <img src={fotoExibida} alt={`Prévia da foto de ${nomeVitima}`} />
                          <button type="button" onClick={() => { setNovaFoto(false); setFotoUrl(null); }} className="sv-btn sv-btn--perigo-vidro sv-btn--p">
                            Remover foto
                          </button>
                        </div>
                      ) : (
                        <label className="sv-upload-area" htmlFor="foto-vitima">
                          <input id="foto-vitima" type="file" accept="image/jpeg,image/png" onChange={handleImagem} style={{ display: 'none' }} />
                          <LuUpload className="sv-upload-icone" />
                          <p>Envie a foto da vítima (JPG ou PNG, até 2 MB)</p>
                          <span className="sv-btn sv-btn--vidro sv-btn--p">Selecionar arquivo do computador</span>
                        </label>
                      )}
                    </div>
                    {erroFoto && <p className="sv-campo-erro dv-erro-foto" role="alert">{erroFoto}</p>}
                  </div>
                </div>

                {/* Cancelar discreto, ação principal em azul */}
                <div className="sv-form-rodape">
                  <button type="button" onClick={handleCancelExcluir} className="sv-btn sv-btn--discreto">Cancelar</button>
                  <button type="submit" className="sv-btn sv-btn--primario" disabled={salvando}>
                    {salvando ? 'Salvando...' : 'Salvar alterações'}
                  </button>
                </div>
              </form>
            )}
          </section>

          <div className="dv-coluna">
            {/* ── Onde está ── */}
            <section className="sv-vidro sv-painel" aria-labelledby="titulo-onde">
              <h2 id="titulo-onde" className="sv-secao-titulo"><LuHouse /> Onde está</h2>
              {abrigoVinculado ? (
                <div className="dv-onde">
                  <strong>{abrigoVinculado.nome}</strong>
                  {abrigoVinculado.endereco && <p><LuMapPin aria-hidden="true" /> {abrigoVinculado.endereco}</p>}
                  <p>{[abrigoVinculado.bairro, abrigoVinculado.cidade && `${abrigoVinculado.cidade}${abrigoVinculado.estado ? '/' + abrigoVinculado.estado : ''}`].filter(Boolean).join(', ')}</p>
                  {abrigoVinculado.telefone && <p><LuPhone aria-hidden="true" /> {abrigoVinculado.telefone}</p>}
                  {abrigoVinculado.dataEntrada && (
                    <p className="dv-entrada"><LuCalendar aria-hidden="true" /> Entrada em {formatarData(abrigoVinculado.dataEntrada)} · {textoDias(diasNoAbrigo)}</p>
                  )}
                  <div className="dv-acoes">
                    <button type="button" className="sv-btn sv-btn--vidro" onClick={() => navigate(`/detalhes-abrigos/${abrigoVinculado.id}`)}>
                      <LuHouse /> Ver abrigo
                    </button>
                    <button type="button" className="sv-btn sv-btn--vidro" onClick={() => navigate(`/abrigos/${abrigoVinculado.id}/vitimas`)}>
                      <LuUsers /> Vítimas do abrigo
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="sv-aviso sv-aviso--atencao">
                    <LuTriangleAlert /> Sem abrigo vinculado. Para vincular, abra o abrigo e use “Vincular vítima”.
                  </p>
                  <div className="dv-acoes">
                    <button type="button" className="sv-btn sv-btn--vidro" onClick={() => navigate('/abrigos')}>
                      <LuHouse /> Ver abrigos
                    </button>
                  </div>
                </>
              )}
            </section>

            {/* ── Deficiências ── */}
            <section className="sv-vidro sv-painel" aria-labelledby="titulo-deficiencias">
              <div className="sv-secao-linha dv-secao-topo">
                <h2 id="titulo-deficiencias" className="sv-secao-titulo">Deficiências</h2>
                {!editandoDef && (
                  <button type="button" className="sv-btn sv-btn--vidro sv-btn--p" onClick={handleEditarDeficiencias} disabled={carregandoTipos}>
                    <LuPencil /> {carregandoTipos ? 'Carregando...' : 'Editar'}
                  </button>
                )}
              </div>

              {avisoDef && (
                <p className={`sv-aviso ${avisoDef.tipo === 'erro' ? 'sv-aviso--erro' : 'sv-aviso--sucesso'} dv-aviso-def`} role={avisoDef.tipo === 'erro' ? 'alert' : 'status'}>
                  {avisoDef.texto}
                </p>
              )}

              {editandoDef ? (
                <>
                  {tiposDeficiencia.length > 0 ? (
                    <>
                      <p className="sv-apoio dv-dica-def">Marque todas que se aplicam. Para nenhuma, desmarque tudo e salve.</p>
                      <SeletorDeficiencias tipos={tiposDeficiencia} marcadas={marcadas} aoAlternar={alternarDeficiencia}
                        desabilitado={salvandoDef} rotuloId="titulo-deficiencias" />
                    </>
                  ) : (
                    <p className="sv-aviso sv-aviso--atencao">
                      <LuTriangleAlert /> Nenhum tipo de deficiência cadastrado no sistema.
                    </p>
                  )}
                  <div className="sv-form-rodape">
                    <button type="button" className="sv-btn sv-btn--discreto" onClick={cancelarDeficiencias} disabled={salvandoDef}>Cancelar</button>
                    {tiposDeficiencia.length > 0 && (
                      <button type="button" className="sv-btn sv-btn--primario" onClick={salvarDeficiencias} disabled={salvandoDef}>
                        {salvandoDef ? 'Salvando...' : `Salvar (${marcadas.length})`}
                      </button>
                    )}
                  </div>
                </>
              ) : deficiencias.length > 0 ? (
                <div className="sv-etiquetas">
                  {deficiencias.map(d => <span key={d} className="sv-tag sv-tag--lisa sv-tag--anil sv-tag--g">{d}</span>)}
                </div>
              ) : (
                <p className="sv-apoio">Nenhuma deficiência informada.</p>
              )}
            </section>
          </div>
        </div>

        {/* ── Excluir: discreto e longe de "Salvar" ── */}
        <section className="dv-excluir" aria-label="Excluir cadastro">
          <p>
            <strong>Excluir cadastro</strong>
            Apaga esta pessoa do sistema{abrigoVinculado ? ' e libera a vaga no abrigo' : ''}. Não dá para desfazer.
          </p>
          <button type="button" className="sv-btn sv-btn--perigo-vidro" onClick={() => setConfirmarExclusao(true)}>
            <LuTrash2 /> Excluir cadastro
          </button>
        </section>

        <footer className="sv-rodape">
          <p>© 2026 S.O.S Vale. Todos os direitos reservados.</p>
          <p>Versão 1.0.0</p>
        </footer>
      </main>

      {/* ── Confirmação da exclusão ── */}
      {confirmarExclusao && (
        <div className="sv-modal-fundo" onClick={(e) => { if (e.target === e.currentTarget) fecharConfirmacao() }}>
          <div className="sv-modal" role="dialog" aria-modal="true" aria-labelledby="modal-excluir-titulo"
            onKeyDown={(e) => { if (e.key === 'Escape') fecharConfirmacao() }}>
            <h2 id="modal-excluir-titulo" className="sv-modal-titulo">Excluir o cadastro de {dadosVitima.nome}?</h2>
            <p className="sv-apoio">
              {abrigoVinculado ? `A vaga em ${abrigoVinculado.nome} será liberada. ` : ''}Esta ação não pode ser desfeita.
            </p>
            {erroExcluir && <p className="sv-aviso sv-aviso--erro" role="alert" style={{ marginTop: '12px' }}>{erroExcluir}</p>}
            <div className="sv-acoes">
              <button type="button" className="sv-btn sv-btn--discreto" autoFocus onClick={fecharConfirmacao} disabled={excluindo}>Cancelar</button>
              <button type="button" className="sv-btn sv-btn--perigo" onClick={handleExcluir} disabled={excluindo}>
                <LuTrash2 /> {excluindo ? 'Excluindo...' : 'Excluir cadastro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DetalhesVitimas;
