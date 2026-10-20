import React, { useState } from "react";
import { LuIdCard, LuLock, LuMail, LuPhone, LuUser, LuUserPlus } from 'react-icons/lu';
import { useNavigate, Link } from 'react-router-dom';
import { API_URL, hojeISO } from '../../services/api';
import { LIMITES, EXEMPLOS, somenteNome, mascaraCpf, mascaraTelefone, erroDosCampos } from '../../utils/campos';
import { Obrigatorio, Opcional, AvisoObrigatorios } from '../../components/MarcasCampo';
// Importada (e não "src/assets/..."): o caminho de texto quebrava no build
import logoSosVale from '../../assets/logo-sosvale.png';
import '../../styles/sosvale-glass.css';

const CadastroVoluntario = () => {
    const navigate = useNavigate();

    const [nome, setNome] = useState("");
    const [email, setEmail] = useState("");
    const [senha, setSenha] = useState("");
    const [telefone, setTelefone] = useState("");
    const [cpf, setCpf] = useState("");
    const [dataNascimento, setDataNascimento] = useState("");
    const [genero, setGenero] = useState("");
    const [erro, setErro] = useState("");
    const [carregando, setCarregando] = useState(false);

    // Rodando quando o voluntário clica em Cadastrar
    const fazerCadastro = async (e) => {
        e.preventDefault(); // impede a página de recarregar
        setErro("");

        // Confere CPF (dígitos verificadores) e telefone antes de enviar
        const erroCampos = erroDosCampos({ cpf, telefone });
        if (erroCampos) {
            setErro(erroCampos);
            return;
        }

        setCarregando(true);

        try {
            const response = await fetch(`${API_URL}/api/voluntarios/cadastrar`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    nome:           nome.trim(),
                    email:          email.trim(),
                    senha,
                    telefone:       telefone       || null, // opcional — manda null se vazio
                    cpf:            cpf            || null, // opcional — manda null se vazio
                    dataNascimento,
                    genero,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                console.log("Voluntário cadastrado com sucesso!");

                // Após cadastro, redireciona para o login — o voluntário precisa entrar com as credenciais
                navigate('/login-voluntario');
            } else {
                // Exibe a mensagem de erro retornada pelo backend (ex: "Email já cadastrado.")
                setErro(data.mensagem || "Erro ao cadastrar.");
            }
        } catch (error) {
            console.error("Erro ao conectar com a API:", error);
            setErro("Erro ao conectar com o servidor. Tente novamente.");
        } finally {
            setCarregando(false);
        }
    }

    return (
        <div className="sv-app sv-publica">
            <div className="sv-fundo" aria-hidden="true"><span /><span /><span /></div>

            <div className="sv-card sv-publica-card sv-publica-card--largo">
                <div className="sv-publica-topo">
                    <img className="sv-publica-logo" src={logoSosVale} alt="S.O.S Vale" />
                    <h1 className="sv-publica-titulo">Cadastro de Voluntário</h1>
                    <p className="sv-subtitulo">Preencha seus dados para se cadastrar</p>
                </div>

                <form onSubmit={fazerCadastro} className="sv-form">
                    <AvisoObrigatorios />
                    {/* Nome — obrigatório */}
                    <div className="sv-campo">
                        <label htmlFor="cv-nome">Nome completo<Obrigatorio /></label>
                        <span className="sv-campo-icone">
                            <LuUser />
                            <input
                                id="cv-nome"
                                type="text"
                                placeholder="Seu nome completo"
                                maxLength={LIMITES.nomePessoa}
                                minLength={2}
                                value={nome}
                                onChange={(e) => setNome(somenteNome(e.target.value))}
                                required
                            />
                        </span>
                    </div>

                    <div className="sv-form-grade">
                        {/* E-mail — obrigatório e único no banco */}
                        <div className="sv-campo">
                            <label htmlFor="cv-email">E-mail<Obrigatorio /></label>
                            <span className="sv-campo-icone">
                                <LuMail />
                                <input
                                    id="cv-email"
                                    type="email"
                                    placeholder={EXEMPLOS.email}
                                    maxLength={LIMITES.email}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </span>
                        </div>

                        {/* Senha — obrigatório, criptografada no backend com bcrypt */}
                        <div className="sv-campo">
                            <label htmlFor="cv-senha">Senha<Obrigatorio /></label>
                            <span className="sv-campo-icone">
                                <LuLock />
                                <input
                                    id="cv-senha"
                                    type="password"
                                    placeholder={`De ${LIMITES.senhaMin} a ${LIMITES.senhaMax} caracteres`}
                                    minLength={LIMITES.senhaMin}
                                    maxLength={LIMITES.senhaMax}
                                    autoComplete="new-password"
                                    value={senha}
                                    onChange={(e) => setSenha(e.target.value)}
                                    required
                                />
                            </span>
                        </div>

                        {/* Telefone — opcional no banco (VarChar 15) */}
                        <div className="sv-campo">
                            <label htmlFor="cv-telefone">Telefone<Opcional /></label>
                            <span className="sv-campo-icone">
                                <LuPhone />
                                <input
                                    id="cv-telefone"
                                    type="tel"
                                    maxLength={LIMITES.telefone}
                                    inputMode="numeric"
                                    placeholder={EXEMPLOS.telefone}
                                    value={telefone}
                                    onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
                                />
                            </span>
                        </div>

                        {/* CPF — opcional no banco (VarChar 14) */}
                        <div className="sv-campo">
                            <label htmlFor="cv-cpf">CPF<Opcional /></label>
                            <span className="sv-campo-icone">
                                <LuIdCard />
                                <input
                                    id="cv-cpf"
                                    type="text"
                                    maxLength={LIMITES.cpf}
                                    inputMode="numeric"
                                    placeholder={EXEMPLOS.cpf}
                                    value={cpf}
                                    onChange={(e) => setCpf(mascaraCpf(e.target.value))}
                                />
                            </span>
                        </div>

                        {/* Data de nascimento — obrigatório no schema */}
                        <div className="sv-campo">
                            <label htmlFor="cv-nascimento">Data de nascimento<Obrigatorio /></label>
                            <input
                                id="cv-nascimento"
                                type="date"
                                min="1900-01-01"
                                max={hojeISO()}
                                value={dataNascimento}
                                onChange={(e) => setDataNascimento(e.target.value)}
                                required
                            />
                        </div>

                        {/* Gênero — obrigatório no schema */}
                        <div className="sv-campo">
                            <label htmlFor="cv-genero">Gênero<Obrigatorio /></label>
                            <select
                                id="cv-genero"
                                value={genero}
                                onChange={(e) => setGenero(e.target.value)}
                                required
                            >
                                <option value="">Selecione</option>
                                <option value="masculino">Masculino</option>
                                <option value="feminino">Feminino</option>
                                <option value="nao-binario">Não-binário</option>
                                <option value="prefiro-nao-informar">Prefiro não informar</option>
                            </select>
                        </div>
                    </div>

                    {/* Exibe mensagem de erro se o cadastro falhar */}
                    {erro && <p className="sv-aviso sv-aviso--erro" role="alert">{erro}</p>}

                    {/* Desabilita o botão enquanto aguarda resposta da API */}
                    <button type="submit" className="sv-btn sv-btn--primario sv-btn--bloco" disabled={carregando}>
                        <LuUserPlus /> {carregando ? "Cadastrando..." : "Cadastrar"}
                    </button>
                </form>

                {/* Link para quem já tem conta (Link = <a>: dá para usar pelo teclado) */}
                <p className="sv-publica-rodape">
                    Já tem uma conta?{" "}
                    <Link className="sv-link" to="/login-voluntario">Faça login</Link>
                </p>
            </div>
        </div>
    );
}

export default CadastroVoluntario;
