// TELA DESCONTINUADA — era só um teste de layout, sem lógica de login.
// Não tem rota: "/login" redireciona para a tela inicial (ver App.jsx).
import { LuLock, LuLogIn, LuUser } from 'react-icons/lu';
import logoSosVale from '../../../assets/logo-sosvale.png';
import '../../../styles/sosvale-glass.css';

const Login = () => {
  return (
    <div className="sv-app sv-publica">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>

      <div className="sv-card sv-publica-card">
        <div className="sv-publica-topo">
          <img className="sv-publica-logo" src={logoSosVale} alt="S.O.S Vale" />
          <h1 className="sv-publica-titulo">Login</h1>
        </div>

        <form className="sv-form">
          <div className="sv-campo">
            <label htmlFor="login-email" className="sv-oculto">E-mail</label>
            <span className="sv-campo-icone">
              <LuUser />
              <input id="login-email" type="email" placeholder="E-mail" />
            </span>
          </div>
          <div className="sv-campo">
            <label htmlFor="login-senha" className="sv-oculto">Senha</label>
            <span className="sv-campo-icone">
              <LuLock />
              <input id="login-senha" type="password" placeholder="Senha" />
            </span>
          </div>

          <button className="sv-btn sv-btn--primario sv-btn--bloco">
            <LuLogIn /> Entrar
          </button>
          <p className="sv-publica-rodape">
            <a className="sv-link" href="cadastro/index.jsx">Cadastre-se</a>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;
