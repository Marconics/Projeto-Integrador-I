import {
  FaHome, FaBoxOpen, FaUser, FaMap, FaUsers, FaMapMarkedAlt, FaHandHoldingHeart, FaClipboardList, FaUserShield
} from 'react-icons/fa';
import { GoAlertFill } from 'react-icons/go';
import { FiLogOut } from 'react-icons/fi';
import logo from '../assets/logo.png';

// Sidebar do painel ADMINISTRATIVO — usada em todas as telas do admin.
// Para adicionar/renomear um item, mude só esta lista.
// "ativo" recebe o id do item que deve aparecer selecionado.
const itens = [
  { id: 'home',                href: '/pg_adm',                    label: 'Home',                   icone: <FaHome className="icon" /> },
  { id: 'abrigos',             href: '/abrigos',                   label: 'Abrigos',                icone: <FaBoxOpen className="icon" /> },
  { id: 'vitimas',             href: '/vitimas',                   label: 'Vítimas',                icone: <FaUser className="icon" /> },
  { id: 'ajuda',               href: '/solicitacoes-ajuda',        label: 'Solicitações de ajuda',  icone: <FaHandHoldingHeart className="icon" /> },
  { id: 'solicitacoes-abrigo', href: '/listar-solicitação-abrigo', label: 'Solicitações de abrigo', icone: <FaClipboardList className="icon" /> },
  { id: 'mapa',                href: '/mapa',                      label: 'Mapa',                   icone: <FaMap className="icon" /> },
  { id: 'alertas',             href: '/alertas',                   label: 'Alertas',                icone: <GoAlertFill className="icon" /> },
  { id: 'inscritos',           href: '/inscritos',                 label: 'Inscritos',              icone: <FaUsers className="icon" /> },
  { id: 'regioes',             href: '/regioes',                   label: 'Regiões',                icone: <FaMapMarkedAlt className="icon" /> },
  { id: 'administradores',     href: '/administradores',           label: 'Administradores',        icone: <FaUserShield className="icon" /> },
]

function SidebarAdm({ ativo }) {

  const sair = () => {
    localStorage.removeItem('token_adm')
    // Volta para a seleção de módulo (Administrador / Voluntário / Munícipe)
    window.location.href = '/'
  }

  return (
    <aside className="sidebar">
      <div className="top-icons">
        <img src={logo} width="70px" alt="Logo S.O.S Vale" />
        <p>S.O.S. Vale</p>
      </div>
      <ul>
        {itens.map(item => (
          <a key={item.id} href={item.href}>
            <li className={item.id === ativo ? 'active' : undefined}>
              {item.icone} {item.label}
            </li>
          </a>
        ))}
      </ul>

      <div className="sidebar-footer">
        <button className="logout-btn" onClick={sair}>
          <FiLogOut className="icon" /> Sair
        </button>
      </div>
    </aside>
  )
}

export default SidebarAdm;
