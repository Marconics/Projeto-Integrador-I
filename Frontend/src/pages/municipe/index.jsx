import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  LuHouse, LuSiren, LuHandHeart, LuMessageCircle, LuArrowRight, LuMapPin,
  LuGraduationCap, LuUsers, LuSmartphone, LuCheckCheck, LuPhone, LuTriangleAlert,
} from 'react-icons/lu';
import logoSosVale from '../../assets/logo-sosvale.png';
import { formatarTelefone } from '../../services/api';
import '../../styles/sosvale-glass.css';
import './style.css';

// Site do munícipe: página pública e só informativa sobre o projeto e o bot
// de WhatsApp. Não chama a API e não tem formulário.

// ════════════════════════════════════════════════════════════════════
// ⚠️  NÚMERO DO BOT — TROCAR ANTES DE DIVULGAR O SITE
// Coloque aqui o número do WhatsApp do bot, só dígitos, com 55 e DDD
// (ex: '5512999999999'). Enquanto estiver NUMERO_DO_BOT, o botão
// "Falar com o bot" leva para um link inválido e o número não aparece na tela.
// ════════════════════════════════════════════════════════════════════
const NUMERO_DO_BOT = 'NUMERO_DO_BOT';

const LINK_BOT = `https://wa.me/${NUMERO_DO_BOT}`;
const numeroValido = /^55\d{10,11}$/.test(NUMERO_DO_BOT);

// O que o S.O.S Vale organiza (cards da seção "Sobre o projeto")
const frentes = [
  {
    icone: <LuHouse />,
    tom: 'azul',
    titulo: 'Abrigos',
    texto: 'Vagas, estrutura (atendimento médico, pets, acessibilidade, cozinha) e o que cada abrigo está precisando, tudo organizado em um só lugar.',
  },
  {
    icone: <LuSiren />,
    tom: 'forte',
    titulo: 'Alertas',
    texto: (
      <>
        Os próprios moradores avisam o que está acontecendo. O alerta só é enviado quando{' '}
        <strong className="mu-destaque">3 pessoas diferentes</strong> confirmam a mesma
        ocorrência no mesmo bairro. Assim, boato não vira alarme.
      </>
    ),
  },
  {
    icone: <LuHandHeart />,
    tom: 'ciano',
    titulo: 'Voluntários',
    texto: 'Quem quer ajudar sabe onde e como: cada abrigo mostra os pedidos de ajuda que estão abertos.',
  },
];

// Menu do bot, igual ao de ChatBot/controllers/menu.js (sem os emojis)
const menuBot = [
  'Alertas do meu bairro',
  'Solicitar apoio',
  'Abrigos disponíveis',
  'Apoio psicológico',
  'Alertas ativos agora',
  'Telefones de emergência',
  'Indicar um local para abrigo',
  'Encerrar atendimento',
];

const passos = [
  { titulo: 'Abra o WhatsApp', texto: 'Não precisa instalar nada nem criar conta.' },
  { titulo: 'Mande "oi" para o bot', texto: 'O menu aparece na hora.' },
  { titulo: 'Escolha um número', texto: 'Responda com o número da opção que você precisa.' },
];

const destaquesBot = [
  {
    icone: <LuMapPin />,
    titulo: 'Alertas do seu bairro',
    texto: 'Na opção 1 você se inscreve para receber os avisos do seu bairro e pode relatar uma ocorrência (alagamento, deslizamento e outras).',
  },
  {
    icone: <LuUsers />,
    titulo: 'Grupo da sua cidade',
    texto: 'Cada cidade também tem um grupo de WhatsApp que recebe os alertas. O bot envia o link para você entrar.',
  },
  {
    icone: <LuHouse />,
    titulo: 'Abrigos e apoio',
    texto: 'Veja os abrigos com vaga, peça apoio, fale sobre apoio psicológico ou indique um local que pode virar abrigo.',
  },
];

