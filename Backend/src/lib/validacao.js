// Validações usadas pelas rotas de cadastro e edição
//
// Antes, dados inválidos (data "abc", CPF comprido demais, capacidade -5...)
// chegavam até o banco e a API respondia erro 500. Agora a rota confere
// antes e responde 400 com uma mensagem que a tela consegue mostrar.


// Limite de caracteres por tipo de campo — o mesmo padrão das telas
// (Frontend/src/utils/campos.js). Se mudar um número aqui, mude lá também.
export const LIMITES = {
  nomePessoa:  100,
  nomeLocal:   100,
  email:       100,
  senhaMin:    6,
  senhaMax:    64,
  cpf:         14,
  telefone:    15,
  cep:         9,
  endereco:    150,
  cargo:       50,
  titulo:      120,
  descricao:   1000,
  observacao:  500,
  capacidadeMax: 99999,
}


// As fotos chegam em base64 dentro do JSON. A tela aceita até 2 MB, que em
// base64 viram ~2,7 MB — acima do limite padrão do Fastify (1 MB).
export const LIMITE_CORPO_COM_FOTO = 4 * 1024 * 1024


// Lê uma data "AAAA-MM-DD" (formato do <input type="date">) ou "DD/MM/AAAA"
// (formato antigo que a API devolvia). Retorna a data à meia-noite UTC, ou
// null se o texto não for uma data de verdade (ex: "abc", "31/02/2000").
export function lerData(texto) {
  if (typeof texto !== 'string') return null

  let ano, mes, dia
  const iso = texto.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  const br  = texto.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (iso)     [, ano, mes, dia] = iso
  else if (br) [, dia, mes, ano] = br
  else return null

  const data = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)))

  // Date.UTC "conserta" 31/02 para 03/03 — aqui isso conta como data inválida
  if (data.getUTCMonth() !== Number(mes) - 1 || data.getUTCDate() !== Number(dia)) return null

  return data
}


// Data de nascimento: precisa ser válida e não pode ser no futuro.
// Retorna { data } ou { erro }.
export function validarNascimento(texto) {
  const data = lerData(texto)

  if (!data || data.getUTCFullYear() < 1900) {
    return { erro: 'Informe uma data de nascimento válida.' }
  }
  if (data > new Date()) {
    return { erro: 'A data de nascimento não pode ser no futuro.' }
  }

  return { data }
}


// Date → "AAAA-MM-DD" (em UTC)
// O toLocaleDateString usava o fuso do servidor (-3h) e a data perdia 1 dia;
// além disso o <input type="date"> só entende AAAA-MM-DD.
export function dataParaTexto(data) {
  return data ? data.toISOString().slice(0, 10) : null
}


// Campo de texto opcional: "" (campo vazio no formulário) vira null.
// undefined continua undefined (= o campo não veio, mantém o valor atual).
export function textoOuNull(valor) {
  if (valor === undefined) return undefined
  if (valor === null) return null
  const texto = String(valor).trim()
  return texto === '' ? null : texto
}


// Confere o tamanho máximo das colunas VARCHAR do banco.
// campos = [['CPF', cpf, 14], ['Telefone', telefone, 15]]
// Retorna a mensagem de erro ou null.
export function validarTamanhos(campos) {
  for (const [rotulo, valor, maximo] of campos) {
    if (valor && String(valor).length > maximo) {
      return `${rotulo} deve ter no máximo ${maximo} caracteres.`
    }
  }
  return null
}


// Capacidade de abrigo: número inteiro de 0 a 99.999
export function capacidadeValida(valor) {
  return Number.isInteger(Number(valor)) && valor !== '' && valor !== null &&
    Number(valor) >= 0 && Number(valor) <= LIMITES.capacidadeMax
}


// ─── Formatos ────────────────────────────────────────────────────────────────

const digitos = (texto) => String(texto ?? '').replace(/\D/g, '')

// CPF com os dígitos verificadores certos (aceita com ou sem pontuação)
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

// Telefone brasileiro: DDD + 8 dígitos (fixo) ou DDD + 9 dígitos (celular)
export const telefoneValido = (texto) => [10, 11].includes(digitos(texto).length)

export const cepValido = (texto) => digitos(texto).length === 8

export const emailValido = (texto) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(texto ?? '').trim())


// Confere CPF, telefone e CEP — só os que vieram preenchidos.
// Na edição, passe o valor atual do banco em "atuais": o que não mudou não é
// conferido (há cadastros antigos fora do padrão que precisam continuar editáveis).
// Retorna a mensagem de erro ou null.
export function validarFormatos({ cpf, telefone, cep }, atuais = {}) {
  const mudou = (campo, valor) => valor && valor !== atuais[campo]

  if (mudou('cpf', cpf) && !cpfValido(cpf)) {
    return 'CPF inválido. Confira os números digitados.'
  }
  if (mudou('telefone', telefone) && !telefoneValido(telefone)) {
    return 'Telefone inválido. Informe o DDD e o número, ex: (00) 00000-0000.'
  }
  if (mudou('cep', cep) && !cepValido(cep)) {
    return 'CEP inválido. Informe os 8 números, ex: 00000-000.'
  }
  return null
}
