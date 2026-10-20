import { useState } from "react";
import { LuCalendar, LuIdCard, LuPhone, LuUpload, LuUser, LuUserRound } from 'react-icons/lu';
import SidebarGlass from '../../../components/SidebarGlass/SidebarGlass';
import '../../../styles/sosvale-glass.css';
import { fetchAdmin, hojeISO } from '../../../services/api';
import { LIMITES, EXEMPLOS, aoDigitar, somenteNome, mascaraCpf, mascaraTelefone, erroDosCampos } from '../../../utils/campos';
import { Obrigatorio, Opcional, AvisoObrigatorios } from '../../../components/MarcasCampo';


const CadastroVitima = () => {
  // Estado para guardar a mensagem de sucesso ou erro
  const [mensagem, setMensagem] = useState('')
  // true quando a mensagem é de erro (aparece em vermelho, não em verde)
  const [erroEnvio, setErroEnvio] = useState(false)
  // Estado para guardar a imagem em Base64
  const [fotoVitima, setfotoVitima] = useState(null)
  

  //----- Handle Image -----
  // Função que roda quando o usuário seleciona uma imagem
  const handleImagem = (e) => {
    const arquivo = e.target.files[0]
    // Cancelou a janela de seleção: não há arquivo
    if (!arquivo) return

    // Verifica o tamanho — 2MB = 2 * 1024 * 1024 bytes
    const limiteMB = 2
    if (arquivo.size > limiteMB * 1024 * 1024) {
       setErroEnvio(true)
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

    // Confere CPF (dígitos verificadores) e telefone antes de enviar
    const erroCampos = erroDosCampos({ cpf: e.target.cpf.value, telefone: e.target.telefone.value })
    if (erroCampos) {
      setErroEnvio(true)
      setMensagem(erroCampos)
      return
    }

    // Monta o objeto com os dados do formulário
    const dados = {
      nome: e.target.nome.value.trim(),
      cpf: e.target.cpf.value,
      // Telefone é único no banco: vazio vai como null (antes "" dava erro na 2ª vítima sem telefone)
      telefone: e.target.telefone.value.trim() || null,
      dataNascimento: e.target.dataNascimento.value,
      genero: e.target.genero.value,
      fotoVitima: fotoVitima // Base64 da imagem
    }

    // Envia os dados para a API
    try {
      const resposta = await fetchAdmin('/vitimas/cadastrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados) // converte objeto para JSON
      })

      // Pega a resposta da API e atualiza a mensagem
      const resultado = await resposta.json().catch(() => ({}))
      setErroEnvio(!resposta.ok)
      setMensagem(resultado.mensagem ?? (resposta.ok ? 'Vítima cadastrada!' : `Erro ${resposta.status} ao cadastrar.`))
    } catch (erro) {
      console.error('Erro ao cadastrar vítima:', erro)
      setErroEnvio(true)
      setMensagem('Erro ao conectar com o servidor. Tente novamente.')
    }
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

          <AvisoObrigatorios />

          {/* Nome: só letras (números são removidos ao digitar) */}
          <div className="sv-campo">
            <label htmlFor="nome"><LuUser /> Nome Completo<Obrigatorio /></label>
            <input type="text" id="nome" name="nome" placeholder="Ex: Maria da Silva"
              maxLength={LIMITES.nomePessoa} minLength={2} autoComplete="off" required
              onChange={aoDigitar(somenteNome)} />
          </div>

          {/* CPF e telefone: só números, a pontuação é colocada sozinha */}
          <div className="sv-campo">
            <label htmlFor="cpf"><LuIdCard /> CPF<Obrigatorio /></label>
            <input type="text" id="cpf" name="cpf" placeholder={EXEMPLOS.cpf} inputMode="numeric"
              maxLength={LIMITES.cpf} autoComplete="off" required
              onChange={aoDigitar(mascaraCpf)} />
          </div>

          <div className="sv-campo">
            <label htmlFor="telefone"><LuPhone /> Telefone<Opcional /></label>
            <input type="tel" id="telefone" name="telefone" placeholder={EXEMPLOS.telefone} inputMode="numeric"
              maxLength={LIMITES.telefone} autoComplete="off"
              onChange={aoDigitar(mascaraTelefone)} />
          </div>

          <div className="sv-campo">
            <label htmlFor="dataNascimento"><LuCalendar /> Data de Nascimento<Obrigatorio /></label>
            <input type="date" id="dataNascimento" name="dataNascimento" min="1900-01-01" max={hojeISO()} required />
          </div>

          <div className="sv-campo">
            <label htmlFor="genero"><LuUserRound /> Gênero<Obrigatorio /></label>
            <select
             className="sv-entrada"
             id="genero"
             name="genero"
             required>
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
            Foto de Perfil<Opcional />
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
                <input type="file" accept="image/jpeg,image/png" onChange={handleImagem} style={{ display: 'none' }} />
                <LuUpload className="sv-upload-icone" />
                <p>Foto de perfil da vítima (JPG ou PNG, até 2 MB)</p>
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
              <p role={erroEnvio ? 'alert' : 'status'} className={`sv-aviso ${erroEnvio ? 'sv-aviso--erro' : 'sv-aviso--sucesso'}`}>
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