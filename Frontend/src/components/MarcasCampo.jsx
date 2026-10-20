// Marcas padronizadas dos rótulos de formulário
//
//   <label htmlFor="nome">Nome<Obrigatorio /></label>
//   <label htmlFor="telefone">Telefone<Opcional /></label>
//   <AvisoObrigatorios />                       → "* Campos obrigatórios"
//   <ContadorCaracteres valor={texto} limite={1000} />  → "12/1000"
//
// O asterisco é só visual (aria-hidden): quem usa leitor de tela já ouve
// "obrigatório" pelo atributo required do campo.
// Estilos: styles/sosvale-glass.css (seção "Marcas dos formulários").

export function Obrigatorio() {
  return <span className="sv-campo-obrigatorio" aria-hidden="true"> *</span>
}

export function Opcional() {
  return <span className="sv-campo-opcional"> (opcional)</span>
}

export function AvisoObrigatorios() {
  return (
    <p className="sv-aviso-obrigatorios">
      <span className="sv-campo-obrigatorio" aria-hidden="true">*</span> Campos obrigatórios
    </p>
  )
}

// Fica laranja perto do limite, para a pessoa perceber antes de parar de digitar
export function ContadorCaracteres({ valor, limite }) {
  const usados = String(valor ?? '').length
  return (
    <span className={`sv-contador ${usados >= limite * 0.9 ? 'sv-contador--perto' : ''}`}>
      {usados}/{limite}
    </span>
  )
}
