import { Navigate, Outlet } from 'react-router-dom';

// Guarda das telas do painel: só mostra a tela se houver login válido do tipo pedido.
// Antes as telas do admin abriam sem login (inclusive depois de clicar em Sair).
//
// Uso no App.jsx:
//   <Route element={<RotaProtegida tipo="admin" />}> ...rotas do admin... </Route>
//
// Aqui só se confere se o token existe, é do tipo certo e não venceu.
// Quem garante a segurança de verdade é a API, que confere a assinatura.
const logins = {
  admin:      { chave: 'token_adm',        tela: '/login-adm' },
  voluntario: { chave: 'token_voluntario', tela: '/login-voluntario' },
}

// Lê o conteúdo do JWT (a parte do meio, em base64)
function lerToken(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}

// true se o token salvo é do tipo pedido e ainda não venceu (exp vem em segundos)
function loginValido(tipo) {
  const dados = lerToken(localStorage.getItem(logins[tipo].chave) ?? '')
  return dados?.tipo === tipo && (!dados.exp || dados.exp * 1000 > Date.now())
}

function RotaProtegida({ tipo }) {
  return loginValido(tipo) ? <Outlet /> : <Navigate to={logins[tipo].tela} replace />
}

export default RotaProtegida;
