import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import { LuAccessibility, LuArrowLeftRight, LuBriefcaseMedical, LuBuilding2, LuChevronRight, LuDog, LuHandHeart, LuHeartPulse, LuMapPin, LuMapPinned, LuPhone, LuPlus, LuTriangleAlert, LuUpload, LuUser, LuUsers, LuUtensils } from 'react-icons/lu';
import { Esqueleto, ErroPagina, Vazio } from '../../../components/EstadosPagina';
import SeletorLocalidade from '../../../components/SeletorLocalidade';
import MensagemFeedback from '../../../components/MensagemFeedback';
import { preencherPorCep, geocodificar } from '../../../services/localizacao';
import SidebarGlass from '../../../components/SidebarGlass/SidebarGlass';
import '../../../styles/sosvale-glass.css';
import { fetchAdmin } from '../../../services/api';
import { LIMITES, EXEMPLOS, somenteNome, somenteNumeros, mascaraCep, mascaraTelefone, erroDosCampos } from '../../../utils/campos';
import { Obrigatorio, AvisoObrigatorios } from '../../../components/MarcasCampo';

// ─── Badges das solicitações de ajuda ────────────────────────────────────────
const badgeAjuda = {
  aberto:       { label: 'Aberto',       bg: 'var(--sv-azul-suave)', cor: 'var(--sv-azul-forte)' },
  em_andamento: { label: 'Em andamento', bg: 'var(--sv-atencao-suave)', cor: 'var(--sv-atencao-forte)' },
  concluido:    { label: 'Concluído',    bg: 'var(--sv-ok-suave)', cor: 'var(--sv-ok-forte)' },
  cancelado:    { label: 'Cancelado',    bg: 'var(--sv-sirene-suave)', cor: 'var(--sv-sirene-forte)' },
}

const categoriaLabel = {
  doacao:         'Doação',
  medicamento:    'Medicamento',
  voluntariado:   'Voluntariado',
  infraestrutura: 'Infraestrutura',
  outro:          'Outro',
}

