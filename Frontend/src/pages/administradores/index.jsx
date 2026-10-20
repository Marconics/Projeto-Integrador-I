// --------- Imports -----------
import { useState, useEffect } from 'react';
import { LuUserCog, LuUserPlus } from 'react-icons/lu';
import SidebarGlass from '../../components/SidebarGlass/SidebarGlass';
import '../../styles/sosvale-glass.css';
import { apiAdmin, formatarDataHora } from '../../services/api';
import { LIMITES, EXEMPLOS, somenteNome } from '../../utils/campos';
import { Obrigatorio, Opcional, AvisoObrigatorios } from '../../components/MarcasCampo';

// Tela "Administradores": um admin logado cadastra outros admins.
// (O cadastro de admin pela API só é aberto enquanto não existe nenhum — ver auth.js)
const formularioVazio = { nome: '', email: '', senha: '', cargo: '' }

function Administradores() {

  // ─── ESTADOS ────────────────────────────────────────────────
  const [admins, setAdmins] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const [formulario, setFormulario] = useState(formularioVazio)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState(null) // { tipo: 'sucesso' | 'erro', texto }

  // ─── BUSCA DA API ────────────────────────────────────────────
  const carregar = () =>
    apiAdmin('/auth/listar')
      .then(dados => setAdmins(dados.admins))
      .catch(e => setErro(e.message))
      .finally(() => setCarregando(false))

  useEffect(() => { carregar() }, [])

  // ─── HANDLERS ────────────────────────────────────────────────
  // O nome não aceita números (mesmo padrão dos outros cadastros de pessoa)
  const alterarCampo = (e) => {
    const { name, value } = e.target
    setFormulario({ ...formulario, [name]: name === 'nome' ? somenteNome(value) : value })
  }

  const cadastrar = async (e) => {
    e.preventDefault()
    setMensagem(null)
    setSalvando(true)
    try {
      const dados = await apiAdmin('/auth/cadastrar', { metodo: 'POST', corpo: formulario })
      setMensagem({ tipo: 'sucesso', texto: `${dados.mensagem} ${dados.nome} já pode entrar com o e-mail ${dados.email}.` })
      setFormulario(formularioVazio)
      carregar()
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err.message })
    } finally {
      setSalvando(false)
    }
  }

  // ─── TELA ────────────────────────────────────────────────────
  return (
    <div className="sv-app sv-pagina">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>

      <SidebarGlass ativo="administradores" />

      <main className="sv-main">

        <header className="sv-topo">
          <div className="sv-topo-texto">
            <p className="sv-trilha"><a href="/pg_adm">Visão geral</a> &gt; <span>Administradores</span></p>
            <h1 className="sv-titulo">Administradores</h1>
            <p className="sv-subtitulo">
              Cadastre as pessoas que podem acessar o painel. Todos os administradores têm as mesmas permissões.
            </p>
          </div>
        </header>

        <div className="sv-pilha">

          {/* ── NOVO ADMINISTRADOR ── */}
          <div className="sv-vidro sv-painel">
            <h3 className="sv-secao-titulo"><LuUserPlus /> Novo administrador</h3>

            <form className="sv-form" onSubmit={cadastrar}>
              <AvisoObrigatorios />

              <div className="sv-form-grade">
                <div className="sv-campo">
                  <label htmlFor="adm-nome">Nome<Obrigatorio /></label>
                  <input id="adm-nome" name="nome" value={formulario.nome} onChange={alterarCampo}
                    maxLength={LIMITES.nomePessoa} minLength={2} required />
                </div>
                <div className="sv-campo">
                  <label htmlFor="adm-email">E-mail<Obrigatorio /></label>
                  <input id="adm-email" name="email" type="email" value={formulario.email} onChange={alterarCampo}
                    placeholder={EXEMPLOS.email} maxLength={LIMITES.email} required />
                </div>
                <div className="sv-campo">
                  <label htmlFor="adm-senha">Senha<Obrigatorio /></label>
                  <input id="adm-senha" name="senha" type="password" value={formulario.senha} onChange={alterarCampo}
                    placeholder={`${LIMITES.senhaMin} a ${LIMITES.senhaMax} caracteres`}
                    minLength={LIMITES.senhaMin} maxLength={LIMITES.senhaMax} required autoComplete="new-password" />
                </div>
                <div className="sv-campo">
                  <label htmlFor="adm-cargo">Cargo<Opcional /></label>
                  <input id="adm-cargo" name="cargo" placeholder="Ex: Defesa Civil" value={formulario.cargo} onChange={alterarCampo}
                    maxLength={LIMITES.cargo} />
                </div>
              </div>

              {mensagem && (
                <p className={`sv-aviso ${mensagem.tipo === 'erro' ? 'sv-aviso--erro' : 'sv-aviso--sucesso'}`} role="alert">
                  {mensagem.texto}
                </p>
              )}

              <div className="sv-acoes sv-acoes--inicio">
                <button type="submit" className="sv-btn sv-btn--primario" disabled={salvando}>
                  <LuUserPlus /> {salvando ? 'Salvando...' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>

          {/* ── LISTA ── */}
          <div className="sv-vidro sv-painel">
            <h3 className="sv-secao-titulo"><LuUserCog /> Administradores cadastrados</h3>

            {erro && <p className="sv-aviso sv-aviso--erro" style={{ marginBottom: '12px' }}>{erro}</p>}

            {carregando ? (
              <p className="sv-apoio">Carregando administradores...</p>
            ) : (
              <div className="sv-tabela-caixa">
                <table className="sv-tabela">
                  <thead>
                    <tr><th>Nome</th><th>E-mail</th><th>Cargo</th><th>Cadastrado em</th></tr>
                  </thead>
                  <tbody>
                    {admins.map(a => (
                      <tr key={a.id}>
                        <td>{a.nome}</td>
                        <td>{a.email}</td>
                        <td>{a.cargo}</td>
                        <td>{formatarDataHora(a.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        <footer className="sv-rodape">
          <p>© 2026 S.O.S Vale. Todos os direitos reservados.</p>
          <p>Versão 1.0.0</p>
        </footer>

      </main>
    </div>
  )
}

export default Administradores;
