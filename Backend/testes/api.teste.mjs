// Teste de ponta a ponta da API
//
// Pré-requisitos, cada um num terminal, na pasta Backend:
//   1. npm run banco:teste   → banco em memória (comece SEMPRE com ele recém-aberto)
//   2. npm run back:teste    → API em modo teste
// Depois:
//   3. npm run teste:api
//
// Cada linha mostra OK ou FALHOU. Nada é gravado no Supabase.
// Precisa de internet só para consultar o CEP no ViaCEP.
const API = (process.env.API_URL || 'http://127.0.0.1:3000') + '/api'
const BOT = { 'x-bot-key': 'chave-de-teste' }
let token = ''
let falhas = 0

async function req(metodo, caminho, corpo, headers = {}) {
  const r = await fetch(API + caminho, {
    method: metodo,
    headers: { ...(corpo ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  const texto = await r.text()
  let dados; try { dados = JSON.parse(texto) } catch { dados = texto }
  return { status: r.status, dados }
}
function checar(nome, condicao, extra) {
  console.log(`${condicao ? 'OK  ' : 'FALHOU'} ${nome}${condicao ? '' : ' → ' + JSON.stringify(extra)}`)
  if (!condicao) falhas++
}
const FOTO = Buffer.from('fake-jpeg').toString('base64')

// ── Trava de segurança: só roda contra a API em MODO TESTE ──
// A API de teste aceita a chave "chave-de-teste"; a API real responde 401.
// Sem isso, se a API real estiver aberta na porta 3000, o teste gravaria no Supabase.
{
  const r = await req('GET', '/bot/inscritos/verificacao-modo-teste', null, BOT)
  if (r.status !== 404) {
    console.error(`\n✗ A API em ${API} NÃO está em modo teste (resposta ${r.status}).`)
    console.error('  Feche a API normal (npm run back / npm run dev) e rode: npm run banco:teste  e  npm run back:teste')
    process.exit(1)
  }

  // Este teste cria as próprias cidades — precisa do banco vazio
  const cidades = await req('GET', '/cidades/listar')
  if (cidades.dados.cidades?.length > 0) {
    console.error('\n✗ O banco de teste já tem dados. Este teste precisa do banco VAZIO.')
    console.error('  Feche o banco (Ctrl + C) e abra com: npm run banco:teste:vazio')
    process.exit(1)
  }
}

// ── Regiões
let r = await req('GET', '/estados/listar')
checar('27 estados', r.dados.estados?.length === 27, r)
const sp = r.dados.estados.find(e => e.sigla === 'SP')

r = await req('POST', '/auth/cadastrar', { nome: 'Admin', email: 'adm@teste.com', senha: '123456' })
r = await req('POST', '/auth/login', { email: 'adm@teste.com', senha: '123456' })
checar('login admin', r.status === 200 && r.dados.token, r)
const tokenAdmin = r.dados.token

r = await req('POST', '/cidades/cadastrar', { nome: 'Taubaté', estadoId: sp.id_estado })
checar('cadastrar cidade sem token → 401', r.status === 401, r)

token = tokenAdmin
r = await req('POST', '/cidades/cadastrar', { nome: 'Taubaté', estadoId: sp.id_estado })
checar('cadastrar cidade', r.status === 201, r)
const taubate = r.dados.cidade
r = await req('POST', '/cidades/cadastrar', { nome: 'taubate', estadoId: sp.id_estado })
checar('cidade duplicada (sem acento) → 400', r.status === 400, r)
r = await req('PUT', `/cidades/atualizar/${taubate.id_cidade}`, { grupoWhatsappId: 'grupo-invalido' })
checar('grupo inválido → 400', r.status === 400, r)
r = await req('PUT', `/cidades/atualizar/${taubate.id_cidade}`, { grupoWhatsappLink: 'https://exemplo.com/grupo' })
checar('link do grupo inválido → 400', r.status === 400, r)
r = await req('PUT', `/cidades/atualizar/${taubate.id_cidade}`, { grupoWhatsappLink: ' chat.whatsapp.com/AbCdEf1234567890 ' })
checar('link do grupo salvo (normalizado)', r.status === 200 && r.dados.cidade.grupoWhatsappLink === 'https://chat.whatsapp.com/AbCdEf1234567890', r)
r = await req('GET', '/bot/cidades/grupos', undefined, BOT)
checar('bot lista links dos grupos', r.status === 200 && r.dados.cidades.length === 1 && r.dados.cidades[0].link.endsWith('AbCdEf1234567890'), r)

r = await req('POST', '/bairros/cadastrar', { nome: 'Centro', cidadeId: taubate.id_cidade, nivelRisco: 'alto', populacaoEstimada: '5000' })
checar('cadastrar bairro', r.status === 201 && r.dados.bairro.nivelRisco === 'alto', r)
const centro = r.dados.bairro
r = await req('POST', '/bairros/cadastrar', { nome: 'Independência', cidadeId: taubate.id_cidade })
const independencia = r.dados.bairro
r = await req('POST', '/bairros/cadastrar', { nome: 'X', cidadeId: taubate.id_cidade, nivelRisco: 'extremo' })
checar('nível de risco inválido → 400', r.status === 400, r)
r = await req('GET', `/bairros/listar?cidadeId=${taubate.id_cidade}`)
checar('listar bairros da cidade', r.dados.bairros?.length === 2 && r.dados.bairros[0].cidade === 'Taubaté', r)

r = await req('GET', '/bairros/cep/12070610')
checar('consultar CEP (ViaCEP)', r.status === 200 && r.dados.cidadeId === taubate.id_cidade, r)
console.log('     ViaCEP →', r.dados.bairro, '/', r.dados.cidade, '/', r.dados.uf)
r = await req('GET', '/bairros/cep/99999999')
checar('CEP inexistente → 404', r.status === 404, r)

// ── Abrigo com a nova localização
r = await req('POST', '/abrigos/cadastrar', { nome: 'Escola A', cep: '12000-000', cidadeId: taubate.id_cidade, bairroId: independencia.id_bairro, endereco: 'Rua 1', tipoAbrigo: 'Escola', capacidadeTotal: 10, capacidadeOcupada: 0 })
checar('cadastrar abrigo', r.status === 201 && r.dados.cidade === 'Taubaté' && r.dados.bairro === 'Independência', r)
const abrigoId = r.dados.id
r = await req('POST', '/abrigos/cadastrar', { nome: 'Escola B', cep: '12000-000', cidadeId: 999, endereco: 'Rua 2', tipoAbrigo: 'Escola', capacidadeTotal: 10 })
checar('abrigo com cidade inexistente → 400', r.status === 400, r)
r = await req('GET', '/abrigos/listar')
checar('listar abrigos (achatado)', r.dados.abrigos?.[0]?.cidade === 'Taubaté' && r.dados.abrigos[0].estado === 'SP', r)
r = await req('GET', `/abrigos/listar/${abrigoId}`)
checar('detalhe abrigo (achatado)', r.dados.cidade === 'Taubaté' && r.dados.bairroId === independencia.id_bairro, r)
r = await req('PUT', `/abrigos/atualizar/${abrigoId}`, { nome: 'Escola A', bairroId: centro.id_bairro })
checar('atualizar bairro do abrigo', r.status === 200 && r.dados.bairro === 'Centro', r)

// ── Solicitação de abrigo
r = await req('POST', '/solicitacoes/criar', { nome: 'Igreja', cep: '1', endereco: 'Rua', cidadeId: taubate.id_cidade, responsavel: 'F', tipoAbrigo: 'Igreja', capacidadeTotal: 5, solicitanteNome: 'F', solicitanteEmail: 'f@f.com' })
checar('criar solicitação de abrigo', r.status === 201, r)
r = await req('GET', '/solicitacoes/listar')
checar('listar solicitações (achatado)', r.dados.solicitacoes?.[0]?.cidade === 'Taubaté', r)

// ── Bot
token = ''
r = await req('POST', '/bot/inscritos', { whatsappId: 'a@c.us', nome: 'Ana', email: 'ana@x.com', bairroId: centro.id_bairro })
checar('bot sem chave → 401', r.status === 401, r)
const inscrever = (w, n, b) => req('POST', '/bot/inscritos', { whatsappId: w, telefone: w.split('@')[0], nome: n, email: `${n}@x.com`, bairroId: b }, BOT)
r = await inscrever('551100000001@c.us', 'Ana', centro.id_bairro)
checar('inscrever', r.status === 201 && r.dados.inscrito.bairro === 'Centro', r)
await inscrever('551100000002@c.us', 'Bia', centro.id_bairro)
await inscrever('551100000003@c.us', 'Caio', centro.id_bairro)
await inscrever('551100000004@c.us', 'Duda', independencia.id_bairro)
await inscrever('551100000005@c.us', 'Edu', independencia.id_bairro)
r = await req('POST', '/bot/inscritos', { whatsappId: 'x@c.us', nome: 'Z', email: 'invalido', bairroId: centro.id_bairro }, BOT)
checar('e-mail inválido → 400', r.status === 400, r)

r = await req('POST', '/bot/inscritos/551100000004@c.us/bairros', { bairroId: centro.id_bairro }, BOT)
checar('Duda acompanha Centro', r.status === 201 && r.dados.inscrito.bairrosInteresse.length === 1, r)
r = await req('POST', '/bot/inscritos/551100000004@c.us/bairros', { bairroId: independencia.id_bairro }, BOT)
checar('acompanhar o próprio bairro → 400', r.status === 400, r)
r = await req('GET', '/bot/inscritos/551100000004@c.us', null, BOT)
checar('buscar inscrito', r.dados.inscrito?.nome === 'Duda', r)

r = await req('POST', '/bot/bairros/cep', { cep: '12070610' }, BOT)
checar('criar bairro pelo CEP', [200, 201].includes(r.status) && r.dados.bairro.cidadeId === taubate.id_cidade, r)
console.log('     bairro via CEP →', r.dados.bairro?.nome, '| criou:', r.dados.criouBairro)

r = await req('PUT', `/bot/cidades/${taubate.id_cidade}/grupo`, { grupoWhatsappId: '120363000000@g.us' }, BOT)
checar('vincular grupo', r.status === 200, r)

// ── Relatos
const relatar = (w, extra = {}) => req('POST', '/bot/alertas/relatar', { whatsappId: w, tipo: 'alagamento', gravidade: 'grave', bairroId: centro.id_bairro, foto: FOTO, ...extra }, BOT)
r = await relatar('naoinscrito@c.us')
checar('não inscrito não relata → 403', r.status === 403, r)
// A foto é opcional: os dois primeiros relatos vão SEM foto, só o 3º manda foto
r = await relatar('551100000001@c.us', { foto: null })
checar('1º relato sem foto é aceito: aguardando 1/3', r.status === 201 && r.dados.situacao === 'aguardando_confirmacao' && r.dados.totalRelatos === 1, r)
const alertaId = r.dados.alerta.id_alerta
r = await relatar('551100000001@c.us')
checar('mesma pessoa de novo → 409', r.status === 409, r)
r = await relatar('551100000002@c.us', { gravidade: 'medio', foto: null })
checar('2º relato (sem foto): aguardando 2/3', r.dados.situacao === 'aguardando_confirmacao' && r.dados.totalRelatos === 2, r)
r = await relatar('551100000003@c.us', { gravidade: 'medio' })
checar('3º relato (com foto): disparado', r.dados.situacao === 'disparado' && r.dados.alerta.status === 'ativo', r)
checar('gravidade = mais relatada (médio)', r.dados.alerta.gravidade === 'medio', r.dados.alerta)
r = await relatar('551100000004@c.us')
checar('4º relato: já ativo', r.dados.situacao === 'ja_ativo', r)
r = await req('GET', `/bot/alertas/ativos?cidadeId=${taubate.id_cidade}`, undefined, BOT)
checar('bot lista alertas ativos', r.status === 200 && r.dados.alertas.some(a => a.id_alerta === alertaId && a.emoji && a.bairro === 'Centro'), r)
r = await relatar('551100000005@c.us', { tipo: 'incendio' })
checar('tipo diferente abre outro alerta', r.dados.alerta.id_alerta !== alertaId, r)

// ── Fila
r = await req('POST', '/bot/notificacoes/reservar', { limite: 50 }, BOT)
const fila = r.dados.notificacoes
const inscritosNaFila = fila.filter(n => n.tipoDestino === 'inscrito').map(n => n.destino).sort()
checar('fila: 4 inscritos (Ana, Bia, Caio + Duda que acompanha) + 1 grupo', inscritosNaFila.length === 4 && fila.filter(n => n.tipoDestino === 'grupo').length === 1 && !inscritosNaFila.includes('551100000005@c.us'), fila.map(n => n.destino))
// Caio (inscrito 3) foi o único que mandou foto — ela tem que ir em todas as notificações
checar('alerta usa a foto do 3º relato (único com foto)', fila.length > 0 && fila.every(n => /\/relato-3-/.test(n.fotoUrl ?? '')), fila.map(n => n.fotoUrl))
console.log('\n----- mensagem enviada ao inscrito -----\n' + fila.find(n => n.tipoDestino === 'inscrito').mensagem + '\n-----------------------------------------\n')
r = await req('POST', '/bot/notificacoes/reservar', {}, BOT)
checar('fila não repete o que está enviando', r.dados.notificacoes.length === 0, r)
for (const n of fila.slice(0, 3)) await req('PATCH', `/bot/notificacoes/${n.id_notificacao}`, { sucesso: true }, BOT)
await req('PATCH', `/bot/notificacoes/${fila[3].id_notificacao}`, { sucesso: false, erro: 'número inválido' }, BOT)
r = await req('POST', '/bot/notificacoes/reservar', {}, BOT)
checar('falha volta para a fila (tentativa 2)', r.dados.notificacoes.length === 1 && r.dados.notificacoes[0].tentativas === 2, r)

// ── Painel admin
token = tokenAdmin
r = await req('GET', '/alertas/listar')
checar('listar alertas', r.dados.total === 2 && r.dados.alertas.some(a => a.cidade === 'Taubaté'), r)
r = await req('GET', `/alertas/listar/${alertaId}`)
checar('detalhe alerta com relatos', r.dados.relatos?.length === 4 && r.dados.notificacoes.resumo.length > 0, r)
r = await req('GET', '/abrigos/listar')
checar('abrigo no bairro com alerta ativo → statusAlerta', r.dados.abrigos[0].statusAlerta === true, r.dados.abrigos[0])

r = await req('PATCH', `/alertas/cancelar/${alertaId}`, {})
checar('cancelar sem motivo → 400', r.status === 400, r)
r = await req('PATCH', `/alertas/cancelar/${alertaId}`, { motivo: 'Relato falso' })
checar('cancelar alerta disparado gera correções', r.status === 200 && r.dados.correcoes >= 3, r)
r = await req('PATCH', `/alertas/encerrar/${alertaId}`)
checar('encerrar alerta cancelado → 400', r.status === 400, r)

// Confirmar manualmente o alerta de incêndio (1 relato)
const incendio = (await req('GET', '/alertas/listar?tipo=incendio')).dados.alertas[0]
r = await req('PATCH', `/alertas/confirmar/${incendio.id_alerta}`)
// 4 moradores do Centro (Ana, Bia, Caio + Duda que acompanha) + o grupo da cidade
checar('admin confirma e dispara', r.status === 200 && r.dados.totalNotificacoes === 5, r)
r = await req('PATCH', `/alertas/confirmar/${incendio.id_alerta}`)
checar('confirmar de novo → 400', r.status === 400, r)
r = await req('PATCH', `/alertas/encerrar/${incendio.id_alerta}`)
checar('encerrar', r.status === 200, r)

// ── Concorrência: 3 relatos ao mesmo tempo → 1 alerta, 1 disparo
token = ''
const simultaneos = await Promise.all(['551100000001@c.us', '551100000002@c.us', '551100000003@c.us']
  .map(w => relatar(w, { tipo: 'deslizamento' })))
const ids = new Set(simultaneos.map(s => s.dados.alerta?.id_alerta))
checar('relatos simultâneos → mesmo alerta', ids.size === 1, simultaneos.map(s => s.dados))
checar('relatos simultâneos → disparado uma vez', simultaneos.filter(s => s.dados.situacao === 'disparado').length === 1, simultaneos.map(s => s.dados.situacao))

// ── Inscritos (admin)
token = tokenAdmin
r = await req('GET', `/inscritos/listar?bairroId=${centro.id_bairro}`)
checar('inscritos do Centro (moram + acompanham)', r.dados.total === 4, r.dados.inscritos?.map(i => i.nome))
const duda = r.dados.inscritos.find(i => i.nome === 'Duda')
r = await req('PUT', `/inscritos/atualizar/${duda.id_inscrito}`, { bairrosInteresse: [], ativo: false })
checar('atualizar inscrito', r.status === 200 && r.dados.inscrito.bairrosInteresse.length === 0 && r.dados.inscrito.ativo === false, r)
r = await req('GET', `/inscritos/listar/${duda.id_inscrito}`)
checar('detalhe inscrito com relatos', r.dados.relatos?.length === 1, r)
r = await req('GET', '/inscritos/listar?busca=bia')
checar('busca por nome', r.dados.total === 1, r)

// ── Exclusões bloqueadas / permitidas
r = await req('DELETE', `/bairros/excluir/${centro.id_bairro}`)
checar('excluir bairro em uso → 400', r.status === 400, r)
r = await req('DELETE', `/cidades/excluir/${taubate.id_cidade}`)
checar('excluir cidade em uso → 400', r.status === 400, r)
r = await req('DELETE', `/alertas/excluir/${alertaId}`)
checar('excluir alerta', r.status === 200, r)
r = await req('DELETE', `/inscritos/excluir/${duda.id_inscrito}`)
checar('excluir inscrito', r.status === 200, r)

// ── Token de voluntário não acessa rotas de admin
await req('POST', '/voluntarios/cadastrar', { nome: 'Vol', email: 'vol@x.com', senha: '123456', dataNascimento: '2000-01-01', genero: 'outro' })
r = await req('POST', '/voluntarios/login', { email: 'vol@x.com', senha: '123456' })
token = r.dados.token
r = await req('GET', '/alertas/listar')
checar('token de voluntário em rota admin → 403', r.status === 403, r)

// ── Voluntário se vincula a um abrigo pela Home
r = await req('GET', '/abrigos/listar')
const abrigoParaVincular = r.dados.abrigos[0]
r = await req('PATCH', '/voluntarios/me/abrigo', { abrigoId: abrigoParaVincular.id })
checar('voluntário se vincula a um abrigo', r.status === 200 && r.dados.abrigo?.nome === abrigoParaVincular.nome, r)
r = await req('GET', '/voluntarios/me')
checar('/me mostra o abrigo vinculado', r.dados.voluntario.abrigo?.id_abrigo === abrigoParaVincular.id, r)
r = await req('PATCH', '/voluntarios/me/abrigo', { abrigoId: 999999 })
checar('vincular a abrigo inexistente → 404', r.status === 404, r)
r = await req('PATCH', '/voluntarios/me/abrigo', { abrigoId: null })
checar('voluntário se desvincula', r.status === 200 && r.dados.abrigo === null, r)
token = tokenAdmin
r = await req('PATCH', '/voluntarios/me/abrigo', { abrigoId: abrigoParaVincular.id })
checar('admin não usa a rota do voluntário → 403', r.status === 403, r)

// ── Correções da planilha de testes (login nas rotas, validações, integridade)
// Sem login: rotas de gestão fecham; as usadas pelo bot/voluntário continuam abertas
token = ''
r = await req('POST', '/auth/cadastrar', { nome: 'Intruso', email: 'intruso@x.com', senha: '123456' })
checar('cadastrar admin sem login (já existe admin) → 401', r.status === 401, r)
r = await req('GET', '/vitimas/listar')
checar('listar vítimas sem login → 401', r.status === 401, r)
r = await req('GET', '/voluntarios/listar')
checar('listar voluntários sem login → 401', r.status === 401, r)
r = await req('GET', '/solicitacoes/listar')
checar('listar solicitações de abrigo sem login → 401', r.status === 401, r)
r = await req('GET', `/abrigos/listar/${abrigoId}`)
checar('detalhe do abrigo (com vítimas) sem login → 401', r.status === 401, r)
r = await req('GET', '/abrigos/listar?status=ativo')
checar('listar abrigos continua público (bot)', r.status === 200 && r.dados.abrigos.length > 0, r)
r = await req('GET', '/solicitacoes-ajuda/publico')
checar('solicitações de ajuda públicas continuam abertas', r.status === 200, r)

token = tokenAdmin
r = await req('POST', '/auth/cadastrar', { nome: 'Admin 2', email: 'adm2@teste.com', senha: '123456', cargo: 'Defesa Civil' })
checar('admin logado cadastra outro admin', r.status === 201, r)
r = await req('GET', '/auth/listar')
checar('listar admins (sem senha)', r.status === 200 && r.dados.admins.length === 2 && !('senha' in r.dados.admins[0]), r)
r = await req('POST', '/auth/cadastrar', { nome: 'Admin 3', email: 'adm3@teste.com', senha: '123' })
checar('senha de admin curta → 400', r.status === 400, r)
r = await req('POST', '/voluntarios/cadastrar', { nome: 'Vol 2', email: 'email-sem-arroba', senha: '123456', dataNascimento: '2000-01-01', genero: 'outro' })
checar('voluntário com e-mail inválido → 400', r.status === 400, r)
r = await req('POST', '/voluntarios/cadastrar', { nome: 'Vol 2', email: 'vol2@x.com', senha: '123', dataNascimento: '2000-01-01', genero: 'outro' })
checar('voluntário com senha curta → 400', r.status === 400, r)
r = await req('POST', '/solicitacoes-ajuda/cadastrar', { titulo: 'T'.repeat(121), descricao: 'x', categoria: 'doacao', abrigoId })
checar('título de solicitação com mais de 120 caracteres → 400', r.status === 400, r)

// Abrigo: capacidade negativa ou ocupada > total
r = await req('POST', '/abrigos/cadastrar', { nome: 'Escola N', cep: '12000-000', cidadeId: taubate.id_cidade, endereco: 'Rua N', tipoAbrigo: 'Escola', capacidadeTotal: -5 })
checar('abrigo com capacidade negativa → 400', r.status === 400, r)
r = await req('PUT', `/abrigos/atualizar/${abrigoId}`, { capacidadeTotal: 10, capacidadeOcupada: 11 })
checar('ocupada maior que total → 400', r.status === 400, r)
r = await req('PUT', `/abrigos/atualizar/${abrigoId}`, { capacidadeTotal: 100000 })
checar('capacidade acima de 99.999 → 400', r.status === 400, r)
r = await req('PUT', `/abrigos/atualizar/${abrigoId}`, { cep: '1234' })
checar('CEP incompleto → 400', r.status === 400, r)
r = await req('PUT', `/abrigos/atualizar/${abrigoId}`, { telefone: 'abc' })
checar('telefone do abrigo com letras → 400', r.status === 400, r)

// Vítimas: data, telefone vazio, tamanhos
const vitima = (extra) => req('POST', '/vitimas/cadastrar', { nome: 'Vitima Teste', cpf: '111.444.777-35', genero: 'Outro', dataNascimento: '2000-02-01', ...extra })
r = await vitima({ dataNascimento: 'abc' })
checar('data de nascimento inválida → 400', r.status === 400, r)
r = await vitima({ dataNascimento: '2999-01-01' })
checar('data de nascimento no futuro → 400', r.status === 400, r)
r = await vitima({ dataNascimento: '' })
checar('data de nascimento vazia → 400', r.status === 400, r)
r = await vitima({ cpf: '1'.repeat(20) })
checar('CPF comprido demais → 400', r.status === 400, r)
r = await vitima({ cpf: '222.555.888-46', telefone: '', abrigoId })
checar('1ª vítima sem telefone', r.status === 201 && r.dados.telefone === null && r.dados.dataNascimento === '2000-02-01', r)
const vitimaComAbrigo = r.dados.id
r = await vitima({ cpf: '333.666.999-57', telefone: '' })
checar('2ª vítima sem telefone (antes: erro 500)', r.status === 201, r)
r = await vitima({ cpf: '123.456.789-00' })
checar('CPF com dígito verificador errado → 400', r.status === 400, r)
r = await vitima({ cpf: '111.444.777-35', telefone: '(12) 3456' })
checar('telefone incompleto → 400', r.status === 400, r)
r = await vitima({ nome: 'X'.repeat(101) })
checar('nome com mais de 100 caracteres → 400', r.status === 400, r)
r = await req('PUT', `/vitimas/atualizar/${vitimaComAbrigo}`, { telefone: '(12) 99999-8888' })
checar('editar vítima com telefone válido', r.status === 200 && r.dados.telefone === '(12) 99999-8888', r)
r = await req('GET', `/vitimas/listar/${vitimaComAbrigo}`)
checar('data volta como AAAA-MM-DD, sem perder 1 dia', r.dados.dataNascimento === '2000-02-01', r.dados.dataNascimento)
r = await req('PUT', `/vitimas/atualizar/${vitimaComAbrigo}`, { nome: 'Vitima Teste', dataNascimento: '01/02/2000', genero: 'Outro' })
checar('editar com a data antiga DD/MM/AAAA mantém o dia', r.status === 200 && r.dados.dataNascimento === '2000-02-01', r)
r = await req('GET', `/abrigos/listar/${abrigoId}`)
const ocupadaAntes = r.dados.capacidadeOcupada
r = await req('DELETE', `/vitimas/excluir/${vitimaComAbrigo}`)
r = await req('GET', `/abrigos/listar/${abrigoId}`)
checar('excluir vítima libera a vaga do abrigo', r.dados.capacidadeOcupada === ocupadaAntes - 1, { antes: ocupadaAntes, depois: r.dados.capacidadeOcupada })

// Solicitação de abrigo: admin vem do token e aprovar 2x não duplica o abrigo
r = await req('GET', '/solicitacoes/listar?status=pendente')
const pendente = r.dados.solicitacoes[0]
r = await req('GET', '/abrigos/listar')
const totalAbrigosAntes = r.dados.abrigos.length
const aprovacoes = await Promise.all([1, 2].map(() => req('PATCH', `/solicitacoes/analisar/${pendente.id_solicitacao}`, { status: 'aprovado' })))
checar('aprovar 2x ao mesmo tempo → só uma aprova', aprovacoes.filter(a => a.status === 200).length === 1, aprovacoes.map(a => a.status))
r = await req('GET', '/abrigos/listar')
checar('aprovar 2x cria um abrigo só', r.dados.abrigos.length === totalAbrigosAntes + 1, r.dados.abrigos.length)
r = await req('GET', `/solicitacoes/listar/${pendente.id_solicitacao}`)
checar('analisadoPor = admin do token', r.dados.analisadoPor?.email === 'adm@teste.com', r.dados.analisadoPor)

// Solicitação de ajuda: criador vem do token; abrigo com solicitação não pode ser excluído
r = await req('POST', '/solicitacoes-ajuda/cadastrar', { titulo: 'Água', descricao: 'Galões', categoria: 'doacao', abrigoId, criadoPorId: 999 })
checar('solicitação de ajuda usa o admin do token', r.status === 201 && r.dados.solicitacao.criadoPorId !== 999, r)
const pedidoAjuda = r.dados.solicitacao.id_solicitacao
r = await req('DELETE', `/abrigos/excluir/${abrigoId}`)
checar('excluir abrigo com solicitação de ajuda → 409', r.status === 409, r)

// Interesse do voluntário: o id vem do token
r = await req('POST', '/voluntarios/login', { email: 'vol@x.com', senha: '123456' })
token = r.dados.token
r = await req('POST', `/solicitacoes-ajuda/interesse/${pedidoAjuda}`)
checar('voluntário marca interesse (id do token)', r.status === 201, r)
r = await req('GET', '/solicitacoes-ajuda/meus-interesses')
checar('meus interesses', r.status === 200 && r.dados.interesses.some(i => i.solicitacaoId === pedidoAjuda), r)
r = await req('DELETE', `/solicitacoes-ajuda/interesse/${pedidoAjuda}`)
checar('voluntário remove interesse', r.status === 200, r)
token = tokenAdmin
r = await req('POST', `/solicitacoes-ajuda/interesse/${pedidoAjuda}`)
checar('admin não marca interesse → 403', r.status === 403, r)

console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} TESTE(S) FALHARAM`)
process.exit(falhas ? 1 : 0)