function DetalhesAbrigo() {

  // ─── ESTADOS ─────────────────────────────────────────────────────────────────
  const { id } = useParams();
  const navigate = useNavigate();

  const [dadosAbrigo, setDadosAbrigo] = useState({})
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState(null); // falha ao buscar o abrigo
  const [editando, setEditando] = useState(false);

  const [nomeAbrigo, setNomeAbrigo] = useState('');
  const [status, setStatus] = useState('ativo');
  const [cep, setCep] = useState('');
  const [estado, setEstado] = useState('');
  const [cidade, setCidade] = useState('');
  const [bairro, setBairro] = useState('');
  const [endereco, setEndereco] = useState('');
  const [telefone, setTelefone] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [tipoAbrigo, setTipoAbrigo] = useState('');
  const [capacidadeTotal, setCapacidadeTotal] = useState(0);
  const [capacidadeOcupada, setCapacidadeOcupada] = useState(0);

  // IDs da localização (os nomes acima são só para exibir e para o geocoding)
  const [cidadeId, setCidadeId] = useState(null);
  const [bairroId, setBairroId] = useState(null);

  const handleLocalidade = (localidade) => {
    setCidadeId(localidade.cidadeId)
    setBairroId(localidade.bairroId)
    setEstado(localidade.estado)
    setCidade(localidade.cidade)
    setBairro(localidade.bairro)
    // O endereço pode ter mudado: as coordenadas precisam ser buscadas de novo
    setLatitude(null)
    setLongitude(null)
    setFeedbackGeo(null)
  }

  const [fotoUrl, setFotoUrl] = useState(null);
  const [novaFoto, setNovaFoto] = useState(null);
  const fotoExibida = novaFoto ?? fotoUrl;

  const [erroCapacidade, setErroCapacidade] = useState('')

  const validarCapacidade = (ocupada, total) => {
    if (ocupada === 0 && total === 0) return
    if (ocupada > total) {
      setErroCapacidade('Capacidade ocupada não pode ser maior que a total.')
    } else {
      setErroCapacidade('')
    }
  }

  const [latitude, setLatitude] = useState(null)
  const [longitude, setLongitude] = useState(null)
  const [feedbackGeo, setFeedbackGeo] = useState(null)

  const [vitimasRecentes, setVitimasRecentes] = useState([])

  // ─── NOVO: solicitações de ajuda ─────────────────────────────────────────────
  const [solicitacoesAjuda, setSolicitacoesAjuda] = useState([])

  const [infraestrutura, setInfraestrutura] = useState({
    possuiAtendimentoMedico: false,
    possuiEnfermagem: false,
    possuiPets: false,
    possuiAcessibilidade: false,
    possuiCozinha: false
  });

  // ─── BUSCA AO CARREGAR ────────────────────────────────────────────────────────
  // Função própria para o botão "Tentar novamente" poder chamar de novo
  const carregarTudo = useCallback(() => {

    const buscarAbrigo = async () => {
      setCarregando(true);
      setErroCarga(null);
      try {
        const resposta = await fetchAdmin(`/abrigos/listar/${id}`);
        if (!resposta.ok) {
          throw new Error(resposta.status === 404 ? 'Este abrigo não foi encontrado. Ele pode ter sido excluído.' : `Erro ${resposta.status}`)
        }
        const dados = await resposta.json();

        setDadosAbrigo(dados)
        setNomeAbrigo(dados.nome);
        setStatus(dados.status ?? 'ativo');
        setCep(dados.cep ?? '');
        setEstado(dados.estado ?? '');
        setCidade(dados.cidade ?? '');
        setBairro(dados.bairro ?? '');
        setCidadeId(dados.cidadeId ?? null);
        setBairroId(dados.bairroId ?? null);
        setEndereco(dados.endereco ?? '');
        setTelefone(dados.telefone ?? '');
        setResponsavel(dados.responsavel ?? '');
        setTipoAbrigo(dados.tipoAbrigo ?? '');
        setCapacidadeTotal(dados.capacidadeTotal ?? 0);
        setCapacidadeOcupada(dados.capacidadeOcupada ?? 0);
        setLatitude(dados.latitude ?? null)
        setLongitude(dados.longitude ?? null)

        if (dados.latitude && dados.longitude) {
          setFeedbackGeo({
            tipo: 'existente',
            mensagem: `Localização cadastrada: (${Number(dados.latitude).toFixed(5)}, ${Number(dados.longitude).toFixed(5)})`
          })
        }

        setFotoUrl(dados.fotoAbrigo ? dados.fotoAbrigo + '?t=' + Date.now() : null)

        setInfraestrutura({
          possuiAtendimentoMedico: dados.possuiAtendimentoMedico ?? false,
          possuiEnfermagem: dados.possuiEnfermagem ?? false,
          possuiPets: dados.possuiPets ?? false,
          possuiAcessibilidade: dados.possuiAcessibilidade ?? false,
          possuiCozinha: dados.possuiCozinha ?? false
        });

        if (dados.vitimas && dados.vitimas.length > 0) {
          const cincoMaisRecentes = [...dados.vitimas]
            .sort((a, b) => new Date(b.dataEntrada ?? b.createdAt) - new Date(a.dataEntrada ?? a.createdAt))
            .slice(0, 5)
          setVitimasRecentes(cincoMaisRecentes)
        }

      } catch (erro) {
        console.error("Erro ao buscar abrigo:", erro);
        setErroCarga(erro.message?.startsWith('Este abrigo') ? erro.message : 'O servidor não respondeu. Verifique a conexão e tente novamente.');
      } finally {
        setCarregando(false);
      }
    };

    // ─── NOVO: busca as 3 últimas solicitações deste abrigo ──────────────────
    const buscarSolicitacoesAjuda = async () => {
      try {
        const resposta = await fetchAdmin(`/solicitacoes-ajuda/abrigo/${id}?limite=3`)
        const dados = await resposta.json()
        setSolicitacoesAjuda(dados.solicitacoes ?? [])
      } catch (erro) {
        console.error('Erro ao buscar solicitações de ajuda:', erro)
      }
    }

    buscarAbrigo();
    buscarSolicitacoesAjuda();
  }, [id]);

  useEffect(() => { carregarTudo() }, [carregarTudo]);

  // ─── HANDLERS ────────────────────────────────────────────────────────────────
  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setInfraestrutura(prev => ({ ...prev, [name]: checked }));
  };

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

  const handleGeocodificar = async () => {
    if (latitude && longitude) {
      const confirmar = confirm(
        `Este abrigo já possui localização cadastrada:\nLat: ${Number(latitude).toFixed(5)} | Lng: ${Number(longitude).toFixed(5)}\n\nDeseja atualizar as coordenadas com base no endereço atual?`
      )
      if (!confirmar) return
    }

    await buscarLocalizacao()
  }

  // Busca as coordenadas tentando do mais preciso ao mais geral
  // (endereço → rua → CEP → bairro → cidade), veja services/localizacao.js.
  // Sem coordenadas o abrigo NÃO aparece no mapa.
  const buscarLocalizacao = async (loc = { estado, cidade, bairro }, end = endereco, cepAtual = cep) => {
    if (!loc.cidade) {
      setFeedbackGeo({ tipo: 'erro', mensagem: 'Informe o CEP ou escolha a cidade antes de buscar.' })
      return
    }

    setFeedbackGeo({ tipo: 'buscando', mensagem: 'Buscando localização no mapa...' })
    const resultado = await geocodificar({
      endereco: end.trim().replace(/,\s*$/, ''),
      bairro: loc.bairro, cidade: loc.cidade, estado: loc.estado, cep: cepAtual,
    })

    if (!resultado) {
      setFeedbackGeo({ tipo: 'erro', mensagem: 'Localização não encontrada — o abrigo não aparecerá no mapa. Confira o endereço.' })
      return
    }

    setLatitude(resultado.latitude)
    setLongitude(resultado.longitude)
    const exata = ['endereco', 'rua'].includes(resultado.precisao)
    setFeedbackGeo({
      tipo: exata ? 'sucesso' : 'aviso',
      mensagem: `Localização encontrada ${resultado.descricao} (${resultado.latitude.toFixed(5)}, ${resultado.longitude.toFixed(5)})`
        + (exata ? '' : ' — o marcador ficará próximo, não no ponto exato.')
        + ' Clique em Salvar para gravar.',
    })
  }

  // No modo edição, ao completar os 8 números do CEP, preenche o resto sozinho
  const [feedbackCep, setFeedbackCep] = useState(null)

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

      setCidadeId(dados.cidadeId)
      setBairroId(dados.bairroId)
      setEstado(dados.estado)
      setCidade(dados.cidade)
      setBairro(dados.bairro)

      const novoEndereco = dados.logradouro ? `${dados.logradouro}, ` : endereco
      setEndereco(novoEndereco)

      setFeedbackCep({
        tipo: 'sucesso',
        mensagem: `✓ ${[dados.logradouro, dados.bairro, `${dados.cidade}/${dados.estado}`].filter(Boolean).join(' — ')}`
          + (dados.criouBairro ? ' (bairro cadastrado agora)' : '')
          + (dados.logradouro ? '. Complete o número no endereço.' : ''),
      })

      buscarLocalizacao({ estado: dados.estado, cidade: dados.cidade, bairro: dados.bairro }, novoEndereco, digitos)
    } catch (erro) {
      setFeedbackCep({ tipo: 'erro', mensagem: erro.message })
    }
  }

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (capacidadeOcupada > capacidadeTotal) {
      if (erroCapacidade) return
    }

    // Confere telefone e CEP só se foram alterados — cadastros antigos fora do
    // padrão continuam editáveis (a API faz a mesma coisa)
    const erroCampos = erroDosCampos({
      telefone: telefone !== (dadosAbrigo.telefone ?? '') ? telefone : null,
      cep:      cep      !== (dadosAbrigo.cep ?? '')      ? cep      : null,
    })
    if (erroCampos) {
      alert(erroCampos)
      return
    }

    try {
      const resposta = await fetchAdmin(`/abrigos/atualizar/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nomeAbrigo,
          status,
          cep,
          cidadeId,
          bairroId,
          endereco,
          telefone,
          responsavel,
          tipoAbrigo,
          capacidadeTotal,
          capacidadeOcupada,
          latitude,
          longitude,
          fotoAbrigo: novaFoto === false ? null : novaFoto ? novaFoto.split(',')[1] : fotoUrl,
          ...infraestrutura
        }),
      });

      const dadosResultado = await resposta.json()

      // Só confirma se a API aceitou (ex: bairro de outra cidade → 400)
      if (!resposta.ok) {
        alert(dadosResultado.mensagem ?? 'Não foi possível salvar o abrigo.')
        return
      }

      setDadosAbrigo({
        ...dadosAbrigo,
        nome: nomeAbrigo, cep, estado, cidade, bairro, cidadeId, bairroId, endereco,
        telefone, responsavel, tipoAbrigo, capacidadeTotal, capacidadeOcupada,
        latitude, longitude,
        possuiAtendimentoMedico: infraestrutura.possuiAtendimentoMedico,
        possuiEnfermagem: infraestrutura.possuiEnfermagem,
        possuiPets: infraestrutura.possuiPets,
        possuiAcessibilidade: infraestrutura.possuiAcessibilidade,
        possuiCozinha: infraestrutura.possuiCozinha
      })

      setFotoUrl(dadosResultado.fotoAbrigo ? dadosResultado.fotoAbrigo + '?t=' + Date.now() : null);

      if (latitude && longitude) {
        setFeedbackGeo({
          tipo: 'existente',
          mensagem: `Localização cadastrada: (${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)})`
        })
      }

      alert('Abrigo atualizado com sucesso!');
      setNovaFoto(null);
      setEditando(false);
    } catch (erro) {
      console.error("Erro ao salvar:", erro);
    }
  };

  const handleExcluir = async () => {
    if (!confirm('Tem certeza que deseja excluir este abrigo?')) return;
    try {
      const resposta = await fetchAdmin(`/abrigos/excluir/${id}`, { method: 'DELETE' });
      // Só volta para a lista se a API excluiu de verdade
      // (ex: abrigo com solicitações de ajuda → a API recusa e explica o motivo)
      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => ({}))
        alert(dados.mensagem ?? 'Não foi possível excluir o abrigo.')
        return
      }
      navigate('/abrigos');
    } catch (erro) {
      console.error("Erro ao excluir:", erro);
    }
  };

  const handleEditar = async () => {
    setEditando(true)
    validarCapacidade(capacidadeOcupada, capacidadeTotal)
  }

  const handleCancelExcluir = async () => {
    if (capacidadeOcupada > capacidadeTotal) {
      if (erroCapacidade) return
    }
    setEditando(false);
    setNomeAbrigo(dadosAbrigo.nome);
    setCep(dadosAbrigo.cep ?? '');
    setEstado(dadosAbrigo.estado ?? '');
    setCidade(dadosAbrigo.cidade ?? '');
    setBairro(dadosAbrigo.bairro ?? '');
    setCidadeId(dadosAbrigo.cidadeId ?? null);
    setBairroId(dadosAbrigo.bairroId ?? null);
    setEndereco(dadosAbrigo.endereco)
    setTelefone(dadosAbrigo.telefone);
    setResponsavel(dadosAbrigo.responsavel);
    setTipoAbrigo(dadosAbrigo.tipoAbrigo);
    setCapacidadeTotal(dadosAbrigo.capacidadeTotal);
    setCapacidadeOcupada(dadosAbrigo.capacidadeOcupada);
    setLatitude(dadosAbrigo.latitude ?? null)
    setLongitude(dadosAbrigo.longitude ?? null)

    if (dadosAbrigo.latitude && dadosAbrigo.longitude) {
      setFeedbackGeo({
        tipo: 'existente',
        mensagem: `Localização cadastrada: (${Number(dadosAbrigo.latitude).toFixed(5)}, ${Number(dadosAbrigo.longitude).toFixed(5)})`
      })
    } else {
      setFeedbackGeo(null)
    }

    setInfraestrutura({
      possuiAtendimentoMedico: dadosAbrigo.possuiAtendimentoMedico ?? false,
      possuiEnfermagem: dadosAbrigo.possuiEnfermagem ?? false,
      possuiPets: dadosAbrigo.possuiPets ?? false,
      possuiAcessibilidade: dadosAbrigo.possuiAcessibilidade ?? false,
      possuiCozinha: dadosAbrigo.possuiCozinha ?? false
    })
  }

  // ─── UTILITÁRIOS ─────────────────────────────────────────────────────────────
  const calcularIdade = (dataNascimento) => {
    if (!dataNascimento) return '—'
    const hoje = new Date()
    const nasc = new Date(dataNascimento)
    let idade = hoje.getFullYear() - nasc.getFullYear()
    const mes = hoje.getMonth() - nasc.getMonth()
    if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) idade--
    return idade
  }

  const formatarData = (data) => {
    if (!data) return '—'
    return new Date(data).toLocaleDateString('pt-BR')
  }

  // ─── CARREGANDO / ERRO ───────────────────────────────────────────────────────
  if (carregando || erroCarga) {
    return (
      <div className="sv-app sv-pagina">
        <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
        <SidebarGlass ativo="abrigos" />
        <main className="sv-main">
          <header className="sv-topo">
            <div className="sv-topo-texto">
              <p className="sv-trilha"><a href="/abrigos">Abrigos</a> &gt; <span>Detalhes</span></p>
              <h1 className="sv-titulo">Detalhes do abrigo</h1>
            </div>
          </header>
          {carregando
            ? <Esqueleto forma="detalhe" />
            : <ErroPagina titulo="Não foi possível carregar o abrigo" mensagem={erroCarga} onTentar={carregarTudo} />}
        </main>
      </div>
    );
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div className="sv-app sv-pagina">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
      <SidebarGlass ativo="abrigos" />

      <main className="sv-main">

        <header className="sv-topo">
          <div className="sv-topo-texto">
            <p className="sv-trilha">
              Abrigos &gt; <span>{nomeAbrigo}</span>
            </p>
            <h1 className="sv-titulo">
              {editando ? 'Editar Abrigo' : 'Detalhes do Abrigo'}
            </h1>
            <p className="sv-subtitulo">Gerencia as informações deste abrigo</p>
          </div>
        </header>

        <form onSubmit={handleSalvar} className="sv-vidro sv-painel sv-form-duas">

          {/* ── COLUNA ESQUERDA ── */}
          <div className="sv-form-coluna">

            {editando && <AvisoObrigatorios />}

            <div className="sv-campo">
              <label htmlFor="status">Status{editando && <Obrigatorio />}</label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={`sv-entrada sv-estado ${status}`}
                disabled={!editando}
                style={!editando ? { opacity: 1, cursor: 'default', appearance: 'none', WebkitAppearance: 'none' } : {}}
              >
                <option value="ativo">Ativado</option>
                <option value="manutencao">Manutenção</option>
                <option value="desativado">Desativado</option>
              </select>
            </div>

            <div className="sv-campo">
              <label htmlFor="nome-abrigo"><LuBuilding2 /> Nome do Abrigo{editando && <Obrigatorio />}</label>
              {editando ? (
                <input id="nome-abrigo" value={nomeAbrigo} maxLength={LIMITES.nomeLocal} minLength={3} required
                  onChange={(e) => setNomeAbrigo(e.target.value)} />
              ) : (
                <p>{nomeAbrigo}</p>
              )}
            </div>

            <div className="sv-campo">
              <label htmlFor="cep-abrigo"><LuMapPinned /> CEP{editando && <Obrigatorio />}</label>
              {editando ? (
                <>
                  {/* Ao completar o CEP, preenche estado, cidade, bairro e rua (só números; o hífen é automático) */}
                  <input id="cep-abrigo" value={cep} inputMode="numeric" required
                    onChange={(e) => handleCep(mascaraCep(e.target.value))} placeholder={EXEMPLOS.cep} maxLength={LIMITES.cep} />
                  <MensagemFeedback feedback={feedbackCep} />
                </>
              ) : (
                <p>{cep || '—'}</p>
              )}
            </div>

            {/* Estado → Cidade → Bairro — no modo edição usa o seletor com as listas da API */}
            {editando ? (
              <SeletorLocalidade
                cidadeId={cidadeId}
                bairroId={bairroId}
                onChange={handleLocalidade}
              />
            ) : (
              <>
                <div className="sv-campo">
                  <label><LuMapPinned /> Estado</label>
                  <p>{estado || '—'}</p>
                </div>

                <div className="sv-campo">
                  <label><LuMapPinned /> Cidade</label>
                  <p>{cidade}</p>
                </div>

                <div className="sv-campo">
                  <label><LuMapPinned /> Bairro</label>
                  <p>{bairro || '—'}</p>
                </div>
              </>
            )}

            <div className="sv-campo">
              <label htmlFor="endereco-abrigo"><LuMapPin /> Endereço{editando && <Obrigatorio />}</label>
              {editando ? (
                <>
                  <input id="endereco-abrigo" value={endereco} maxLength={LIMITES.endereco} required
                    placeholder="Ex: Rua das Flores, 123" onChange={(e) => setEndereco(e.target.value)} />
                  <button
                    type="button"
                    onClick={handleGeocodificar}
                    className="sv-btn sv-btn--vidro sv-btn--p sv-btn--inicio"
                  >
                    <LuMapPinned />
                    {latitude && longitude ? 'Atualizar localização' : 'Buscar localização'}
                  </button>
                  {feedbackGeo?.tipo === 'existente'
                    ? <p style={{ fontSize: '12px', marginTop: '4px', color: 'var(--sv-azul)' }}>{feedbackGeo.mensagem}</p>
                    : <MensagemFeedback feedback={feedbackGeo} />}
                </>
              ) : (
                <>
                  <p>{endereco}</p>
                  {latitude && longitude ? (
                    feedbackGeo && (
                      <p style={{ fontSize: '12px', marginTop: '2px', color: 'var(--sv-azul)' }}>
                        {feedbackGeo.mensagem}
                      </p>
                    )
                  ) : (
                    // Sem coordenadas o abrigo não aparece no mapa — avisa e diz como resolver
                    <p style={{ fontSize: '12px', marginTop: '2px', color: 'var(--sv-atencao-forte)' }}>
                      <LuTriangleAlert /> Sem localização: este abrigo não aparece no mapa. Clique em "Editar Abrigo" e depois em "Buscar localização".
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="sv-campo">
              <label htmlFor="telefone-abrigo"><LuPhone /> Telefone{editando && <Obrigatorio />}</label>
              {editando ? (
                <input id="telefone-abrigo" type="tel" value={telefone} inputMode="numeric" placeholder={EXEMPLOS.telefone}
                  maxLength={LIMITES.telefone} required onChange={(e) => setTelefone(mascaraTelefone(e.target.value))} />
              ) : (
                <p>{telefone}</p>
              )}
            </div>

            <div className="sv-campo">
              <label htmlFor="responsavel-abrigo"><LuUser /> Responsável{editando && <Obrigatorio />}</label>
              {editando ? (
                <input id="responsavel-abrigo" value={responsavel} maxLength={LIMITES.nomePessoa} minLength={2} required
                  onChange={(e) => setResponsavel(somenteNome(e.target.value))} />
              ) : (
                <p>{responsavel}</p>
              )}
            </div>

            <div className="sv-campo">
              <label htmlFor="tipo-abrigo"><LuBuilding2 /> Tipo de Abrigo{editando && <Obrigatorio />}</label>
              {editando ? (
                <select id="tipo-abrigo" required value={tipoAbrigo} onChange={(e) => setTipoAbrigo(e.target.value)} className="sv-entrada">
                  <option value="Escola">Escola</option>
                  <option value="Ginásio">Ginásio</option>
                  <option value="Igreja">Igreja</option>
                  <option value="Hotel">Hotel</option>
                  <option value="Pousada">Pousada</option>
                  <option value="CentroCultural">Centro Cultural</option>
                  <option value="CentroComunitário">Centro Comunitário</option>
                  <option value="Campo">Campo</option>
                </select>
              ) : (
                <p>{tipoAbrigo}</p>
              )}
            </div>

            <div className="sv-campo">
              <label htmlFor="capacidade-total"><LuArrowLeftRight /> Capacidade Total{editando && <Obrigatorio />}</label>
              {editando ? (
                <input
                  type="text"
                  id="capacidade-total"
                  name="capacidadeTotal"
                  inputMode="numeric"
                  maxLength={LIMITES.capacidadeDigitos}
                  value={capacidadeTotal}
                  required
                  onChange={(e) => {
                    // Só números (o type="number" aceitava "e", "+" e "-")
                    const texto = somenteNumeros(e.target.value, LIMITES.capacidadeDigitos)
                    setCapacidadeTotal(texto === '' ? '' : Number(texto))
                    validarCapacidade(capacidadeOcupada, Number(texto) || 0)
                  }}
                />
              ) : (
                <p>{capacidadeTotal}</p>
              )}
            </div>

            <div className="sv-campo">
              <label htmlFor="capacidade-ocupada"><LuArrowLeftRight /> Capacidade Ocupada{editando && <Obrigatorio />}</label>
              {editando ? (
                <input
                  type="text"
                  id="capacidade-ocupada"
                  name="capacidadeOcupada"
                  inputMode="numeric"
                  maxLength={LIMITES.capacidadeDigitos}
                  value={capacidadeOcupada}
                  required
                  className={`sv-entrada ${erroCapacidade ? 'sv-entrada--erro' : ''}`}
                  onChange={(e) => {
                    const texto = somenteNumeros(e.target.value, LIMITES.capacidadeDigitos)
                    setCapacidadeOcupada(texto === '' ? '' : Number(texto))
                    validarCapacidade(Number(texto) || 0, capacidadeTotal)
                  }}
                />
              ) : (
                <p>{capacidadeOcupada}</p>
              )}
            </div>

            {erroCapacidade && (
              <p style={{ color: 'var(--sv-sirene)', fontSize: '13px', marginTop: '4px' }}>
                {erroCapacidade}
              </p>
            )}

            <div className="sv-form-secao">
              <h3 className="sv-secao-titulo">
                Infraestrutura
              </h3>

              <label className="sv-opcao" style={!editando ? { pointerEvents: 'none' } : {}}>
                <input type="checkbox" name="possuiAtendimentoMedico" checked={infraestrutura.possuiAtendimentoMedico} onChange={handleCheckboxChange} disabled={!editando} />
                <div className="sv-opcao-caixa"><LuBriefcaseMedical className="sv-opcao-icone" /><span>Atendimento Médico</span></div>
              </label>

              <label className="sv-opcao" style={!editando ? { pointerEvents: 'none' } : {}}>
                <input type="checkbox" name="possuiEnfermagem" checked={infraestrutura.possuiEnfermagem} onChange={handleCheckboxChange} disabled={!editando} />
                <div className="sv-opcao-caixa"><LuHeartPulse className="sv-opcao-icone" /><span>Enfermagem</span></div>
              </label>

              <label className="sv-opcao" style={!editando ? { pointerEvents: 'none' } : {}}>
                <input type="checkbox" name="possuiPets" checked={infraestrutura.possuiPets} onChange={handleCheckboxChange} disabled={!editando} />
                <div className="sv-opcao-caixa"><LuDog className="sv-opcao-icone" /><span>Pets Bem-Vindos</span></div>
              </label>

              <label className="sv-opcao" style={!editando ? { pointerEvents: 'none' } : {}}>
                <input type="checkbox" name="possuiAcessibilidade" checked={infraestrutura.possuiAcessibilidade} onChange={handleCheckboxChange} disabled={!editando} />
                <div className="sv-opcao-caixa"><LuAccessibility className="sv-opcao-icone" /><span>Acessibilidade</span></div>
              </label>

              <label className="sv-opcao" style={!editando ? { pointerEvents: 'none' } : {}}>
                <input type="checkbox" name="possuiCozinha" checked={infraestrutura.possuiCozinha} onChange={handleCheckboxChange} disabled={!editando} />
                <div className="sv-opcao-caixa"><LuUtensils className="sv-opcao-icone" /><span>Cozinha Comunitária</span></div>
              </label>
            </div>
          </div>

          {/* ── COLUNA DIREITA ── */}
          <div className="sv-form-coluna">

            <h3 className="sv-secao-titulo">
              Imagem do Abrigo
            </h3>

            <>
              {editando ? (
                <div className="sv-upload">
                  {fotoExibida ? (
                    <div className="sv-upload-previa">
                      <img src={fotoExibida} alt="Preview do abrigo" />
                      <button
                        type="button"
                        onClick={() => { setNovaFoto(false); setFotoUrl(null); }}
                        className="sv-btn sv-btn--perigo-vidro sv-btn--p"
                      >
                        Remover Foto
                      </button>
                    </div>
                  ) : (
                    <label className="sv-upload-area">
                      <input type="file" accept="image/jpeg,image/png" onChange={handleImagem} style={{ display: 'none' }} />
                      <LuUpload className="sv-upload-icone" />
                      <p>Faça upload da foto principal do abrigo (JPG ou PNG, até 2 MB)</p>
                      <span className="sv-btn sv-btn--vidro sv-btn--p">Selecionar arquivo do computador</span>
                    </label>
                  )}
                </div>
              ) : (
                <div className="sv-upload">
                  {fotoExibida ? (
                    <img src={fotoExibida} alt={nomeAbrigo} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 'var(--sv-raio-s)' }} />
                  ) : (
                    <p style={{ color: 'var(--sv-tinta-3)', fontSize: '14px' }}>Sem foto cadastrada</p>
                  )}
                </div>
              )}
            </>

            <div className="sv-form-acoes">
              {editando ? (
                <>
                  <button type="submit" className="sv-btn sv-btn--primario sv-btn--bloco">Salvar Alterações</button>
                  <div className="sv-form-acoes-par">
                    <button type="button" onClick={handleExcluir} className="sv-btn sv-btn--perigo-vidro sv-btn--bloco">Excluir Registro</button>
                    <button type="button" onClick={handleCancelExcluir} className="sv-btn sv-btn--discreto sv-btn--bloco">Cancelar edição</button>
                  </div>
                </>
              ) : null}
              {editando ? null : (
                <button type="button" onClick={handleEditar} className="sv-btn sv-btn--vidro sv-btn--bloco">
                  Editar Abrigo
                </button>
              )}
            </div>

            {/* ── Vítimas Recentes — só no modo visualização ── */}
            {!editando && (
              <div className="sv-pilha">

                <div className="sv-secao-linha">
                  <h3 className="sv-secao-titulo">
                    Vítimas Presentes
                  </h3>
                  <button
                    type="button"
                    className="sv-btn sv-btn--vidro sv-btn--p"
                    onClick={() => navigate(`/abrigos/${id}/vitimas`)}
                  >
                    Ver todas <LuChevronRight className="sv-seta" />
                  </button>
                </div>

                {vitimasRecentes.length > 0 ? (
                  <div className="sv-tabela-caixa">
                    <table className="sv-tabela sv-tabela--cards">
                      <thead>
                        <tr>
                          <th scope="col">Nome</th>
                          <th scope="col" className="sv-centro">Idade</th>
                          <th scope="col" className="sv-centro">Entrada</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vitimasRecentes.map((vitima) => (
                          <tr key={vitima.id_vitima}>
                            <td><strong>{vitima.nome}</strong></td>
                            <td data-rotulo="Idade" className="sv-centro">{calcularIdade(vitima.dataNascimento)}</td>
                            <td data-rotulo="Entrada" className="sv-centro">{formatarData(vitima.dataEntrada ?? vitima.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Vazio
                    icone={<LuUsers />}
                    titulo="Nenhuma vítima vinculada a este abrigo."
                    dica="As vítimas acolhidas aqui aparecem nesta lista. Para vincular, use “Ver todas”."
                  />
                )}

                {/* ── Solicitações de Ajuda ── */}
                <div className="sv-pilha">

                  <div className="sv-secao-linha">
                    <h3 className="sv-secao-titulo">
                      Solicitações de Ajuda
                    </h3>
                    <div className="sv-acoes">
                      <button
                        type="button"
                        className="sv-btn sv-btn--primario sv-btn--p"
                        onClick={() => navigate(`/abrigos/${id}/cadastrar-solicitacao-ajuda`)}
                      >
                        <LuPlus /> Nova Solicitação
                      </button>
                      <button
                        type="button"
                        className="sv-btn sv-btn--vidro sv-btn--p"
                        onClick={() => navigate(`/abrigos/${id}/solicitacoes-ajuda`)}
                      >
                        Ver todas <LuChevronRight className="sv-seta" />
                      </button>
                    </div>
                  </div>

                  {solicitacoesAjuda.length > 0 ? (
                    <div className="sv-lista">
                      {solicitacoesAjuda.map((s) => {
                        const badge = badgeAjuda[s.status] ?? { label: s.status, bg: 'var(--sv-fundo-suave)', cor: 'var(--sv-tinta-2)' }
                        return (
                          <div
                            key={s.id_solicitacao}
                            className="sv-linha sv-linha--clicavel"
                            role="link"
                            tabIndex={0}
                            onClick={() => navigate(`/visualizar-solicitacao-ajuda/${s.id_solicitacao}`)}
                            onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/visualizar-solicitacao-ajuda/${s.id_solicitacao}`) }}
                          >
                            {/* Ícone */}
                            <span className="sv-poco sv-poco--p sv-poco--aceso sv-poco--ciano">
                              <LuHandHeart />
                            </span>

                            {/* Título + categoria */}
                            <div className="sv-linha-info">
                              <p className="sv-linha-titulo">
                                {s.titulo}
                              </p>
                              <p className="sv-linha-meta">
                                {categoriaLabel[s.categoria] ?? s.categoria}
                              </p>
                            </div>

                            {/* Badge status */}
                            <span className="sv-tag sv-tag--lisa" style={{ background: badge.bg, color: badge.cor }}>
                              {badge.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <Vazio
                      icone={<LuHandHeart />}
                      titulo="Nenhuma solicitação de ajuda cadastrada."
                      dica="Crie uma quando o abrigo precisar de doações, medicamentos ou voluntários."
                    />
                  )}
                </div>
                {/* ── fim Solicitações de Ajuda ── */}

              </div>
            )}

          </div>
        </form>

        <footer className="sv-rodape">
          <p>© 2026 S.O.S Vale. Todos os direitos reservados.</p>
          <p>Versão 1.0.0</p>
        </footer>
      </main>
    </div>
  );
}

export default DetalhesAbrigo;