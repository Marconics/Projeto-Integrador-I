import './style.css'
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LuBell, LuCake, LuChevronRight, LuHandHeart, LuHeart, LuHouse, LuIdCard, LuMapPin, LuPhone, LuUserRound } from 'react-icons/lu';
import SidebarGlass from '../../components/SidebarGlass/SidebarGlass';
import '../../styles/sosvale-glass.css';
import { API_URL, formatarTempo } from '../../services/api';
import { Esqueleto, ErroPagina, Vazio } from '../../components/EstadosPagina';

// ─── Labels e cores de status/categoria/urgência ────────────────
// Mesmo padrão usado nas outras telas de Solicitação de Ajuda
const badgeStatus = {
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

// peso: ordena da mais urgente para a menos urgente
const URGENCIA = {
  critica: { label: 'Crítica', bg: 'var(--sv-sirene-suave)', cor: 'var(--sv-sirene-forte)', peso: 4 },
  alta:    { label: 'Alta',    bg: 'var(--sv-atencao-suave)', cor: 'var(--sv-atencao-forte)', peso: 3 },
  media:   { label: 'Média',   bg: 'var(--sv-atencao-suave)', cor: 'var(--sv-atencao-forte)', peso: 2 },
  baixa:   { label: 'Baixa',   bg: 'var(--sv-fundo-suave)', cor: 'var(--sv-tinta-2)', peso: 1 },
}

const MAXIMO_SOLICITACOES = 6
const MAXIMO_CONTRIBUICOES = 6

const PainelVoluntario = () => {
  const navigate = useNavigate();

  // ─── DADOS DO VOLUNTÁRIO LOGADO ──────────────────────────────
  // Recupera do localStorage o que foi salvo no login — mostra o nome na hora
  const voluntarioSalvo = JSON.parse(localStorage.getItem('voluntario') || '{}');

  // ─── ESTADOS ─────────────────────────────────────────────────
  const [voluntario,         setVoluntario]         = useState(voluntarioSalvo);
  const [solicitacoes,       setSolicitacoes]       = useState([]);
  const [minhasSolicitacoes, setMinhasSolicitacoes] = useState([]);
  const [carregando,         setCarregando]         = useState(true);
  const [erro,               setErro]               = useState(null);

  // Aba exibida: /painel-voluntario (home) ou /painel-voluntario?aba=perfil
  const [parametros] = useSearchParams();
  const aba = parametros.get('aba') === 'perfil' ? 'perfil' : 'home';

  // ─── TOKEN DO VOLUNTÁRIO ─────────────────────────────────────
  // Se não tiver token, redireciona para o login imediatamente
  const token = localStorage.getItem('token_voluntario');

  useEffect(() => {
    if (!token) {
      navigate('/login-voluntario');
      return;
    }
    buscarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── BUSCA DE DADOS ──────────────────────────────────────────
  // Em paralelo: solicitações de ajuda abertas + dados do voluntário
  async function buscarDados() {
    setCarregando(true);
    setErro(null);
    try {
      const [resSolicitacoes, resVoluntario] = await Promise.all([
        fetch(`${API_URL}/api/solicitacoes-ajuda/publico`),
        fetch(`${API_URL}/api/voluntarios/me`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (resVoluntario.status === 401) {
        navigate('/login-voluntario');
        return;
      }
      if (!resSolicitacoes.ok) throw new Error('Erro ao buscar solicitações de ajuda');
      if (!resVoluntario.ok)   throw new Error('Erro ao buscar dados do voluntário');

      const dadosSolicitacoes = await resSolicitacoes.json();
      const dadosVoluntario   = await resVoluntario.json();

      // Só as que ainda aceitam ajuda, as mais urgentes primeiro
      setSolicitacoes(
        dadosSolicitacoes.solicitacoes
          .filter(s => s.status === 'aberto')
          .sort((a, b) => (URGENCIA[b.urgencia]?.peso ?? 0) - (URGENCIA[a.urgencia]?.peso ?? 0))
      );
      setVoluntario(dadosVoluntario.voluntario);
      // Solicitações de ajuda que este voluntário atendeu (atribuídas pelo ADM)
      setMinhasSolicitacoes(dadosVoluntario.voluntario.solicitacoesAjudaAtendidas || []);

    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  // ─── DERIVAÇÕES ──────────────────────────────────────────────
  const totalSolicitacoes = minhasSolicitacoes.length;
  const emAndamento       = minhasSolicitacoes.filter(s => s.status === 'em_andamento').length;
  const concluidas        = minhasSolicitacoes.filter(s => s.status === 'concluido').length;
  const abrigoVinculado   = voluntario?.abrigo ?? null;
  const primeiroNome      = voluntario?.nome?.split(' ')[0] ?? 'Voluntário';
  const urgentes          = solicitacoes.filter(s => ['critica', 'alta'].includes(s.urgencia)).length;

  // "quinta-feira, 24 de setembro" → "Quinta-feira, 24 de setembro"
  const dataPorExtenso = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const hoje = dataPorExtenso.charAt(0).toUpperCase() + dataPorExtenso.slice(1);

  const statCards = [
    {
      id:     'solicitacoes',
      label:  'Solicitações de ajuda abertas',
      value:  solicitacoes.length,
      sub:    urgentes > 0 ? `${urgentes} com urgência alta ou crítica` : 'nenhuma urgente',
      icon:   <LuHandHeart />,
      accent: 'red',
      acao:   () => navigate('/solicitacoes-ajuda-voluntario'),
    },
    {
      id:     'contribuicoes',
      label:  'Minhas contribuições',
      value:  totalSolicitacoes,
      sub:    `${concluidas} concluída${concluidas !== 1 ? 's' : ''} · ${emAndamento} em andamento`,
      icon:   <LuHeart />,
      accent: 'cyan',
    },
    {
      id:     'vinculo',
      label:  'Meu abrigo',
      value:  abrigoVinculado ? abrigoVinculado.nome : 'Nenhum',
      sub:    abrigoVinculado ? `${abrigoVinculado.cidade} · trocar de abrigo` : 'clique para escolher um abrigo',
      icon:   <LuMapPin />,
      accent: abrigoVinculado ? 'blue' : 'teal',
      texto:  true, // valor em texto: fonte menor
      acao:   () => navigate('/voluntario/abrigos'),
    },
  ];

  // ─── TELA DE CARREGANDO / ERRO ───────────────────────────────
  if (carregando || erro) {
    return (
      <div className="sv-app sv-pagina">
        <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>
        <SidebarGlass modulo="voluntario" ativo={aba} />
        <main className="sv-main home-vol">
          {carregando
            ? <Esqueleto forma="lista" />
            : <ErroPagina
                titulo="Não foi possível carregar o seu painel"
                mensagem={`${erro}. Verifique a conexão e tente novamente.`}
                onTentar={buscarDados}
              />}
        </main>
      </div>
    );
  }

  return (
    <div className="sv-app sv-pagina">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>

      {/* ── SIDEBAR ── */}
      <SidebarGlass modulo="voluntario" ativo={aba} />

      {/* ── MAIN ── */}
      <main className="sv-main home-vol">

        {/* ── CABEÇALHO ── */}
        <header className="hv-topo">
          <div>
            <p className="hv-breadcrumb">
              Home{aba === 'perfil' && <> &gt; <span>Meu perfil</span></>}
            </p>
            <h1 className="sv-titulo">
              {aba === 'perfil' ? 'Meu perfil' : <>Olá, {primeiroNome}</>}
            </h1>
            <p className="hv-subtitulo">
              {aba === 'perfil' ? 'Seus dados de cadastro' : <>Veja onde você pode ajudar hoje · {hoje}</>}
            </p>
          </div>

          <div className="hv-topo-acoes">
            {/* Sino com as solicitações em andamento */}
            <button
              className="hv-sino"
              title="Solicitações em andamento"
              onClick={() => navigate('/solicitacoes-ajuda-voluntario')}
            >
              <LuBell />
              {emAndamento > 0 && <span className="hv-sino-badge">{emAndamento}</span>}
            </button>
            <button className="hv-botao-primario" onClick={() => navigate('/solicitacoes-ajuda-voluntario')}>
              <LuHandHeart /> Quero ajudar
            </button>
          </div>
        </header>

        {aba === 'perfil' ? (

          /* ── ABA MEU PERFIL ── */
          <section className="hv-painel hv-perfil">
            <div className="hv-perfil-topo">
              <div className="hv-avatar">{primeiroNome.charAt(0).toUpperCase()}</div>
              <div className="hv-perfil-nome">
                <h2>{voluntario?.nome}</h2>
                <p>{voluntario?.email}</p>
              </div>
              <span className={`hv-status ${voluntario?.status === 'ativo' ? 'hv-status--ativo' : ''}`}>
                {voluntario?.status === 'ativo' ? 'Ativo' : (voluntario?.status ?? '—')}
              </span>
            </div>

            <dl className="hv-perfil-campos">
              {[
                { icone: <LuPhone />,     rotulo: 'Telefone',        valor: voluntario?.telefone },
                { icone: <LuIdCard />,       rotulo: 'CPF',             valor: voluntario?.cpf },
                { icone: <LuCake />, rotulo: 'Data de nascimento',
                  valor: voluntario?.dataNascimento
                    // A data vem como "2000-01-31T00:00:00.000Z" — UTC evita mostrar o dia anterior
                    ? new Date(voluntario.dataNascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                    : null },
                { icone: <LuUserRound />,    rotulo: 'Gênero',
                  valor: voluntario?.genero ? voluntario.genero.charAt(0).toUpperCase() + voluntario.genero.slice(1) : null },
                { icone: <LuMapPin />,  rotulo: 'Abrigo vinculado',
                  valor: abrigoVinculado ? `${abrigoVinculado.nome} — ${abrigoVinculado.cidade}` : 'Sem abrigo vinculado' },
                { icone: <LuHeart />,        rotulo: 'Solicitações atendidas',
                  valor: `${totalSolicitacoes} (${concluidas} concluída${concluidas !== 1 ? 's' : ''})` },
              ].map(campo => (
                <div className="hv-campo" key={campo.rotulo}>
                  <dt>{campo.icone} {campo.rotulo}</dt>
                  <dd>{campo.valor || '—'}</dd>
                </div>
              ))}
            </dl>
          </section>

        ) : (
        <>
        {/* ── CARDS DE RESUMO ── */}
        <section className="hv-cards">
          {statCards.map(card => {
            const Tag = card.acao ? 'button' : 'div';
            return (
              <Tag
                key={card.id}
                className={`hv-card hv-card--${card.accent}${card.acao ? ' hv-card--clicavel' : ''}`}
                onClick={card.acao}
                type={card.acao ? 'button' : undefined}
              >
                <div className="hv-card-cabecalho">
                  <span className="hv-card-rotulo">{card.label}</span>
                  <span className="hv-card-icone">{card.icon}</span>
                </div>
                <div className={`hv-card-valor${card.texto ? ' hv-card-valor--texto' : ''}`} title={card.texto ? String(card.value) : undefined}>
                  {card.value}
                </div>
                <div className="hv-card-sub">{card.sub}</div>
              </Tag>
            );
          })}
        </section>

        {/* ── CONTEÚDO PRINCIPAL ── */}
        <section className="hv-grade">

          {/* ── COLUNA PRINCIPAL ── */}
          <div className="hv-coluna">

            {/* ── SOLICITAÇÕES DE AJUDA ABERTAS ── */}
            <div className="hv-painel">
              <div className="hv-painel-cabecalho">
                <div>
                  <h3>Solicitações de ajuda</h3>
                  <p>O que os abrigos estão precisando agora — as mais urgentes primeiro</p>
                </div>
                <button className="hv-link" onClick={() => navigate('/solicitacoes-ajuda-voluntario')}>
                  Ver todas <LuChevronRight />
                </button>
              </div>

              {solicitacoes.length === 0 ? (
                <Vazio
                  icone={<LuHandHeart />}
                  titulo="Nenhuma solicitação de ajuda aberta no momento."
                  dica="Quando um abrigo precisar de ajuda, o pedido aparece aqui."
                />
              ) : (
                <ul className="hv-solicitacoes">
                  {solicitacoes.slice(0, MAXIMO_SOLICITACOES).map(s => {
                    const urgencia = URGENCIA[s.urgencia] ?? URGENCIA.baixa;
                    return (
                      <li key={s.id_solicitacao} className="hv-solicitacao" style={{ '--cor-urgencia': urgencia.cor }}>
                        <div className="hv-solicitacao-info">
                          <p className="hv-solicitacao-titulo" title={s.titulo}>{s.titulo}</p>
                          <p className="hv-solicitacao-meta">
                            {categoriaLabel[s.categoria] ?? s.categoria}
                            {' · '}<LuHouse /> {s.abrigo?.nome ?? 'Abrigo'}{s.abrigo?.cidade ? ` — ${s.abrigo.cidade}` : ''}
                            {s.createdAt && <> · {formatarTempo(s.createdAt)}</>}
                          </p>
                        </div>
                        <span className="hv-badge" style={{ background: urgencia.bg, color: urgencia.cor }}>
                          {urgencia.label}
                        </span>
                        <button
                          className="hv-botao-ajudar"
                          onClick={() => navigate(`/solicitacoes-ajuda-voluntario?abrigo=${s.abrigoId}`)}
                        >
                          Quero ajudar
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {solicitacoes.length > MAXIMO_SOLICITACOES && (
                <button className="hv-link hv-link--centro" onClick={() => navigate('/solicitacoes-ajuda-voluntario')}>
                  Ver as outras {solicitacoes.length - MAXIMO_SOLICITACOES} solicitações <LuChevronRight />
                </button>
              )}
            </div>

          </div>

          {/* ── COLUNA LATERAL: MINHAS ÚLTIMAS CONTRIBUIÇÕES ── */}
          <div className="hv-lateral">
            <div className="hv-painel">
              <div className="hv-painel-cabecalho">
                <div>
                  <h3>Minhas últimas contribuições</h3>
                  <p>Solicitações que você atendeu</p>
                </div>
              </div>

              {minhasSolicitacoes.length === 0 ? (
                <div className="hv-vazio">
                  <p>Você ainda não atendeu nenhuma solicitação.</p>
                  <button className="hv-link hv-link--centro" onClick={() => navigate('/solicitacoes-ajuda-voluntario')}>
                    Ver onde ajudar <LuChevronRight />
                  </button>
                </div>
              ) : (
                <ul className="hv-contribuicoes">
                  {minhasSolicitacoes.slice(0, MAXIMO_CONTRIBUICOES).map((solicitacao, index) => {
                    const badge = badgeStatus[solicitacao.status] ?? { label: solicitacao.status, bg: 'var(--sv-fundo-suave)', cor: 'var(--sv-tinta-2)' };
                    return (
                      <li key={solicitacao.id_solicitacao ?? index} className="hv-contribuicao">
                        <div className="hv-contribuicao-info">
                          <p className="hv-contribuicao-titulo" title={solicitacao.titulo}>{solicitacao.titulo}</p>
                          <p className="hv-contribuicao-meta">
                            {categoriaLabel[solicitacao.categoria] ?? solicitacao.categoria}
                            {solicitacao.abrigo?.nome && <> · {solicitacao.abrigo.nome}</>}
                            {solicitacao.createdAt && <> · {formatarTempo(solicitacao.createdAt)}</>}
                          </p>
                        </div>
                        <span className="hv-badge" style={{ background: badge.bg, color: badge.cor }}>
                          {badge.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              {minhasSolicitacoes.length > MAXIMO_CONTRIBUICOES && (
                <p className="hv-mais">+ {minhasSolicitacoes.length - MAXIMO_CONTRIBUICOES} contribuição(ões) anteriores</p>
              )}
            </div>
          </div>
        </section>
        </>
        )}

        <footer className="hv-rodape">
          <p>© 2026 S.O.S Vale. Todos os direitos reservados.</p>
          <p>Versão 1.0.0</p>
        </footer>
      </main>
    </div>
  );
}

export default PainelVoluntario;
