import React, { useState } from "react";
import { LuLock, LuLogIn, LuMail } from 'react-icons/lu';
import { useNavigate } from 'react-router-dom';
import logoSosVale from '../../assets/logo-sosvale.png';
import '../../styles/sosvale-glass.css';


const LoginAdm = () => {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [senha, setSenha] = useState("");

    // Rodando quando o admin clica em Entrar (LÓGICA INTACTA)
    const fazerLogin = async (e) => {
        e.preventDefault(); // impede a página de recarregar

        try {
            const response = await fetch("http://localhost:3000/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, senha }),
            });

            const data = await response.json();

            if (response.ok) {
                console.log("Login realizado com sucesso!");

                // Salva o token JWT retornado pelo Fastify no localStorage
                localStorage.setItem("token_adm", data.token);

                // Redireciona para a página do administrador
                navigate('/pg_adm');
            }
        } catch (error) {
            console.error("Erro ao conectar com a API:", error);
        }
    }

    return (
        <div className="sv-app sv-publica">
            <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>

            <div className="sv-card sv-publica-card">
                <div className="sv-publica-topo">
                    <img className="sv-publica-logo" src={logoSosVale} alt="S.O.S Vale" />
                    <h1 className="sv-publica-titulo">Login</h1>
                    <p className="sv-subtitulo">Acesse sua conta para continuar</p>
                </div>

                <form onSubmit={fazerLogin} className="sv-form">
                    <div className="sv-campo">
                        <label htmlFor="adm-email">E-mail</label>
                        <span className="sv-campo-icone">
                            <LuMail />
                            <input
                                id="adm-email"
                                type="email"
                                placeholder="seu@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </span>
                    </div>
                    <div className="sv-campo">
                        <label htmlFor="adm-senha">Senha</label>
                        <span className="sv-campo-icone">
                            <LuLock />
                            <input
                                id="adm-senha"
                                type="password"
                                placeholder="Sua senha"
                                value={senha}
                                onChange={(e) => setSenha(e.target.value)}
                                required
                            />
                        </span>
                    </div>
                    <button type="submit" className="sv-btn sv-btn--primario sv-btn--bloco">
                        <LuLogIn /> Entrar
                    </button>
                </form>
            </div>
        </div>
    );
}

export default LoginAdm;
