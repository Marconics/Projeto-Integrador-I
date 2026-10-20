import { useNavigate } from 'react-router-dom';
import { LuHandshake, LuShield, LuUsers } from 'react-icons/lu';
import logoSosVale from '../../assets/logo-sosvale.png';
import '../../styles/sosvale-glass.css';

const Sosvale = () => {
const navigate = useNavigate();
return (
    <div className="sv-app sv-publica">
        <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>

        <div className="sv-publica-topo">
            <img className="sv-publica-logo" src={logoSosVale} alt="S.O.S Vale" />
            <h1 className="sv-publica-titulo">Bem-vindo ao S.O.S Vale</h1>
            <p className="sv-subtitulo"> Para continuar, selecione o tipo de acesso que melhor descreve o seu papel na plataforma. </p>
        </div>

        <div className="sv-modulos">
            <div className="sv-card sv-modulo">
                <span className="sv-poco sv-poco--g sv-poco--aceso sv-poco--azul"><LuShield /></span>
                <div className="sv-modulo-texto">
                    <h2>Sou Administrador</h2>
                    <p>Acesso especial para gerenciar o sistema.</p>
                </div>
                <button className="sv-btn sv-btn--primario" onClick={() => { navigate('/login-adm')} }>Entrar</button>
            </div>
            <div className="sv-card sv-modulo">
                <span className="sv-poco sv-poco--g sv-poco--aceso sv-poco--ciano"><LuHandshake /></span>
                <div className="sv-modulo-texto">
                    <h2>Sou Voluntário</h2>
                    <p>Quero oferecer ajuda.</p>
                </div>
                <button className="sv-btn sv-btn--primario" onClick={() => { navigate('/login-voluntario')} }>Entrar</button>
            </div>
            <div className="sv-card sv-modulo">
                <span className="sv-poco sv-poco--g sv-poco--aceso sv-poco--petroleo"><LuUsers /></span>
                <div className="sv-modulo-texto">
                    <h2>Sou Munícipe</h2>
                    <p>Sou um cidadão e quero me informar.</p>
                </div>
                {/* O módulo do munícipe ainda não existe (hoje o cidadão usa o bot do WhatsApp) */}
                <button className="sv-btn sv-btn--primario" disabled title="Módulo do munícipe em desenvolvimento">Em breve</button>
            </div>
        </div>
    </div>
    );
};
export default Sosvale;
