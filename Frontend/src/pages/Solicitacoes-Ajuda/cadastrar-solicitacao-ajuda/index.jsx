// ─── Imports ──────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LuSend } from 'react-icons/lu';
import SidebarGlass from '../../../components/SidebarGlass/SidebarGlass';
import '../../../styles/sosvale-glass.css';
import { fetchAdmin } from '../../../services/api';
import { LIMITES } from '../../../utils/campos';
import { Obrigatorio, AvisoObrigatorios, ContadorCaracteres } from '../../../components/MarcasCampo';

// ─── Sidebar reutilizável ─────────────────────────────────────────────────────
const Sidebar = () => (
  <SidebarGlass ativo="solicitacoes-ajuda" />
)

// ─── Componente principal ─────────────────────────────────────────────────────
function CadastrarSolicitacaoAjuda() {

  const { id } = useParams()   // id do abrigo vindo da URL
  const navigate = useNavigate()

  // ─── Campos do formulário ────────────────────────────────────────────────────
  const [titulo, setTitulo]       = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState('doacao')
  const [urgencia, setUrgencia]   = useState('media')

  // ─── Controle de envio ───────────────────────────────────────────────────────
  const [enviando, setEnviando]   = useState(false)
  const [erro, setErro]           = useState(null)

  // ─── Submit ──────────────────────────────────────────────────────────────────
  const handleSalvar = async (e) => {
    e.preventDefault()
    setErro(null)

    // Validação básica
    if (!titulo.trim()) { setErro('O título é obrigatório.'); return }
    if (!descricao.trim()) { setErro('A descrição é obrigatória.'); return }

    setEnviando(true)
    try {
      // Quem criou (criadoPorId) não vai mais daqui: a API pega o admin logado
      // pelo token (antes era "criadoPorId: 1" fixo)
      const body = {
        titulo:      titulo.trim(),
        descricao:   descricao.trim(),
        categoria,
        urgencia,
        abrigoId:    Number(id),
      }

      const resposta = await fetchAdmin('/solicitacoes-ajuda/cadastrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!resposta.ok) {
        const dados = await resposta.json()
        throw new Error(dados.mensagem ?? 'Erro ao criar solicitação.')
      }

      // Volta para a lista do abrigo após criar
      navigate(`/abrigos/${id}/solicitacoes-ajuda`)

    } catch (err) {
      console.error('Erro ao cadastrar solicitação:', err)
      setErro(err.message)
    } finally {
      setEnviando(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="sv-app sv-pagina">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
      <Sidebar />

      <main className="sv-main">

        {/* Header */}
        <header className="sv-topo">
          <div className="sv-topo-texto">
            <p className="sv-trilha">
              <a href="/abrigos">Abrigos</a> &gt;{' '}
              <button type="button" className="sv-link" onClick={() => navigate(`/detalhes-abrigos/${id}`)}>
                Detalhes do Abrigo
              </button>
              {' '}&gt; Nova Solicitação de Ajuda
            </p>
            <h1 className="sv-titulo">
              Nova Solicitação de Ajuda
            </h1>
            <p className="sv-subtitulo">Crie um pedido de ajuda vinculado a este abrigo</p>
          </div>
        </header>

        {/* Formulário */}
        <form onSubmit={handleSalvar} className="sv-form-estreito">
          <div className="sv-vidro sv-painel sv-form">

            <AvisoObrigatorios />

            {/* Título */}
            <div className="sv-campo">
              <label htmlFor="ajuda-titulo">Título da solicitação<Obrigatorio /></label>
              <input
                id="ajuda-titulo"
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="Ex: Precisamos de cobertores para 50 pessoas"
                maxLength={LIMITES.titulo}
                required
              />
              <ContadorCaracteres valor={titulo} limite={LIMITES.titulo} />
            </div>

            {/* Descrição */}
            <div className="sv-campo">
              <label htmlFor="ajuda-descricao">Descrição detalhada<Obrigatorio /></label>
              <textarea
                id="ajuda-descricao"
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                placeholder="Descreva o que é necessário, quantidade, prazo ou qualquer detalhe relevante..."
                maxLength={LIMITES.descricao}
                required
              />
              <ContadorCaracteres valor={descricao} limite={LIMITES.descricao} />
            </div>

            {/* Linha: categoria + urgência lado a lado */}
            <div className="sv-form-grade">

              {/* Categoria */}
              <div className="sv-campo">
                <label htmlFor="ajuda-categoria">Categoria<Obrigatorio /></label>
                <select id="ajuda-categoria" required value={categoria} onChange={e => setCategoria(e.target.value)}>
                  <option value="doacao">Doação (roupas, alimentos, etc.)</option>
                  <option value="medicamento">Medicamento</option>
                  <option value="voluntariado">Voluntariado</option>
                  <option value="infraestrutura">Infraestrutura</option>
                  <option value="outro">Outro</option>
                </select>
              </div>

              {/* Urgência */}
              <div className="sv-campo">
                <label htmlFor="ajuda-urgencia">Urgência<Obrigatorio /></label>
                <select id="ajuda-urgencia" required value={urgencia} onChange={e => setUrgencia(e.target.value)}>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="critica">Crítica</option>
                </select>
              </div>

            </div>

            {/* Erro */}
            {erro && (
              <p className="sv-aviso sv-aviso--erro" role="alert">
                {erro}
              </p>
            )}

            {/* Botões: cancelar discreto, ação principal em azul */}
            <div className="sv-form-rodape">
              <button
                type="button"
                onClick={() => navigate(`/abrigos/${id}/solicitacoes-ajuda`)}
                className="sv-btn sv-btn--discreto"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={enviando}
                className="sv-btn sv-btn--primario"
              >
                <LuSend /> {enviando ? 'Enviando...' : 'Criar Solicitação'}
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

export default CadastrarSolicitacaoAjuda