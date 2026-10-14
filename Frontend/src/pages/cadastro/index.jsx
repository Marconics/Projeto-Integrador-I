
import { LuEye, LuLock, LuMail, LuUser, LuUserPlus, LuUsers } from 'react-icons/lu';
import logoSosVale from '../../assets/logo-sosvale.png';
import '../../styles/sosvale-glass.css';

const Cadastro = () => {
  return (
    <div className="sv-app sv-publica">
      <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>

      <div className="sv-card sv-publica-card">

        {/* Logo e títulos do card */}
        <div className="sv-publica-topo">
          <img className="sv-publica-logo" src={logoSosVale} alt="S.O.S Vale" />
          <h1 className="sv-publica-titulo">Cadastrar</h1>
          <p className="sv-subtitulo">Crie sua conta para começar</p>
        </div>

        <form className="sv-form">
          {/* Campo: Nome Completo */}
          <div className="sv-campo">
            <label htmlFor="cad-nome">Nome completo</label>
            <span className="sv-campo-icone">
              <LuUser />
              <input id="cad-nome" type="text" placeholder="Seu nome completo" />
            </span>
          </div>

          {/* Campo: E-mail */}
          <div className="sv-campo">
            <label htmlFor="cad-email">E-mail</label>
            <span className="sv-campo-icone">
              <LuMail />
              <input id="cad-email" type="email" placeholder="seu@email.com" />
            </span>
          </div>

          {/* Campo: Senha */}
          <div className="sv-campo">
            <label htmlFor="cad-senha">Senha</label>
            <span className="sv-campo-icone">
              <LuLock />
              <input id="cad-senha" type="password" placeholder="Crie uma senha" />
              <LuEye className="sv-campo-icone-fim" />
            </span>
            <small className="sv-campo-ajuda">
              A senha deve ter pelo menos 8 caracteres, com letras e números.
            </small>
          </div>

          {/* Campo: Tipo de Acesso */}
          <div className="sv-campo">
            <label htmlFor="cad-tipo">Tipo de acesso</label>
            <span className="sv-campo-icone">
              <LuUsers />
              <select id="cad-tipo" defaultValue="">
                <option value="" disabled hidden>Selecione uma opção</option>
                <option value="usuario">Usuário Comum</option>
                <option value="admin">Administrador</option>
              </select>
            </span>
          </div>

          {/* Checkbox de Termos e Políticas */}
          <label className="sv-check" htmlFor="termos">
            <input type="checkbox" id="termos" />
            <span>
              Li e concordo com os <a className="sv-link" href="/termos">Termos de Uso</a> e <a className="sv-link" href="/politica">Política de Privacidade</a>.
            </span>
          </label>

          {/* Botão de Enviar */}
          <button type="submit" className="sv-btn sv-btn--primario sv-btn--bloco">
            <LuUserPlus /> Cadastrar
          </button>

          {/* Link para Login fora do botão */}
          <p className="sv-publica-rodape">
            Já tem uma conta? <a className="sv-link" href="/login">Entrar</a>
          </p>
        </form>

      </div>
    </div>
  );
};

export default Cadastro;
