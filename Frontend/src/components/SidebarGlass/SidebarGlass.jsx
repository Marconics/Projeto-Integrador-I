import { useState, useEffect } from 'react';
import {
  LuLayoutGrid, LuMap, LuHouse, LuUsers, LuClipboardList, LuHandHeart,
  LuSiren, LuUserCheck, LuMapPinned, LuLogOut, LuMenu, LuX, LuUser, LuUserCog,
} from 'react-icons/lu';
import logoSosVale from '../../assets/logo-sosvale.png';
import '../../styles/sosvale-glass.css';
import './SidebarGlass.css';

// Rotas reais do projeto (ver App.jsx)
// Enquanto a home nova estiver em teste (/adm-nova), "Visão geral" leva à home atual
const ROTA_HOME = '/pg_adm';
const ROTA_LOGIN = '/login-adm';

// Menu do ADMINISTRADOR
const itensMenu = [
  { id: 'home',                label: 'Visão geral',            icon: <LuLayoutGrid />,    href: ROTA_HOME },
  { id: 'mapa',                label: 'Mapa da região',         icon: <LuMap />,           href: '/mapa' },
  { id: 'abrigos',             label: 'Abrigos',                icon: <LuHouse />,         href: '/abrigos' },
  { id: 'vitimas',             label: 'Vítimas',                icon: <LuUsers />,         href: '/vitimas' },
  { id: 'solicitacoes-abrigo', label: 'Solicitações de abrigo', icon: <LuClipboardList />, href: '/listar-solicitação-abrigo' },
  { id: 'solicitacoes-ajuda',  label: 'Solicitações de ajuda',  icon: <LuHandHeart />,     href: '/solicitacoes-ajuda' },
  { id: 'alertas',             label: 'Alertas',                icon: <LuSiren />,         href: '/alertas' },
  { id: 'inscritos',           label: 'Inscritos',              icon: <LuUserCheck />,     href: '/inscritos' },
  { id: 'regioes',             label: 'Regiões',                icon: <LuMapPinned />,     href: '/regioes' },
  // Um admin logado cadastra outros (a API não deixa mais qualquer pessoa criar admin)
  { id: 'administradores',     label: 'Administradores',        icon: <LuUserCog />,       href: '/administradores' },
];

// Menu do VOLUNTÁRIO (mesmos itens do antigo SidebarVoluntario).
// O voluntário não tem acesso às telas do admin, então nenhum item leva para elas.
const ROTA_HOME_VOLUNTARIO = '/painel-voluntario';
const itensMenuVoluntario = [
  { id: 'home',    label: 'Home',                  icon: <LuLayoutGrid />, href: ROTA_HOME_VOLUNTARIO },
  { id: 'ajuda',   label: 'Solicitações de ajuda', icon: <LuHandHeart />,  href: '/solicitacoes-ajuda-voluntario' },
  { id: 'abrigos', label: 'Abrigos',               icon: <LuHouse />,      href: '/voluntario/abrigos' },
  { id: 'mapa',    label: 'Mapa de abrigos',       icon: <LuMap />,        href: '/voluntario/mapa' },
  { id: 'perfil',  label: 'Meu perfil',            icon: <LuUser />,       href: '/painel-voluntario?aba=perfil' },
];

// Sair: apaga o token do admin e volta para o login
function sair() {
  try { localStorage.removeItem('token_adm') } catch { /* storage bloqueado */ }
  window.location.href = ROTA_LOGIN
}

// Sair do voluntário: apaga os dados dele e volta para a seleção de módulo
function sairVoluntario() {
  try {
    localStorage.removeItem('token_voluntario')
    localStorage.removeItem('voluntario')
  } catch { /* storage bloqueado */ }
  window.location.href = '/'
}

// Uso: <SidebarGlass ativo="home" />                       → menu do admin
//      <SidebarGlass modulo="voluntario" ativo="abrigos" /> → menu do voluntário
const SidebarGlass = ({ ativo, modulo = 'admin' }) => {
  const voluntario = modulo === 'voluntario'
  const itens = voluntario ? itensMenuVoluntario : itensMenu
  const rotaHome = voluntario ? ROTA_HOME_VOLUNTARIO : ROTA_HOME

  // No celular a sidebar vira uma gaveta que abre pelo botão de menu
  const [aberta, setAberta] = useState(false);

  // Fecha a gaveta com a tecla Esc
  useEffect(() => {
    if (!aberta) return
    const aoTeclar = (e) => { if (e.key === 'Escape') setAberta(false) }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aberta])

  return (
    <>
      {/* Barra que só aparece no celular */}
      <div className="sbg-barra sbg-azul">
        <Marca href={rotaHome} />
        <button
          type="button"
          className="sv-btn sv-btn--icone"
          aria-label="Abrir menu"
          aria-expanded={aberta}
          aria-controls="sbg-menu"
          onClick={() => setAberta(true)}
        >
          <LuMenu />
        </button>
      </div>

      <div
        className={`sbg-veu ${aberta ? 'sbg-veu--visivel' : ''}`}
        onClick={() => setAberta(false)}
        aria-hidden="true"
      />

      <aside id="sbg-menu" className={`sbg sbg-azul ${aberta ? 'sbg--aberta' : ''}`}>
        <div className="sbg-topo">
          <Marca href={rotaHome} />
          <button
            type="button"
            className="sv-btn sv-btn--icone sbg-fechar"
            aria-label="Fechar menu"
            onClick={() => setAberta(false)}
          >
            <LuX />
          </button>
        </div>

        <nav className="sbg-nav" aria-label="Menu principal">
          <ul>
            {itens.map(item => {
              const atual = item.id === ativo
              return (
                <li key={item.id}>
                  <a
                    href={item.href}
                    className={`sbg-link ${atual ? 'sbg-link--ativo' : ''}`}
                    aria-current={atual ? 'page' : undefined}
                  >
                    <span className="sbg-link-icone">{item.icon}</span>
                    <span className="sbg-link-texto">{item.label}</span>
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="sbg-rodape">
          <button type="button" className="sbg-link sbg-sair" onClick={voluntario ? sairVoluntario : sair}>
            <span className="sbg-link-icone"><LuLogOut /></span>
            <span className="sbg-link-texto">Sair</span>
          </button>
        </div>
      </aside>
    </>
  )
}

// Logo oficial num selo branco + nome do projeto
function Marca({ href }) {
  return (
    <a href={href} className="sbg-marca" aria-label="S.O.S Vale, visão geral">
      <span className="sbg-marca-selo"><img src={logoSosVale} alt="" /></span>
      <span className="sbg-marca-nome">
        S.O.S Vale
        <small>Rede de apoio</small>
      </span>
    </a>
  )
}

export default SidebarGlass;
