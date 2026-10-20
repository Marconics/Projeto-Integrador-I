//--------- Imports-----------
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import { LuBuilding2, LuCalendar, LuHouse, LuIdCard, LuPhone, LuUpload, LuUserRound } from 'react-icons/lu';

import SidebarGlass from '../../../components/SidebarGlass/SidebarGlass';
import '../../../styles/sosvale-glass.css';
import { Esqueleto, ErroPagina } from '../../../components/EstadosPagina';
import { fetchAdmin, formatarDataDia, hojeISO } from '../../../services/api';
import { LIMITES, EXEMPLOS, somenteNome, mascaraCpf, mascaraTelefone, erroDosCampos } from '../../../utils/campos';
import { Obrigatorio, Opcional } from '../../../components/MarcasCampo';

//------- Começo Função Principal -----
function DetalhesVitimas() {

  // ─── ESTADOS ────────────────────────────────────────────────
  const { id } = useParams();
  const navigate = useNavigate();

  const [dadosVitima, setDadosVitima] = useState({})
  const [carregando, setCarregando]   = useState(true);
  const [erroCarga, setErroCarga]     = useState(null); // falha ao buscar a vítima
  const [editando, setEditando]       = useState(false);

  const [nomeVitima, setNomeVitima]       = useState('');
  const [cpf, setCpf]                     = useState('');
  const [telefone, setTelefone]           = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [genero, setGenero]               = useState('');

  // Dados do abrigo vinculado — lidos mas não editáveis aqui
  const [abrigoVinculado, setAbrigoVinculado] = useState(null)  // { id, nome, cidade, dataEntrada }

  const [fotoUrl, setFotoUrl]   = useState(null);
  const [novaFoto, setNovaFoto] = useState(null);
  const fotoExibida = novaFoto ?? fotoUrl;

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

        // Monta o objeto de abrigo vinculado se existir
        // O GET /vitimas/listar/:id já inclui o campo "abrigo" com nome e cidade
        if (dados.abrigoId && dados.abrigo) {
          setAbrigoVinculado({
            id:          dados.abrigoId,
            nome:        dados.abrigo.nome,
            cidade:      dados.abrigo.cidade,
            endereco:    dados.abrigo.endereco ?? null,
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
      alert(`A imagem deve ter no máximo ${limiteMB}MB.`)
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => { setNovaFoto(reader.result) }
    reader.readAsDataURL(arquivo)
  }

  const handleSalvar = async (e) => {
    e.preventDefault();

    // Confere CPF e telefone só se foram alterados — cadastros antigos fora do
    // padrão continuam editáveis (a API faz a mesma coisa)
    const erroCampos = erroDosCampos({
      cpf:      cpf      !== (dadosVitima.cpf ?? '')      ? cpf      : null,
      telefone: telefone !== (dadosVitima.telefone ?? '') ? telefone : null,
    })
    if (erroCampos) {
      alert(erroCampos)
      return
    }

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
        alert(dadosResultado.mensagem ?? 'Erro ao salvar.')
        return
      }

      setDadosVitima({ ...dadosVitima, nome: nomeVitima, cpf, telefone, dataNascimento, genero })
      setFotoUrl(dadosResultado.fotoVitima ? dadosResultado.fotoVitima + '?t=' + Date.now() : null);
      alert('Vítima atualizada com sucesso!');
      setNovaFoto(null);
      setEditando(false);

    } catch (erro) {
      console.error("Erro ao salvar:", erro);
    }
  };

  const handleExcluir = async () => {
    if (!confirm('Tem certeza que deseja excluir esta vítima?')) return;
    try {
      const resposta = await fetchAdmin(`/vitimas/excluir/${id}`, { method: 'DELETE' });
      // Só volta para a lista se a API excluiu de verdade
      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => ({}))
        alert(dados.mensagem ?? 'Não foi possível excluir a vítima.')
        return
      }
      navigate('/vitimas');
    } catch (erro) {
      console.error("Erro ao excluir:", erro);
    }
  };

  const handleEditar = () => setEditando(true)

  const handleCancelExcluir = () => {
    setEditando(false);
    setNomeVitima(dadosVitima.nome);
    setCpf(dadosVitima.cpf);
    setTelefone(dadosVitima.telefone);
    setDataNascimento(dadosVitima.dataNascimento);
    setGenero(dadosVitima.genero);
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
              <p className="sv-trilha"><a href="/vitimas">Vítimas</a> &gt; <span>Detalhes</span></p>
              <h1 className="sv-titulo">Detalhes da Vítima</h1>
            </div>
          </header>
          {carregando
            ? <Esqueleto forma="detalhe" />
            : <ErroPagina titulo="Não foi possível carregar a vítima" mensagem={erroCarga} onTentar={buscarVitima} />}
        </main>
      </div>
    );
  }

  // ── Tela principal ────────────────────────────────────────────────────
  return (
    <div className="sv-app sv-pagina">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>

      <SidebarGlass ativo="vitimas" />

      <main className="sv-main">

        <header className="sv-topo">
          <div className="sv-topo-texto">
            <p className="sv-trilha">
              <a href="/vitimas">Vítimas</a> &gt; <span>{nomeVitima}</span>
            </p>
            <h1 className="sv-titulo">
              {editando ? 'Editar Vítima' : 'Detalhes da Vítima'}
            </h1>
            <p className="sv-subtitulo">Gerencia as informações desta vítima</p>
          </div>
        </header>

        {/* ── Card de situação no abrigo ──────────────────────────────────
            Sempre visível, acima do formulário.
            Verde se vinculada, cinza se sem abrigo.
        ─────────────────────────────────────────────────────────────────── */}
        {abrigoVinculado ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--sv-ok-suave)', border: '1px solid rgba(27, 138, 90, .3)',
            borderRadius: 'var(--sv-raio-m)', padding: '16px 20px', marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* Ícone */}
              <div style={{
                width: '42px', height: '42px', borderRadius: 'var(--sv-raio-s)',
                background: 'var(--sv-ok)', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <LuBuilding2 style={{ color: '#fff', fontSize: '18px' }} />
              </div>

              {/* Info */}
              <div>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: 'var(--sv-ok)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Abrigo atual
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '16px', fontWeight: '700', color: 'var(--sv-tinta)' }}>
                  {abrigoVinculado.nome}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--sv-tinta-2)' }}>
                  {abrigoVinculado.cidade}
                  {abrigoVinculado.dataEntrada && (
                    <> · <LuCalendar style={{ fontSize: '11px', marginRight: '3px', verticalAlign: 'middle' }} />
                    Entrada em {formatarData(abrigoVinculado.dataEntrada)}</>
                  )}
                </p>
              </div>
            </div>

            {/* Botão para ir ao abrigo */}
            <button
              onClick={() => navigate(`/detalhes-abrigos/${abrigoVinculado.id}`)}
              className="sv-btn sv-btn--vidro"
            >
              <LuHouse />
              Ver abrigo
            </button>
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            background: 'var(--sv-fundo-suave)', border: '1px solid var(--sv-linha)',
            borderRadius: 'var(--sv-raio-m)', padding: '16px 20px', marginBottom: '20px'
          }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: 'var(--sv-raio-s)',
              background: 'var(--sv-linha)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <LuBuilding2 style={{ color: 'var(--sv-tinta-3)', fontSize: '18px' }} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: 'var(--sv-tinta-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Sem abrigo vinculado
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '14px', color: 'var(--sv-tinta-2)' }}>
                Esta vítima não está alocada em nenhum abrigo no momento.
              </p>
            </div>
          </div>
        )}
        {/* ─────────────────────────────────────────────────────────────── */}

        {/* ── Formulário ─────────────────────────────────────────────────── */}
        <form onSubmit={handleSalvar} className="sv-vidro sv-painel sv-form-duas">

          {/* Coluna esquerda */}
          <div className="sv-form-coluna">

            <div className="sv-campo">
              <label htmlFor="nome-vitima"><LuBuilding2 /> Nome da Vítima{editando && <Obrigatorio />}</label>
              {editando ? (
                <input id="nome-vitima" value={nomeVitima} maxLength={LIMITES.nomePessoa} minLength={2} required
                  onChange={(e) => setNomeVitima(somenteNome(e.target.value))} />
              ) : (
                <p>{nomeVitima}</p>
              )}
            </div>

            <div className="sv-campo">
              <label htmlFor="cpf-vitima"><LuIdCard /> CPF{editando && <Obrigatorio />}</label>
              {editando ? (
                <input id="cpf-vitima" value={cpf} maxLength={LIMITES.cpf} inputMode="numeric" placeholder={EXEMPLOS.cpf} required
                  onChange={(e) => setCpf(mascaraCpf(e.target.value))} />
              ) : (
                <p>{cpf || '—'}</p>
              )}
            </div>

            <div className="sv-campo">
              <label htmlFor="telefone-vitima"><LuPhone /> Telefone{editando && <Opcional />}</label>
              {editando ? (
                <input id="telefone-vitima" type="tel" value={telefone} maxLength={LIMITES.telefone} inputMode="numeric" placeholder={EXEMPLOS.telefone}
                  onChange={(e) => setTelefone(mascaraTelefone(e.target.value))} />
              ) : (
                <p>{telefone || '—'}</p>
              )}
            </div>

            <div className="sv-campo">
              <label htmlFor="nascimento-vitima"><LuCalendar /> Data de Nascimento{editando && <Obrigatorio />}</label>
              {editando ? (
                <input id="nascimento-vitima" type="date" value={dataNascimento} min="1900-01-01" max={hojeISO()} required onChange={(e) => setDataNascimento(e.target.value)} />
              ) : (
                <p>{formatarData(dataNascimento)}</p>
              )}
            </div>

            <div className="sv-campo">
              <label htmlFor="genero-vitima"><LuUserRound /> Gênero{editando && <Obrigatorio />}</label>
              {editando ? (
                <select id="genero-vitima" required value={genero} onChange={(e) => setGenero(e.target.value)} className="sv-entrada">
                  <option value="Masculino">Masculino</option>
                  <option value="Feminino">Feminino</option>
                  <option value="Outro">Outro</option>
                </select>
              ) : (
                <p>{genero || '—'}</p>
              )}
            </div>
          </div>

          {/* Coluna direita */}
          <div className="sv-form-coluna">

            <h3 className="sv-secao-titulo">
              Imagem da Vítima
            </h3>

            <>
              {editando ? (
                <div className="sv-upload">
                  {fotoExibida ? (
                    <div className="sv-upload-previa">
                      <img src={fotoExibida} alt="Preview da vítima" />
                      <button type="button" onClick={() => { setNovaFoto(false); setFotoUrl(null); }} className="sv-btn sv-btn--perigo-vidro sv-btn--p">
                        Remover Foto
                      </button>
                    </div>
                  ) : (
                    <label className="sv-upload-area">
                      <input type="file" accept="image/jpeg,image/png" onChange={handleImagem} style={{ display: 'none' }} />
                      <LuUpload className="sv-upload-icone" />
                      <p>Faça upload da foto da vítima (JPG ou PNG, até 2 MB)</p>
                      <span className="sv-btn sv-btn--vidro sv-btn--p">Selecionar arquivo do computador</span>
                    </label>
                  )}
                </div>
              ) : (
                <div className="sv-upload">
                  <div className="sv-upload-previa">
                    {fotoExibida ? (
                      <img src={fotoExibida} alt={nomeVitima} />
                    ) : (
                      <p style={{ color: 'var(--sv-tinta-3)', fontSize: '14px' }}>Sem foto cadastrada</p>
                    )}
                  </div>
                </div>
              )}
            </>

            <div className="sv-form-acoes">
              {editando ? (
                <>
                  <button type="submit" className="sv-btn sv-btn--primario sv-btn--bloco">Salvar Alterações</button>
                  <div className="sv-form-acoes-par">
                    <button type="button" onClick={handleExcluir} className="sv-btn sv-btn--perigo-vidro sv-btn--bloco">
                      Excluir Registro
                    </button>
                    <button type="button" onClick={handleCancelExcluir} className="sv-btn sv-btn--discreto sv-btn--bloco">
                      Cancelar edição
                    </button>
                  </div>
                </>
              ) : null}
              {!editando && (
                <button type="button" onClick={handleEditar} className="sv-btn sv-btn--vidro sv-btn--bloco">
                  Editar Vítima
                </button>
              )}
            </div>

          </div>
        </form>
        {/* ─────────────────────────────────────────────────────────────── */}

        <footer className="sv-rodape">
          <p>© 2026 S.O.S Vale. Todos os direitos reservados.</p>
          <p>Versão 1.0.0</p>
        </footer>
      </main>
    </div>
  )
}

export default DetalhesVitimas;