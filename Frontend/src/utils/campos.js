// Padrão dos campos de formulário do S.O.S Vale
//
// Um lugar só para os limites, exemplos e máscaras — assim todos os
// formulários se comportam igual. Os mesmos limites são conferidos na API
// (Backend/src/lib/validacao.js). Se mudar um número aqui, mude lá também.


// ─── Limite de caracteres por tipo de campo ─────────────────────────────────
export const LIMITES = {
  nomePessoa:  100,   // vítima, voluntário, admin, responsável, inscrito
  nomeLocal:   100,   // abrigo, cidade, bairro
  email:       100,
  senhaMin:    6,
  senhaMax:    64,
  cpf:         14,    // 000.000.000-00
  telefone:    15,    // (00) 00000-0000
  cep:         9,     // 00000-000
  endereco:    150,
  cargo:       50,
  titulo:      120,
  descricao:   1000,
  observacao:  500,   // observação de fechamento, motivo da recusa
  motivoAlerta: 300,  // motivo do cancelamento de alerta (vai na mensagem do WhatsApp)
  busca:       100,   // campos de pesquisa das listagens
  grupoId:     40,    // 120363012345678901@g.us
  link:        100,
  // Números: quantidade máxima de dígitos
  capacidadeDigitos: 5,   // até 99.999 pessoas
  populacaoDigitos:  8,   // até 99.999.999 habitantes
}


// ─── Exemplos (placeholders) ────────────────────────────────────────────────
// Fictícios de propósito: nada de CEP, telefone ou CPF de verdade
export const EXEMPLOS = {
  cpf:      'Ex: 000.000.000-00',
  telefone: 'Ex: (00) 00000-0000',
  cep:      'Ex: 00000-000',
  email:    'Ex: nome@exemplo.com',
}


// ─── Máscaras e filtros (usar no onChange) ──────────────────────────────────
// Todas aceitam o texto digitado/colado e devolvem só o que é permitido

const digitos = (texto) => String(texto ?? '').replace(/\D/g, '')

// Só números, com limite de dígitos. Ex: capacidade, população
export function somenteNumeros(texto, maxDigitos) {
  return digitos(texto).slice(0, maxDigitos)
}

// Número com até 2 casas decimais (aceita vírgula ou ponto). Ex: área em km²
export function somenteDecimal(texto, maxInteiros = 6) {
  const limpo = String(texto ?? '').replace(',', '.').replace(/[^\d.]/g, '')
  const [inteiro = '', ...resto] = limpo.split('.')
  const decimal = resto.join('').slice(0, 2)
  return inteiro.slice(0, maxInteiros) + (limpo.includes('.') ? '.' + decimal : '')
}

// Nome de pessoa: letras (com acento), espaço, apóstrofo, hífen e ponto — sem números
export function somenteNome(texto) {
  return String(texto ?? '').replace(/[^\p{L}\s'.-]/gu, '').replace(/\s{2,}/g, ' ').slice(0, LIMITES.nomePessoa)
}

// 12345678901 → 123.456.789-01
export function mascaraCpf(texto) {
  const d = digitos(texto).slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}

// 12999998888 → (12) 99999-8888 | 1233334444 → (12) 3333-4444
export function mascaraTelefone(texto) {
  const d = digitos(texto).slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

// 12345678 → 12345-678
export function mascaraCep(texto) {
  const d = digitos(texto).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}


// Para campos SEM useState (lidos no submit por e.target.nome.value):
//   <input name="cpf" onChange={aoDigitar(mascaraCpf)} />
export const aoDigitar = (filtro) => (e) => { e.target.value = filtro(e.target.value) }


// ─── Validações (para mostrar o erro antes de enviar) ───────────────────────
// Retornam true quando o valor está certo. Campo vazio é tratado por "required".

export function cpfValido(texto) {
  const d = digitos(texto)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const dv = (base) => {
    const soma = [...base].reduce((total, n, i) => total + Number(n) * (base.length + 1 - i), 0)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  return dv(d.slice(0, 9)) === Number(d[9]) && dv(d.slice(0, 10)) === Number(d[10])
}

// DDD + 8 dígitos (fixo) ou DDD + 9 dígitos (celular)
export const telefoneValido = (texto) => [10, 11].includes(digitos(texto).length)

export const cepValido = (texto) => digitos(texto).length === 8

// Mensagem do primeiro problema encontrado (ou null). Usado antes de enviar o formulário.
// campos = { cpf, telefone, cep } — só confere o que vier preenchido
export function erroDosCampos({ cpf, telefone, cep } = {}) {
  if (cpf && !cpfValido(cpf)) return 'CPF inválido. Confira os números digitados.'
  if (telefone && !telefoneValido(telefone)) return 'Telefone inválido. Informe o DDD e o número, ex: (00) 00000-0000.'
  if (cep && !cepValido(cep)) return 'CEP inválido. Informe os 8 números, ex: 00000-000.'
  return null
}