const Municipe = () => {
  // Título da aba do navegador enquanto a página estiver aberta
  useEffect(() => {
    const anterior = document.title;
    document.title = 'S.O.S Vale · Para o morador';
    return () => { document.title = anterior; };
  }, []);

  return (
    <div className="sv-app mu">
      <div className="mu-fundo" aria-hidden="true"><span /><span /><span /></div>

      {/* Cabeçalho fixo e translúcido */}
      <header className="mu-cabecalho mu-vidro">
        <a className="mu-marca" href="#inicio" aria-label="S.O.S Vale, voltar ao início">
          <img src={logoSosVale} alt="" />
          <span>S.O.S Vale</span>
        </a>
        <nav className="mu-nav" aria-label="Seções da página">
          <a href="#sobre">O projeto</a>
          <a href="#bot">Bot no WhatsApp</a>
        </nav>
        <a className="sv-btn sv-btn--primario mu-cabecalho-btn" href={LINK_BOT} target="_blank" rel="noopener noreferrer" aria-label="Falar com o bot no WhatsApp">
          <LuMessageCircle aria-hidden="true" /> <span>Falar com o bot</span>
        </a>
      </header>

      <main className="mu-conteudo">
        {/* 1. Topo */}
        <section className="mu-hero" id="inicio">
          <span className="mu-sobretitulo"><LuMapPin aria-hidden="true" /> Vale do Paraíba</span>
          <h1 className="mu-titulo">S.O.S Vale</h1>
          <p className="mu-lead">
            Organizamos a comunicação entre a gestão, os voluntários e os moradores sobre
            abrigos e alertas de enchentes e deslizamentos em Taubaté, Caçapava e Pindamonhangaba.
          </p>
          <ul className="mu-cidades" aria-label="Cidades atendidas">
            <li>Taubaté</li>
            <li>Caçapava</li>
            <li>Pindamonhangaba</li>
          </ul>
          <div className="mu-acoes">
            <a className="sv-btn sv-btn--primario mu-btn-g" href={LINK_BOT} target="_blank" rel="noopener noreferrer">
              <LuMessageCircle aria-hidden="true" /> Falar com o bot
            </a>
            <a className="sv-btn sv-btn--vidro mu-btn-g" href="#bot">
              Como funciona <LuArrowRight className="sv-seta" aria-hidden="true" />
            </a>
          </div>
        </section>

        {/* 2. Sobre o projeto */}
        <section className="mu-secao" id="sobre" aria-labelledby="sobre-titulo">
          <div className="mu-secao-topo">
            <span className="mu-sobretitulo">O projeto</span>
            <h2 id="sobre-titulo">Informação certa na hora da enchente</h2>
          </div>

          <div className="mu-problema mu-vidro">
            <span className="sv-poco sv-poco--g sv-poco--sirene" aria-hidden="true"><LuTriangleAlert /></span>
            <div>
              <h3>O problema</h3>
              <p>
                Em enchentes e deslizamentos, a informação fica espalhada: quais abrigos existem,
                quantas vagas ainda têm, se um aviso é verdadeiro ou só um boato.
                O S.O.S Vale junta tudo isso em um só lugar.
              </p>
            </div>
          </div>

          <ul className="mu-cards">
            {frentes.map((f) => (
              <li key={f.titulo} className="mu-card mu-vidro">
                <span className={`sv-poco sv-poco--g sv-poco--aceso sv-poco--${f.tom}`} aria-hidden="true">{f.icone}</span>
                <h3>{f.titulo}</h3>
                <p>{f.texto}</p>
              </li>
            ))}
          </ul>

          <p className="mu-academico">
            <LuGraduationCap aria-hidden="true" />
            Projeto Integrador I — Análise e Desenvolvimento de Sistemas, Fatec Taubaté
          </p>
        </section>

        {/* 3. Bot de WhatsApp */}
        <section className="mu-secao" id="bot" aria-labelledby="bot-titulo">
          <div className="mu-bot">
            <div className="mu-bot-texto">
              <div className="mu-secao-topo">
                <span className="mu-sobretitulo">Bot no WhatsApp</span>
                <h2 id="bot-titulo">É só mandar um “oi”</h2>
                <p className="mu-secao-sub">
                  O morador usa o S.O.S Vale pelo WhatsApp que já tem no celular.
                  Basta mandar <strong>oi</strong> para o número do bot e escolher uma opção do menu.
                </p>
              </div>

              <ol className="mu-passos">
                {passos.map((p, i) => (
                  <li key={p.titulo}>
                    <span className="mu-passo-num" aria-hidden="true">{i + 1}</span>
                    <div>
                      <strong>{p.titulo}</strong>
                      <span>{p.texto}</span>
                    </div>
                  </li>
                ))}
              </ol>

              <ul className="mu-destaques">
                {destaquesBot.map((d) => (
                  <li key={d.titulo} className="mu-vidro">
                    <span className="sv-poco sv-poco--p" aria-hidden="true">{d.icone}</span>
                    <div>
                      <h3>{d.titulo}</h3>
                      <p>{d.texto}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mu-bot-acao">
                <a className="sv-btn sv-btn--primario mu-btn-g" href={LINK_BOT} target="_blank" rel="noopener noreferrer">
                  <LuMessageCircle aria-hidden="true" /> Falar com o bot
                </a>
                {numeroValido && (
                  <span className="mu-numero"><LuSmartphone aria-hidden="true" /> {formatarTelefone(NUMERO_DO_BOT)}</span>
                )}
              </div>

              <p className="mu-emergencia">
                <LuPhone aria-hidden="true" />
                <span>Em emergência, ligue <strong>193</strong> (Bombeiros) ou <strong>199</strong> (Defesa Civil).</span>
              </p>
            </div>

            {/* Ilustração: conversa com o bot dentro de um celular (só CSS) */}
            <figure className="mu-celular" aria-label="Exemplo de conversa com o bot do S.O.S Vale no WhatsApp">
              <div className="mu-celular-tela">
                <div className="mu-chat-topo">
                  <span className="mu-chat-avatar" aria-hidden="true"><LuSiren /></span>
                  <div>
                    <strong>S.O.S Vale</strong>
                    <span>online</span>
                  </div>
                </div>

                <div className="mu-chat">
                  <div className="mu-balao mu-balao--eu">
                    oi
                    <span className="mu-balao-hora">09:41 <LuCheckCheck aria-hidden="true" /></span>
                  </div>

                  <div className="mu-balao mu-balao--bot">
                    <strong className="mu-chat-marca">S.O.S VALE</strong>
                    <em>Apoio em desastres naturais no Vale do Paraíba</em>
                    <hr />
                    <p>Olá! Sou o assistente virtual do <strong>S.O.S Vale</strong>. Como posso te ajudar?</p>
                    <ol className="mu-chat-menu">
                      {menuBot.map((item, i) => (
                        <li key={item}><span aria-hidden="true">{i + 1}</span>{item}</li>
                      ))}
                    </ol>
                    <hr />
                    <p className="mu-chat-dica">Digite o <strong>número</strong> da opção.</p>
                    <span className="mu-balao-hora">09:41</span>
                  </div>

                  <div className="mu-balao mu-balao--eu">
                    1
                    <span className="mu-balao-hora">09:42 <LuCheckCheck aria-hidden="true" /></span>
                  </div>
                </div>
              </div>
            </figure>
          </div>
        </section>
      </main>

      {/* 4. Rodapé */}
      <footer className="mu-rodape">
        <div className="mu-rodape-dentro">
          <span>S.O.S Vale · Vale do Paraíba</span>
          <Link className="mu-acesso-equipe" to="/">Acesso da equipe</Link>
        </div>
      </footer>
    </div>
  );
};

export default Municipe;
