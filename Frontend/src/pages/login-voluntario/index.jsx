import React, { useState } from "react";
import { LuLock, LuLogIn, LuMail } from 'react-icons/lu';
import { useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../../services/api';
import { LIMITES, EXEMPLOS } from '../../utils/campos';
// Importada (e não "src/assets/..."): o caminho de texto quebrava no build
import logoSosVale from '../../assets/logo-sosvale.png';
import '../../styles/sosvale-glass.css';

const LoginVoluntario = () => {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [senha, setSenha] = useState("");
    const [erro, setErro] = useState("");

    // Rodando quando o voluntário clica em Entrar
    const fazerLogin = async (e) => {
        e.preventDefault(); // impede a página de recarregar
        setErro(""); // limpa erro anterior antes de tentar

        try {
            const response = await fetch(`${API_URL}/api/voluntarios/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, senha }),
            });

            const data = await response.json();

            if (response.ok) {
                console.log("Login do voluntário realizado com sucesso!");

                // Salva o token JWT do voluntário separado do token do admin
                // token_voluntario é usado pelo PainelVoluntario para verificar acesso
                localStorage.setItem("token_voluntario", data.token);

                // Salva os dados básicos do voluntário para exibir no painel sem nova requisição
                localStorage.setItem("voluntario", JSON.stringify(data.voluntario));

                // Redireciona para o painel do voluntário
                navigate('/painel-voluntario');
            } else {
                // Exibe a mensagem de erro retornada pelo backend (ex: "Email ou senha incorretos.")
                setErro(data.mensagem || "Erro ao fazer login.");
            }
        } catch (error) {
            console.error("Erro ao conectar com a API:", error);
            setErro("Erro ao conectar com o servidor. Tente novamente.");
        }
    }

    return (
        <div className="sv-app sv-publica">
            <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>

            <div className="sv-card sv-publica-card">
                <div className="sv-publica-topo">
                    <img className="sv-publica-logo" src={logoSosVale} alt="S.O.S Vale" />
                    <h1 className="sv-publica-titulo">Login Voluntário</h1>
                    <p className="sv-subtitulo">Acesse sua conta para continuar</p>
                </div>

                <form onSubmit={fazerLogin} className="sv-form">
                    <div className="sv-campo">
                        <label htmlFor="vol-email">E-mail</label>
                        <span className="sv-campo-icone">
                            <LuMail />
                            <input
                                id="vol-email"
                                type="email"
                                placeholder={EXEMPLOS.email}
                                maxLength={LIMITES.email}
                                autoComplete="username"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </span>
                    </div>

                    <div className="sv-campo">
                        <label htmlFor="vol-senha">Senha</label>
                        <span className="sv-campo-icone">
                            <LuLock />
                            <input
                                id="vol-senha"
                                type="password"
                                placeholder="Sua senha"
                                maxLength={LIMITES.senhaMax}
                                autoComplete="current-password"
                                value={senha}
                                onChange={(e) => setSenha(e.target.value)}
                                required
                            />
                        </span>
                    </div>

                    {/* Exibe mensagem de erro se o login falhar */}
                    {erro && <p className="sv-aviso sv-aviso--erro" role="alert">{erro}</p>}

                    <button type="submit" className="sv-btn sv-btn--primario sv-btn--bloco">
                        <LuLogIn /> Entrar
                    </button>
                </form>

                {/* Link para quem ainda não tem conta (Link = <a>: dá para usar pelo teclado) */}
                <p className="sv-publica-rodape">
                    Ainda não tem conta?{" "}
                    <Link className="sv-link" to="/cadastro-voluntario">Cadastre-se</Link>
                </p>
            </div>
        </div>
    );
}

export default LoginVoluntario;
