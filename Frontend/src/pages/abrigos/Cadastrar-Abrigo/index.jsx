import { useState } from "react";
import { LuAccessibility, LuArrowLeftRight, LuBriefcaseMedical, LuBuilding2, LuDog, LuHeartPulse, LuMapPin, LuMapPinned, LuNavigation, LuPhone, LuUpload, LuUser, LuUtensils } from 'react-icons/lu';
import SeletorLocalidade from "../../../components/SeletorLocalidade";
import MensagemFeedback from "../../../components/MensagemFeedback";
import { preencherPorCep, geocodificar } from "../../../services/localizacao";
import SidebarGlass from '../../../components/SidebarGlass/SidebarGlass';
import '../../../styles/sosvale-glass.css';
import { fetchAdmin } from '../../../services/api';
import { LIMITES, EXEMPLOS, aoDigitar, somenteNome, somenteNumeros, mascaraCep, mascaraTelefone, erroDosCampos } from '../../../utils/campos';
import { Obrigatorio, Opcional, AvisoObrigatorios } from '../../../components/MarcasCampo';
// Importada (e não "/src/assets/logo.png"): o caminho de texto quebrava no build
import logo from '../../../assets/logo.png';

const CadastrarAbrigo = () => {
  const [mensagem, setMensagem] = useState('');
  const [erroEnvio, setErroEnvio] = useState(false);
  const [fotoAbrigo, setFotoAbrigo] = useState(null);
  const [status, setStatus] = useState('ativo');

  // ── Localização: CEP → Estado / Cidade / Bairro / Endereço ───────────────
  // Ao digitar o CEP, o formulário se preenche sozinho (e cadastra o bairro se
  // ele ainda não existir). Os selects continuam editáveis para ajustes.
  const [cep, setCep] = useState('')
  const [endereco, setEndereco] = useState('')
  const [localidade, setLocalidade] = useState({ cidadeId: null, bairroId: null, estado: '', cidade: '', bairro: '' })
  const [feedbackCep, setFeedbackCep] = useState(null)

  const handleLocalidade = (novaLocalidade) => {
    setLocalidade(novaLocalidade)
    // Limpa as coordenadas ao trocar a localização pois o endereço pode ter mudado
    setLatitude(null)
    setLongitude(null)
    setFeedbackGeo(null)
  }
  // ─────────────────────────────────────────────────────────────────────────

  const [capacidadeTotal, setCapacidadeTotal] = useState(0);
  const [capacidadeOcupada, setCapacidadeOcupada] = useState(0);

  const [erroCapacidade, setErroCapacidade] = useState('')
  const validarCapacidade = (ocupada, total) => {
    if (ocupada > total) {
      setErroCapacidade('Capacidade ocupada não pode ser maior que a total.')
    } else {
      setErroCapacidade('')
    }
  }

  // ── Coordenadas para o mapa ──────────────────────────────────────────────
  // Sem latitude/longitude o abrigo NÃO aparece no mapa
  const [latitude, setLatitude] = useState(null)
  const [longitude, setLongitude] = useState(null)

  // feedbackGeo mostra o resultado para o usuário
  // tipo: 'sucesso' | 'aviso' (localização aproximada) | 'erro' | 'buscando'
  const [feedbackGeo, setFeedbackGeo] = useState(null)

  // Busca as coordenadas tentando do mais preciso ao mais geral
  // (endereço → rua → CEP → bairro → cidade), veja services/localizacao.js
  const buscarLocalizacao = async (loc = localidade, end = endereco, cepAtual = cep) => {
    if (!loc.cidade) {
      setFeedbackGeo({ tipo: 'erro', mensagem: 'Informe o CEP ou escolha a cidade para localizar o abrigo no mapa.' })
      return
    }

    setFeedbackGeo({ tipo: 'buscando', mensagem: 'Buscando localização no mapa...' })
    const resultado = await geocodificar({
      endereco: end.trim().replace(/,\s*$/, ''),
      bairro: loc.bairro, cidade: loc.cidade, estado: loc.estado, cep: cepAtual,
    })

    if (!resultado) {
      setLatitude(null)
      setLongitude(null)
      setFeedbackGeo({ tipo: 'erro', mensagem: 'Localização não encontrada — o abrigo não aparecerá no mapa. Confira o endereço.' })
      return
    }

    setLatitude(resultado.latitude)
    setLongitude(resultado.longitude)
    const exata = ['endereco', 'rua'].includes(resultado.precisao)
    setFeedbackGeo({
      tipo: exata ? 'sucesso' : 'aviso',
      mensagem: `Localização encontrada ${resultado.descricao} (${resultado.latitude.toFixed(5)}, ${resultado.longitude.toFixed(5)})`
        + (exata ? '' : ' — o marcador ficará próximo, não no ponto exato.'),
    })
  }

  // Ao completar os 8 números do CEP, preenche o resto sozinho
  const handleCep = async (valor) => {
    setCep(valor)
    const digitos = valor.replace(/\D/g, '')
    if (digitos.length !== 8) {
      setFeedbackCep(null)
      return
    }

    setFeedbackCep({ tipo: 'buscando', mensagem: 'Buscando endereço pelo CEP...' })
    try {
      const dados = await preencherPorCep(digitos)

      if (!dados.cidadeId) {
        setFeedbackCep({ tipo: 'aviso', mensagem: `CEP de ${dados.cidade}/${dados.estado}, que ainda não está cadastrada. Cadastre a cidade em Regiões ou escolha abaixo.` })
        return
      }

      const loc = { cidadeId: dados.cidadeId, bairroId: dados.bairroId, estado: dados.estado, cidade: dados.cidade, bairro: dados.bairro }
      setLocalidade(loc)

      // Deixa a rua pronta para a pessoa só completar o número
      const novoEndereco = dados.logradouro ? `${dados.logradouro}, ` : endereco
      setEndereco(novoEndereco)

      setFeedbackCep({
        tipo: 'sucesso',
        mensagem: `✓ ${[dados.logradouro, dados.bairro, `${dados.cidade}/${dados.estado}`].filter(Boolean).join(' — ')}`
          + (dados.criouBairro ? ' (bairro cadastrado agora)' : '')
          + (dados.logradouro ? '. Complete o número no endereço.' : ''),
      })

      buscarLocalizacao(loc, novoEndereco, digitos)
    } catch (erro) {
      setFeedbackCep({ tipo: 'erro', mensagem: erro.message })
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Handle Imagens
  const handleImagem = (e) => {
    const arquivo = e.target.files[0]
    // Cancelou a janela de seleção: não há arquivo
    if (!arquivo) return
    const limiteMB = 2
    if (arquivo.size > limiteMB * 1024 * 1024) {
      setErroEnvio(true)
      setMensagem(`A imagem deve ter no máximo ${limiteMB}MB.`)
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1]
      setFotoAbrigo(base64)
    }
    reader.readAsDataURL(arquivo)
  }

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault()

    // Confere telefone e CEP antes de enviar
    const erroCampos = erroDosCampos({ telefone: e.target.telefone.value, cep })
    if (erroCampos) {
      setErroEnvio(true)
      setMensagem(erroCampos)
      return
    }

    const dados = {
      status: e.target.status.value,
      nome: e.target.nome.value.trim(),
      cep,
      cidadeId: localidade.cidadeId,
      bairroId: localidade.bairroId,
      endereco: endereco.trim().replace(/,s*$/, ''),
      telefone: e.target.telefone.value,
      responsavel: e.target.responsavel.value.trim(),
      tipoAbrigo: e.target.tipoAbrigo.value,
      capacidadeTotal: Number(e.target.capacidadeTotal.value),
      capacidadeOcupada: Number(e.target.capacidadeOcupada.value) || 0,
      possuiAtendimentoMedico: e.target.possuiAtendimentoMedico.checked,
      possuiEnfermagem: e.target.possuiEnfermagem.checked,
      possuiPets: e.target.possuiPets.checked,
      possuiAcessibilidade: e.target.possuiAcessibilidade.checked,
      possuiCozinha: e.target.possuiCozinha.checked,
      fotoAbrigo: fotoAbrigo,

      // Inclui latitude e longitude gerados pelo geocoding
      // Se o geocoding falhou ou não rodou, envia null — o banco aceita null nos dois campos
      latitude: latitude,
      longitude: longitude,
    }

    if (capacidadeOcupada > capacidadeTotal) {
      if (erroCapacidade) return
    }

    try {
      const resposta = await fetchAdmin('/abrigos/cadastrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      })

      const resultado = await resposta.json().catch(() => ({}))
      setErroEnvio(!resposta.ok)
      setMensagem(resultado.mensagem ?? (resposta.ok ? 'Abrigo cadastrado!' : `Erro ${resposta.status} ao cadastrar.`))
    } catch (erro) {
      console.error('Erro ao cadastrar abrigo:', erro)
      setErroEnvio(true)
      setMensagem('Erro ao conectar com o servidor. Tente novamente.')
    }
  }

  return (
    <div className="sv-app sv-pagina">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>

      <SidebarGlass ativo="abrigos" />

      <main className="sv-main">

        <header className="sv-topo">
          <div className="sv-topo-texto">
            <p className="sv-trilha">
              Abrigos &gt; <span>Novo Abrigo</span>
            </p>
            <h1 className="sv-titulo">
              Cadastro de Abrigo
            </h1>
            <p className="sv-subtitulo"> Cadastre um novo abrigo</p>
          </div>
          <div className="top-icons">
            <img src={logo} width="80px" alt="Logo S.O.S Vale" />
          </div>
        </header>

        <form onSubmit={handleSubmit} className="sv-vidro sv-painel sv-form-duas">

          <div className="sv-form-coluna">

            <AvisoObrigatorios />

            <div className="sv-campo">
              <label htmlFor="status">Status<Obrigatorio /></label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={`sv-entrada sv-estado ${status}`}>
                <option value="ativo">Ativado</option>
                <option value="manutencao">Manutenção</option>
                <option value="desativado">Desativado</option>
              </select>
            </div>

            <div className="sv-campo">
              <label htmlFor="nome-abrigo"><LuBuilding2 /> Nome do Abrigo<Obrigatorio /></label>
              <input type="text" id="nome-abrigo" name="nome" placeholder="Ex: Escola Municipal Centro"
                maxLength={LIMITES.nomeLocal} minLength={3} required />
            </div>

            {/* CEP primeiro: ao completar, preenche estado, cidade, bairro e rua */}
            <div className="sv-campo">
              <label htmlFor="cep-abrigo"><LuMapPinned /> CEP<Obrigatorio /></label>
              {/* Só números; o hífen é colocado sozinho */}
              <input
                type="text"
                id="cep-abrigo"
                name="cep"
                inputMode="numeric"
                placeholder={EXEMPLOS.cep}
                value={cep}
                onChange={(e) => handleCep(mascaraCep(e.target.value))}
                maxLength={LIMITES.cep}
                required
              />
              <MensagemFeedback feedback={feedbackCep} />
            </div>

            {/* Estado → Cidade → Bairro (preenchidos pelo CEP, mas dá para ajustar) */}
            <SeletorLocalidade
              cidadeId={localidade.cidadeId}
              bairroId={localidade.bairroId}
              bairroObrigatorio
              onChange={handleLocalidade}
            />

            {/* Endereço: ao sair do campo, a localização é buscada de novo com o número */}
            <div className="sv-campo">
              <label htmlFor="endereco-abrigo"><LuMapPin /> Endereço<Obrigatorio /></label>
              <input
                type="text"
                id="endereco-abrigo"
                name="endereco"
                maxLength={LIMITES.endereco}
                placeholder="Ex: Rua das Flores, 123"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                onBlur={() => endereco.trim() && buscarLocalizacao()}
                required
              />
              <MensagemFeedback feedback={feedbackGeo} />
              <button
                type="button"
                className="sv-btn sv-btn--vidro sv-btn--p sv-btn--inicio"
                onClick={() => buscarLocalizacao()}
              >
                <LuNavigation /> Localizar no mapa
              </button>
            </div>

            <div className="sv-campo">
              <label htmlFor="telefone-abrigo"><LuPhone /> Telefone<Obrigatorio /></label>
              <input type="tel" id="telefone-abrigo" name="telefone" inputMode="numeric" placeholder={EXEMPLOS.telefone}
                maxLength={LIMITES.telefone} required onChange={aoDigitar(mascaraTelefone)} />
            </div>

            <div className="sv-campo">
              <label htmlFor="responsavel-abrigo"><LuUser /> Responsável<Obrigatorio /></label>
              <input type="text" id="responsavel-abrigo" name="responsavel" placeholder="Nome do responsável"
                maxLength={LIMITES.nomePessoa} minLength={2} required onChange={aoDigitar(somenteNome)} />
            </div>

            <div className="sv-campo">
              <label htmlFor="tipo-abrigo"><LuBuilding2 /> Tipo de Abrigo<Obrigatorio /></label>
              {/* defaultValue="" mostra "Selecione o tipo" (antes já vinha "Escola" marcada) */}
              <select className="sv-entrada" id="tipo-abrigo" name="tipoAbrigo" defaultValue="" required>
                <option value="" disabled>Selecione o tipo</option>
                <option value="Escola">Escola</option>
                <option value="Ginásio">Ginásio</option>
                <option value="Igreja">Igreja</option>
                <option value="Hotel">Hotel</option>
                <option value="Pousada">Pousada</option>
                <option value="CentroCultural">Centro Cultural</option>
                <option value="CentroComunitário">Centro Comunitário</option>
                <option value="Campo">Campo</option>
              </select>
            </div>

            <div className="sv-campo">
              <label htmlFor="capacidade-total"><LuArrowLeftRight /> Capacidade Total<Obrigatorio /></label>
              {/* type="text" + só números: o type="number" aceitava "e", "+" e "-" */}
              <input
                type="text"
                id="capacidade-total"
                name="capacidadeTotal"
                inputMode="numeric"
                placeholder="Ex: 100"
                maxLength={LIMITES.capacidadeDigitos}
                required
                onChange={(e) => {
                  e.target.value = somenteNumeros(e.target.value, LIMITES.capacidadeDigitos)
                  const total = parseInt(e.target.value) || 0
                  setCapacidadeTotal(total)
                  validarCapacidade(capacidadeOcupada, total)
                }}
              />
            </div>

            <div className="sv-campo">
              <label htmlFor="capacidade-ocupada"><LuArrowLeftRight /> Capacidade Ocupada<Opcional /></label>
              <input
                type="text"
                id="capacidade-ocupada"
                name="capacidadeOcupada"
                inputMode="numeric"
                maxLength={LIMITES.capacidadeDigitos}
                className={`sv-entrada ${erroCapacidade ? 'sv-entrada--erro' : ''}`}
                placeholder="Ex: 0 (vazio = 0)"
                onChange={(e) => {
                  e.target.value = somenteNumeros(e.target.value, LIMITES.capacidadeDigitos)
                  const ocupada = parseInt(e.target.value) || 0
                  setCapacidadeOcupada(ocupada)
                  validarCapacidade(ocupada, capacidadeTotal)
                }}
              />
            </div>

            {erroCapacidade && (
              <p style={{ color: 'var(--sv-sirene)', fontSize: '13px', marginTop: '4px' }}>
                {erroCapacidade}
              </p>
            )}

            {/* Checkboxes de infraestrutura */}
            <div className="sv-form-secao">
              <h3 className="sv-secao-titulo">
                Infraestrutura<Opcional />
              </h3>

              <label className="sv-opcao">
                <input type="checkbox" name="possuiAtendimentoMedico" />
                <div className="sv-opcao-caixa">
                  <LuBriefcaseMedical className="sv-opcao-icone" /><span>Atendimento Médico</span>
                </div>
              </label>

              <label className="sv-opcao">
                <input type="checkbox" name="possuiEnfermagem" />
                <div className="sv-opcao-caixa">
                  <LuHeartPulse className="sv-opcao-icone" /><span>Enfermagem</span>
                </div>
              </label>

              <label className="sv-opcao">
                <input type="checkbox" name="possuiPets" />
                <div className="sv-opcao-caixa">
                  <LuDog className="sv-opcao-icone" /><span>Pets Bem-Vindos</span>
                </div>
              </label>

              <label className="sv-opcao">
                <input type="checkbox" name="possuiAcessibilidade" />
                <div className="sv-opcao-caixa">
                  <LuAccessibility className="sv-opcao-icone" /><span>Acessibilidade</span>
                </div>
              </label>

              <label className="sv-opcao">
                <input type="checkbox" name="possuiCozinha" />
                <div className="sv-opcao-caixa">
                  <LuUtensils className="sv-opcao-icone" /><span>Cozinha Comunitária</span>
                </div>
              </label>

            </div>
          </div>

          {/* Coluna direita: foto + botão */}
          <div className="sv-form-coluna">

            <h3 className="sv-secao-titulo">
              Imagem do Abrigo<Opcional />
            </h3>

            <div className="sv-upload">
              {fotoAbrigo ? (
                <div className="sv-upload-previa">
                  <img src={`data:image/jpeg;base64,${fotoAbrigo}`} alt="Preview" />
                  <button type="button" onClick={() => setFotoAbrigo(null)} className="sv-btn sv-btn--perigo-vidro sv-btn--p">
                    Remover Foto
                  </button>
                </div>
              ) : (
                <label className="sv-upload-area">
                  <input type="file" accept="image/jpeg,image/png" onChange={handleImagem} style={{ display: 'none' }} />
                  <LuUpload className="sv-upload-icone" />
                  <p>Foto principal do abrigo (JPG ou PNG, até 2 MB)</p>
                  <span className="sv-btn sv-btn--vidro sv-btn--p">Selecionar arquivo do computador</span>
                </label>
              )}
            </div>

            <div className="sv-form-acoes">
              <button type="submit" className="sv-btn sv-btn--primario sv-btn--bloco">
                Cadastrar Abrigo
              </button>
              {mensagem && (
                <p style={{ color: erroEnvio ? 'var(--sv-sirene)' : 'var(--sv-ok)', fontSize: '14px', textAlign: 'center' }}>
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
  );
};

export default CadastrarAbrigo;
