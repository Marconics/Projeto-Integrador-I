// --------- Imports -----------
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import { LuAccessibility, LuArrowLeftRight, LuBriefcaseMedical, LuBuilding2, LuDog, LuHeartPulse, LuIdCard, LuMail, LuMapPin, LuMapPinned, LuNavigation, LuPhone, LuUser, LuUtensils } from 'react-icons/lu';
import SidebarGlass from '../../../components/SidebarGlass/SidebarGlass';
import '../../../styles/sosvale-glass.css';
import { fetchAdmin } from '../../../services/api';
import { LIMITES } from '../../../utils/campos';
import { Obrigatorio, ContadorCaracteres } from '../../../components/MarcasCampo';

function DetalhesSolicitacao() {

  // ─── ESTADOS ────────────────────────────────────────────────
  const { id } = useParams();
  const navigate = useNavigate();

  // Backup dos dados originais (igual ao dadosAbrigo no DetalhesAbrigo)
  const [dadosSolicitacao, setDadosSolicitacao] = useState({})

  // Tela de loading
  const [carregando, setCarregando] = useState(true);

  // Campos da solicitação — espelha os campos do modelo
  const [nomeSolicitacao, setNomeSolicitacao] = useState('');
  const [cep, setCep] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [bairro, setBairro] = useState('');
  const [telefone, setTelefone] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [tipoAbrigo, setTipoAbrigo] = useState('');
  const [capacidadeTotal, setCapacidadeTotal] = useState(0);
  const [status, setStatus] = useState('pendente');
  const [motivoRecusa, setMotivoRecusa] = useState('');

  // Coordenadas — vindas do geocoding feito no cadastro
  // Só leitura aqui, exibidas como informação para o admin
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);

  // Dados do solicitante (quem pediu)
  const [solicitanteNome, setSolicitanteNome] = useState('');
  const [solicitanteEmail, setSolicitanteEmail] = useState('');
  const [solicitanteTelefone, setSolicitanteTelefone] = useState('');

  // Foto
  const [fotoUrl, setFotoUrl] = useState(null);

  // Infraestrutura (igual ao DetalhesAbrigo)
  const [infraestrutura, setInfraestrutura] = useState({
    possuiAtendimentoMedico: false,
    possuiEnfermagem: false,
    possuiPets: false,
    possuiAcessibilidade: false,
    possuiCozinha: false
  });

  // Controla qual painel de decisão está aberto: null | 'aprovar' | 'recusar'
  // Só abre o painel quando o admin clica, para não poluir a tela
  const [painelDecisao, setPainelDecisao] = useState(null);


  // ─── BUSCA DOS DADOS ────────────────────────────────────────
  // Mesma lógica do DetalhesAbrigo: roda uma vez quando o :id da URL aparece
  useEffect(() => {
    const buscarSolicitacao = async () => {
      try {
        const resposta = await fetchAdmin(`/solicitacoes/listar/${id}`)
        const dados = await resposta.json()

        // Guarda backup para o cancelar (igual ao DetalhesAbrigo)
        setDadosSolicitacao(dados)

        // Preenche os estados com o que veio da API
        setNomeSolicitacao(dados.nome ?? '')
        setCep(dados.cep ?? '')
        setEndereco(dados.endereco ?? '')
        setCidade(dados.cidade ?? '')
        setEstado(dados.estado ?? '')
        setBairro(dados.bairro ?? '')
        setTelefone(dados.telefone ?? '')
        setResponsavel(dados.responsavel ?? '')
        setTipoAbrigo(dados.tipoAbrigo ?? '')
        setCapacidadeTotal(dados.capacidadeTotal ?? 0)
        setStatus(dados.status ?? 'pendente')
        setMotivoRecusa(dados.motivoRecusa ?? '')
        setSolicitanteNome(dados.solicitanteNome ?? '')
        setSolicitanteEmail(dados.solicitanteEmail ?? '')
        setSolicitanteTelefone(dados.solicitanteTelefone ?? '')
        setFotoUrl(dados.fotoAbrigo ? dados.fotoAbrigo + '?t=' + Date.now() : null)

        // Carrega as coordenadas se existirem
        setLatitude(dados.latitude ?? null)
        setLongitude(dados.longitude ?? null)

        setInfraestrutura({
          possuiAtendimentoMedico: dados.possuiAtendimentoMedico ?? false,
          possuiEnfermagem:        dados.possuiEnfermagem        ?? false,
          possuiPets:              dados.possuiPets              ?? false,
          possuiAcessibilidade:    dados.possuiAcessibilidade    ?? false,
          possuiCozinha:           dados.possuiCozinha           ?? false
        })

      } catch (erro) {
        console.error('Erro ao buscar solicitação:', erro)
      } finally {
        setCarregando(false)
      }
    }

    buscarSolicitacao()
  }, [id])


  // ─── HANDLERS ───────────────────────────────────────────────

  // Aprovar: chama a rota /analisar com status "aprovado"
  // Quando aprovado, a API cria o Abrigo automaticamente e vincula o abrigo_id
  const handleAprovar = async () => {
    if (!confirm('Confirmar aprovação desta solicitação? Um abrigo será criado automaticamente.')) return

    try {
      const resposta = await fetchAdmin(`/solicitacoes/analisar/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // Quem aprovou vem do token do admin logado (antes era "adminId: 1" fixo)
        body: JSON.stringify({ status: 'aprovado' })
      })

      const dados = await resposta.json()

      if (!resposta.ok) {
        alert(dados.mensagem)
        return
      }

      // Atualiza o status na tela sem precisar recarregar
      setStatus('aprovado')
      setDadosSolicitacao(prev => ({ ...prev, status: 'aprovado' }))
      setPainelDecisao(null)
      alert(`Solicitação aprovada! Abrigo criado com ID ${dados.abrigoCriado.id_abrigo}.`)

    } catch (erro) {
      console.error('Erro ao aprovar:', erro)
    }
  }

  // Recusar: chama a rota /analisar com status "recusado" + motivoRecusa obrigatório
  const handleRecusar = async () => {
    if (!motivoRecusa.trim()) {
      alert('Informe o motivo da recusa antes de continuar.')
      return
    }

    if (!confirm('Confirmar recusa desta solicitação?')) return

    try {
      const resposta = await fetchAdmin(`/solicitacoes/analisar/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // Quem recusou vem do token do admin logado (antes era "adminId: 1" fixo)
        body: JSON.stringify({ status: 'recusado', motivoRecusa })
      })

      const dados = await resposta.json()

      if (!resposta.ok) {
        alert(dados.mensagem)
        return
      }

      setStatus('recusado')
      setDadosSolicitacao(prev => ({ ...prev, status: 'recusado', motivoRecusa }))
      setPainelDecisao(null)
      alert('Solicitação recusada.')

    } catch (erro) {
      console.error('Erro ao recusar:', erro)
    }
  }

  // Excluir a solicitação (só disponível se já foi analisada)
  const handleExcluir = async () => {
    if (!confirm('Tem certeza que deseja excluir esta solicitação?')) return

    try {
      const resposta = await fetchAdmin(`/solicitacoes/excluir/${id}`, { method: 'DELETE' })
      // Só sai da tela se a API excluiu de verdade
      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => ({}))
        alert(dados.mensagem ?? 'Não foi possível excluir a solicitação.')
        return
      }
      navigate('../listar-solicitação-abrigo')
    } catch (erro) {
      console.error('Erro ao excluir:', erro)
    }
  }

  // Badge colorido do status — igual ao padrão visual do projeto
  const badgeStatus = {
    pendente:  { label: 'Pendente',  cor: 'var(--sv-atencao)' },
    aprovado:  { label: 'Aprovado',  cor: 'var(--sv-ok)' },
    recusado:  { label: 'Recusado',  cor: 'var(--sv-sirene)' },
  }[status] ?? { label: status, cor: 'var(--sv-tinta-3)' }


  // ─── TELA DE LOADING ────────────────────────────────────────
  if (carregando) {
    return (
      <div className="sv-app sv-pagina">
        <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
        <SidebarGlass ativo="solicitacoes-abrigo" />
        <main className="sv-main">
          <p className="sv-vazio">Carregando dados da solicitação...</p>
        </main>
      </div>
    )
  }


  // ─── TELA PRINCIPAL ─────────────────────────────────────────
  return (
    <div className="sv-app sv-pagina">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
      <SidebarGlass ativo="solicitacoes-abrigo" />

      <main className="sv-main">
        <header className="sv-topo">
          <div className="sv-topo-texto">
            <p className="sv-trilha">
              Solicitações &gt; <span>{nomeSolicitacao}</span>
            </p>
            <h1 className="sv-titulo">
              Detalhes da Solicitação
            </h1>
            <p className="sv-subtitulo">Analise e tome uma decisão sobre este pedido</p>
          </div>

          {/* Badge de status no canto direito do header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              background: badgeStatus.cor,
              color: '#fff',
              padding: '6px 16px',
              borderRadius: 'var(--sv-raio-xs)',
              fontWeight: '600',
              fontSize: '14px'
            }}>
              {badgeStatus.label}
            </span>
          </div>
        </header>

        {/* Tudo aqui é só leitura — diferente do DetalhesAbrigo, não tem modo edição
            O admin não edita a solicitação, apenas aprova ou recusa */}
        <div className="sv-vidro sv-painel sv-form-duas">

          {/* ── COLUNA ESQUERDA ── */}
          <div className="sv-form-coluna">

            {/* Dados do Abrigo Proposto */}
            <h3 className="sv-secao-titulo">
              Dados do Abrigo Proposto
            </h3>

            <div className="sv-campo">
              <label><LuBuilding2 /> Nome do Abrigo</label>
              <p>{nomeSolicitacao}</p>
            </div>

            {/* CEP separado — igual ao padrão do DetalhesAbrigo */}
            <div className="sv-campo">
              <label><LuMapPinned /> CEP</label>
              <p>{cep || '—'}</p>
            </div>

            {/* Estado separado */}
            <div className="sv-campo">
              <label><LuMapPinned /> Estado</label>
              <p>{estado || '—'}</p>
            </div>

            {/* Cidade separada */}
            <div className="sv-campo">
              <label><LuMapPinned /> Cidade</label>
              <p>{cidade || '—'}</p>
            </div>

            {/* Bairro separado */}
            <div className="sv-campo">
              <label><LuMapPinned /> Bairro</label>
              <p>{bairro || '—'}</p>
            </div>

            {/* Endereço + coordenadas juntos na mesma seção */}
            <div className="sv-campo">
              <label><LuMapPin /> Endereço</label>
              <p>{endereco || '—'}</p>

              {/*
                Exibe as coordenadas se o solicitante as gerou durante o cadastro.
                Aqui é só informativo para o admin — ajuda a validar se o local é real.
                A mesma cor azul (var(--sv-azul)) usada no DetalhesAbrigo para "existente".
              */}
              {latitude && longitude ? (
                <p style={{
                  fontSize: '12px',
                  marginTop: '4px',
                  color: 'var(--sv-azul)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <LuNavigation />
                  Localização mapeada: ({Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)})
                </p>
              ) : (
                <p style={{ fontSize: '12px', marginTop: '4px', color: 'var(--sv-tinta-3)' }}>
                  Sem localização mapeada
                </p>
              )}
            </div>

            <div className="sv-campo">
              <label><LuPhone /> Telefone</label>
              <p>{telefone || '—'}</p>
            </div>

            <div className="sv-campo">
              <label><LuUser /> Responsável</label>
              <p>{responsavel}</p>
            </div>

            <div className="sv-campo">
              <label><LuBuilding2 /> Tipo de Abrigo</label>
              <p>{tipoAbrigo}</p>
            </div>

            <div className="sv-campo">
              <label><LuArrowLeftRight /> Capacidade Total</label>
              <p>{capacidadeTotal} pessoas</p>
            </div>

            {/* Infraestrutura — só leitura, checkboxes desabilitados */}
            <div className="sv-form-secao">
              <h3 className="sv-secao-titulo">
                Infraestrutura
              </h3>

              {[
                { name: 'possuiAtendimentoMedico', label: 'Atendimento Médico',  icon: <LuBriefcaseMedical />    },
                { name: 'possuiEnfermagem',        label: 'Enfermagem',          icon: <LuHeartPulse /> },
                { name: 'possuiPets',              label: 'Pets Bem-Vindos',     icon: <LuDog />       },
                { name: 'possuiAcessibilidade',    label: 'Acessibilidade',      icon: <LuAccessibility />},
                { name: 'possuiCozinha',           label: 'Cozinha Comunitária', icon: <LuUtensils />  },
              ].map(item => (
                <label key={item.name} className="sv-opcao" style={{ pointerEvents: 'none' }}>
                  <input type="checkbox" checked={infraestrutura[item.name]} readOnly />
                  <div className="sv-opcao-caixa">
                    {item.icon}<span>{item.label}</span>
                  </div>
                </label>
              ))}
            </div>

            {/* Dados do Solicitante — seção exclusiva desta tela */}
            <h3 className="sv-secao-titulo" style={{ marginTop: '24px' }}>
              Dados do Solicitante
            </h3>

            <div className="sv-campo">
              <label><LuIdCard /> Nome</label>
              <p>{solicitanteNome}</p>
            </div>

            <div className="sv-campo">
              <label><LuMail /> E-mail</label>
              <p>{solicitanteEmail}</p>
            </div>

            <div className="sv-campo">
              <label><LuPhone /> Telefone</label>
              <p>{solicitanteTelefone || '—'}</p>
            </div>

            {/* Motivo da recusa — aparece só se já foi recusado */}
            {status === 'recusado' && dadosSolicitacao.motivoRecusa && (
              <div className="sv-campo" style={{ marginTop: '16px' }}>
                <label style={{ color: 'var(--sv-sirene)' }}>Motivo da Recusa</label>
                <p style={{ color: 'var(--sv-sirene)' }}>{dadosSolicitacao.motivoRecusa}</p>
              </div>
            )}

          </div>

          {/* ── COLUNA DIREITA ── */}
          <div className="sv-form-coluna">

            <h3 className="sv-secao-titulo">
              Imagem do Abrigo
            </h3>

            {/* Foto — só visualização, sem upload */}
            <div className="sv-upload">
              {fotoUrl ? (
                <img src={fotoUrl} alt={nomeSolicitacao} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 'var(--sv-raio-s)' }} />
              ) : (
                <p style={{ color: 'var(--sv-tinta-3)', fontSize: '14px' }}>Sem foto cadastrada</p>
              )}
            </div>

            {/* ── PAINEL DE DECISÃO ──
                Só aparece se a solicitação ainda está pendente.
                Quando o admin clica em Aprovar ou Recusar, abre o painel correspondente.
                Isso evita ações acidentais — o admin precisa confirmar antes. */}
            {status === 'pendente' && (
              <div className="sv-form-acoes" style={{ marginTop: '24px' }}>

                {/* Nenhum painel aberto: mostra os dois botões */}
                {painelDecisao === null && (
                  <>
                    <button
                      type="button"
                      className="sv-btn sv-btn--primario sv-btn--bloco"
                      onClick={() => setPainelDecisao('aprovar')}
                    >
                      Aprovar Solicitação
                    </button>
                    <button
                      type="button"
                      className="sv-btn sv-btn--perigo-vidro sv-btn--bloco"
                      onClick={() => setPainelDecisao('recusar')}
                    >
                      Recusar Solicitação
                    </button>
                  </>
                )}

                {/* Painel de aprovação aberto */}
                {painelDecisao === 'aprovar' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <p style={{ fontSize: '14px', color: 'var(--sv-tinta)' }}>
                      Ao aprovar, um abrigo será criado automaticamente com estes dados.
                      {latitude && longitude && (
                        <span style={{ display: 'block', marginTop: '6px', color: 'var(--sv-azul)', fontSize: '12px' }}>
                          <LuNavigation style={{ marginRight: '4px' }} />
                          O abrigo já terá localização no mapa.
                        </span>
                      )}
                    </p>
                    <button type="button" className="sv-btn sv-btn--primario sv-btn--bloco" onClick={handleAprovar}>
                      Confirmar Aprovação
                    </button>
                    <button type="button" className="sv-btn sv-btn--vidro sv-btn--bloco" onClick={() => setPainelDecisao(null)}>
                      Voltar
                    </button>
                  </div>
                )}

                {/* Painel de recusa aberto — exige motivo antes de confirmar */}
                {painelDecisao === 'recusar' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label htmlFor="motivo-recusa" style={{ fontSize: '14px', fontWeight: '600', color: 'var(--sv-tinta)' }}>
                      Motivo da recusa<Obrigatorio />
                    </label>
                    <textarea
                      id="motivo-recusa"
                      maxLength={LIMITES.observacao}
                      value={motivoRecusa}
                      onChange={(e) => setMotivoRecusa(e.target.value)}
                      placeholder="Descreva o motivo..."
                      rows={4}
                      style={{
                        borderRadius: 'var(--sv-raio-s)', border: '1px solid var(--sv-linha)',
                        padding: '10px', fontSize: '14px', resize: 'vertical'
                      }}
                    />
                    <ContadorCaracteres valor={motivoRecusa} limite={LIMITES.observacao} />
                    <button type="button" className="sv-btn sv-btn--perigo-vidro sv-btn--bloco" onClick={handleRecusar}>
                      Confirmar Recusa
                    </button>
                    <button type="button" className="sv-btn sv-btn--vidro sv-btn--bloco" onClick={() => setPainelDecisao(null)}>
                      Voltar
                    </button>
                  </div>
                )}

              </div>
            )}

            {/* Se já foi analisada, mostra só o botão de excluir */}
            {status !== 'pendente' && (
              <div className="sv-form-acoes" style={{ marginTop: '24px' }}>
                <button type="button" className="sv-btn sv-btn--perigo-vidro sv-btn--bloco" onClick={handleExcluir}>
                  Excluir Solicitação
                </button>
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

export default DetalhesSolicitacao;