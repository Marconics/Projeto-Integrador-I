// Chamadas do módulo Voluntário que precisam do login (token_voluntario)
import { API_URL } from './api'

// Igual ao fetch, mas já com a URL da API e o token do voluntário no cabeçalho.
// Devolve a mesma Response do fetch. Se o login expirou, volta para o login.
export async function fetchVoluntario(caminho, opcoes = {}) {
  const token = localStorage.getItem('token_voluntario')

  const resposta = await fetch(`${API_URL}/api${caminho}`, {
    ...opcoes,
    headers: { ...opcoes.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })

  if (resposta.status === 401) {
    window.location.href = '/login-voluntario'
    throw new Error('Sua sessão expirou. Faça login novamente.')
  }

  return resposta
}

// Vincula o voluntário logado a um abrigo (abrigoId = null desvincula).
// Retorna { mensagem, abrigo } ou lança erro com a mensagem da API.
export async function alterarVinculoAbrigo(abrigoId) {
  const resposta = await fetchVoluntario('/voluntarios/me/abrigo', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ abrigoId }),
  })
  const dados = await resposta.json().catch(() => ({}))

  if (!resposta.ok) throw new Error(dados.mensagem ?? 'Não foi possível salvar o vínculo.')

  return dados
}
