import { useState } from "react";
import { LuCalendar, LuIdCard, LuPhone, LuUpload, LuUser, LuUserRound } from 'react-icons/lu';
import SidebarGlass from '../../../components/SidebarGlass/SidebarGlass';
import '../../../styles/sosvale-glass.css';


const CadastroVitima = () => {
  // Estado para guardar a mensagem de sucesso ou erro
  const [mensagem, setMensagem] = useState('')
  // Estado para guardar a imagem em Base64
  const [fotoVitima, setfotoVitima] = useState(null)
  

  //----- Handle Image -----
  // Função que roda quando o usuário seleciona uma imagem
  const handleImagem = (e) => {
    const arquivo = e.target.files[0]

    // Verifica o tamanho — 2MB = 2 * 1024 * 1024 bytes
    const limiteMB = 2
    if (arquivo.size > limiteMB * 1024 * 1024) {
       setMensagem(`A imagem deve ter no máximo ${limiteMB}MB.`)
       return // para a execução
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1]
      setfotoVitima(base64)
    }
    reader.readAsDataURL(arquivo)
  }

  //----- Handle Submit -----
  // Função que roda quando o formulário é enviado
  const handleSubmit = async (e) => {
    // Impede a página de recarregar
    e.preventDefault()

    // Monta o objeto com os dados do formulário
    const dados = {
      nome: e.target.nome.value,
      cpf: e.target.cpf.value,
      telefone: e.target.telefone.value,
      dataNascimento: e.target.dataNascimento.value,
      genero: e.target.genero.value,
      fotoVitima: fotoVitima // Base64 da imagem
    }

    // Envia os dados para a API
    const resposta = await fetch('http://localhost:3000/api/vitimas/cadastrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados) // converte objeto para JSON
    })

    // Pega a resposta da API e atualiza a mensagem
    const resultado = await resposta.json()
    setMensagem(resultado.mensagem)
  }

  return (
  <div className="sv-app sv-pagina">
    <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
    <SidebarGlass ativo="vitimas" />
    <main className="sv-main">

      {/* Header padrão do projeto */}
      
        <header className="sv-topo">
          <div className="sv-topo-texto">

            {/* Breadcrumb mostrando o nome do abrigo que veio da API */}
            <p className="sv-trilha">
              Vítimas &gt;
            </p>

            {/* Título muda dependendo do modo */}
            <h1 className="sv-titulo">


            {/* Muda dependendo do modo */}
            {'Hub de Vitimas'}
            </h1>
            <p className="sv-subtitulo"> Cadastre uma nova vitíma</p>
          </div>
        </header>

      {/* Formulário com duas colunas */}
      <form onSubmit={handleSubmit} className="sv-vidro sv-painel sv-form-duas">

        {/* Coluna esquerda: campos de texto */}
        <div className="sv-form-coluna">

          <div className="sv-campo">
            <label><LuUser /> Nome Completo</label>
            <input type="text" name="nome" placeholder="Ex: João da Silva" required />
          </div>

          <div className="sv-campo">
            <label><LuIdCard /> CPF</label>
            <input type="text" name="cpf" placeholder="000.000.000-00" required />
          </div>

          <div className="sv-campo">
            <label><LuPhone /> Telefone</label>
            <input type="text" name="telefone" placeholder="(12) 99999-9999" />
          </div>

          <div className="sv-campo">
            <label><LuCalendar /> Data de Nascimento</label>
            <input type="date" name="dataNascimento" />
          </div>

          <div className="sv-campo">
            <label><LuUserRound /> Gênero</label>
            <select
             className="sv-entrada"
             id="genero"
             name="genero">
              <option value="">Selecione o gênero</option>
              <option value="Masculino">Masculino</option>
              <option value="Feminino">Feminino</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

        </div>

        {/* Coluna direita: foto + botão */}
        <div className="sv-form-coluna">

          <h3 className="sv-secao-titulo">
            Foto de Perfil
          </h3>

          {/* Preview da foto */}
          <div className="sv-upload">
            {fotoVitima ? (
              <div className="sv-upload-previa">
                {/*
                  fotoVitima aqui é base64 puro (sem o prefixo data:image)
                  então precisamos montar a src completa na mão
                */}
                <img src={`data:image/jpeg;base64,${fotoVitima}`} alt="Preview" />
                <button type="button" onClick={() => setfotoVitima(null)} className="sv-btn sv-btn--perigo-vidro sv-btn--p">
                  Remover Foto
                </button>
              </div>
            ) : (
              <label className="sv-upload-area">
                <input type="file" accept="image/*" onChange={handleImagem} style={{ display: 'none' }} />
                <LuUpload className="sv-upload-icone" />
                <p>Foto de perfil da vítima</p>
                <span className="sv-btn sv-btn--vidro sv-btn--p">Selecionar arquivo</span>
              </label>
            )}
          </div>

          {/* Botão submit */}
          <div className="sv-form-acoes">
            <button type="submit" className="sv-btn sv-btn--primario sv-btn--bloco">
              Cadastrar Vítima
            </button>
            {mensagem && (
              <p style={{ color: 'var(--sv-ok)', fontSize: '14px', textAlign: 'center' }}>
                {mensagem}
              </p>
            )}
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

export default CadastroVitima;