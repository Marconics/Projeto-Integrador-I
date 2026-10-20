# Relatório de correções — Planilha de testes do S.O.S Vale

**Projeto:** S.O.S Vale (Projeto Integrador I)
**Data:** 25/09/2026
**Origem das falhas:** planilha de testes elaborada por outro grupo, a partir da leitura do código

---

## 1. Resumo

Outro grupo analisou o código do S.O.S Vale e registrou 24 falhas numa planilha de testes. Como a análise foi feita **só lendo o código, sem executar o sistema**, cada item foi primeiro conferido no código-fonte antes de qualquer correção.

| Resultado da verificação | Quantidade |
|---|---|
| Confirmados | 22 |
| Confirmados em parte | 2 (itens 45 e 53) |
| Não procedem | 0 |
| Problemas relacionados encontrados durante a verificação | 6 (A a F) |

Todos os 24 itens foram corrigidos, e também 5 dos 6 problemas relacionados. Nenhuma correção exigiu alterar a estrutura do banco de dados (sem migrações).

Os testes automáticos da API terminaram com **96 de 96 verificações aprovadas**: 67 que já existiam e 29 novas, criadas para cobrir estas correções.

---

## 2. Metodologia

O trabalho foi dividido em duas etapas. A equipe revisou o resultado ao fim de cada uma.

**Etapa 1: verificação, sem alterar nada.**
Para cada item da planilha, abrimos os arquivos citados e registramos:
- o veredito (confirmado, parcial ou não procede);
- a evidência (arquivo e linha);
- a correção proposta.

Nessa etapa também tomamos quatro decisões de projeto, descritas na seção 4.

**Etapa 2: correção.** Regras seguidas:
- **Ordem de prioridade:** segurança, depois integridade dos dados, depois validações e, por último, navegação e usabilidade.
- **Menor mudança possível:** sem reescrever telas nem alterar o visual.
- **Nada que funcionava podia parar de funcionar.** Ao proteger uma rota da API, conferimos todas as telas e o ChatBot que a usam.
- **Validação dupla:** na tela, para orientar o usuário, e na API, que é quem garante a regra.
- **Verificação final:** o lint do Frontend, o build de produção e a suíte de testes da API sobre um banco vazio em memória.

---

## 3. Itens da planilha: veredito e correção

### 3.1 Segurança

| Item | Veredito | Problema confirmado | Correção |
|---|---|---|---|
| 2 | Confirmado | As telas do administrador abriam sem login, inclusive depois de "Sair". As rotas da API de abrigos, vítimas, voluntários e solicitações não exigiam token. | **Telas:** guarda de rota (`RotaProtegida`) confere se há login do tipo certo e dentro da validade. **API:** as rotas de gestão passaram a exigir login de administrador. As telas passaram a enviar o token por uma função única (`fetchAdmin`). |
| 48 | Confirmado | `POST /api/auth/cadastrar` não exigia login: qualquer pessoa criava um administrador. | A rota só fica aberta enquanto não existe nenhum administrador (instalação nova). Depois disso, só um administrador logado cadastra outro, pela nova tela **Administradores**. |
| 49 | Confirmado | As listagens de vítimas e voluntários expunham CPF, telefone e e-mail sem login (LGPD). | Resolvido pelo item 2: essas rotas exigem login de administrador. |
| 50 | Confirmado | A tela do voluntário usava `VOLUNTARIO_LOGADO_ID = 1` fixo: todo interesse era gravado no voluntário 1. | A API identifica o voluntário pelo token de login, e a tela deixou de enviar o id. |
| 17/18 | Confirmado | `criadoPorId: 1` e `adminId: 1` estavam fixos nas telas, e a API aceitava o valor vindo do navegador. | A API usa o administrador do token (`request.user.id`) e ignora o que vier da tela. |

### 3.2 Integridade dos dados

| Item | Veredito | Problema confirmado | Correção |
|---|---|---|---|
| 51 | Confirmado | Ao aprovar uma solicitação de abrigo, o abrigo era criado fora de uma transação. Uma falha no meio, ou dois cliques, geravam abrigos duplicados. | Transação que só aprova se a solicitação ainda estiver "pendente". Foi testado com duas aprovações simultâneas: só uma cria o abrigo. |
| 52 | Confirmado | Ao excluir uma vítima, a vaga no abrigo era liberada antes do delete e fora de transação. Se o delete falhasse (vítima com deficiência cadastrada), a ocupação ficava errada. | Transação única: remove as deficiências, a vítima e libera a vaga. A foto só é apagada depois. A tela confere a resposta. |
| 16 | Confirmado | Excluir um abrigo com solicitações de ajuda gerava erro 500, a foto já tinha sido apagada e a tela voltava como se tivesse excluído. | A API responde 409 com a explicação do motivo, e a foto só é apagada após a exclusão. A tela mostra a mensagem e permanece no abrigo. |
| 3 | Confirmado | Telefone vazio era enviado como `""` numa coluna única, então a 2ª vítima sem telefone dava erro 500. A mensagem de erro aparecia em verde. | Telefone vazio vira `null` (na tela e na API). Mensagem de erro em vermelho. |
| 47 | Confirmado | A API devolvia a data de nascimento no fuso do servidor (−3h), então a data perdia 1 dia. O campo de data ficava vazio e, ao salvar, gravava o dia anterior. | A API devolve AAAA-MM-DD em UTC, e a tela converte para DD/MM/AAAA só ao exibir. Vale para vítima e voluntário. |

### 3.3 Validações

| Item | Veredito | Problema confirmado | Correção |
|---|---|---|---|
| 24 | Confirmado | A data de nascimento aceitava datas futuras. | O campo ganhou `max` com a data de hoje, e a API recusa data futura. |
| 26 | Confirmado | Uma data com formato inválido gerava erro 500. | A API valida a data (inclusive casos como 31/02) e responde 400 com mensagem. |
| 34 | Confirmado | A capacidade do abrigo aceitava valores negativos. | `min="0"` nos campos. A API exige número inteiro ≥ 0 e ocupada ≤ total. |
| 40 | Confirmado | CPF (14) e telefone (15) sem limite na tela; valores maiores davam erro 500. | `maxLength` nos campos. A API responde 400 com mensagem. |
| 45 | Parcial | Data de nascimento e gênero não eram obrigatórios no cadastro de vítima, e a data vazia gerava erro 500. *Parte exagerada:* a planilha diz que "nenhum formulário marca campos obrigatórios", mas dois formulários já marcavam. | Campos obrigatórios no formulário e na API, marcados com "*". |
| 8 | Confirmado | A tela aceitava fotos de 2 MB, mas a API limitava a 1 MB, o que gerava o erro 413. A tela não mostrava o erro porque lia `mensagem` e o servidor devolvia `message`. | Limite de 4 MB nas rotas com foto. Todo erro não tratado passa a ser devolvido como `{ mensagem }`. |

### 3.4 Navegação e usabilidade

| Item | Veredito | Problema confirmado | Correção |
|---|---|---|---|
| 1 | Confirmado | O login de administrador não mostrava erro com senha incorreta. | A mensagem da API aparece na tela. |
| 4 | Confirmado | Os filtros Município e Período do painel não filtravam nada, e o card "Novas solicitações" contava todas as solicitações. | Os filtros passaram a valer para os cards, as atividades e o gráfico. O card mostra só as pendentes. |
| 6 | Confirmado | "Sou Munícipe" apontava para `#`, as telas `/login` e `/cadastro` estavam órfãs e não havia rota para endereço inexistente. | Botão desabilitado com o texto "Em breve". As telas de teste foram movidas para `pages/descontinuada`. Endereços inexistentes voltam para a tela inicial. |
| 7 | Confirmado | A tela de cadastro usava ícones sem importá-los, e a página ficava em branco. | Imports corrigidos. A tela foi descontinuada (item 6). |
| 19 | Confirmado | Telas de entrada com imagens sem texto alternativo, rótulos não ligados aos campos e links que não funcionavam pelo teclado. | Texto alternativo (`alt`) nas imagens, rótulos ligados aos campos (`htmlFor`) e links de verdade (`<Link>`) no lugar de `<span onClick>`. |
| 20 | Confirmado | A logo usava o caminho `src/assets/logo.png`, que funciona em desenvolvimento, mas quebra no build. | Logo importada pelo sistema de módulos, como já fazia o menu lateral. |
| 53 | Parcial | Cancelar a janela de seleção de foto gerava erro no console. *Ressalva:* só acontece em alguns navegadores e situações, por exemplo no Chrome, após uma foto ser recusada por tamanho. | A função ignora a seleção vazia, nas 4 telas com foto. |
| 12 | Confirmado | 16 arquivos com `http://localhost:3000` fixo. | Todas as telas usam `API_URL`, que é configurável por `VITE_API_URL`. |

---

## 4. Decisões tomadas pela equipe

| Decisão | Motivo |
|---|---|
| A listagem pública de abrigos (`GET /api/abrigos/listar`) continua aberta. | O ChatBot e o módulo do voluntário usam essa rota, e ela traz só os dados do abrigo. O detalhe do abrigo, que inclui as vítimas, passou a exigir login de administrador. |
| O envio de solicitação de abrigo (`POST /api/solicitacoes/criar`) continua aberto. | É por essa rota que o ChatBot envia os pedidos dos cidadãos. |
| As telas `/login` e `/cadastro` foram mantidas, mas descontinuadas. | Eram testes de layout sem lógica. Os arquivos foram preservados em `pages/descontinuada` e os endereços redirecionam para a tela inicial. |
| O botão "Sou Munícipe" fica "Em breve". | O módulo do munícipe ainda não existe; hoje o cidadão usa o bot do WhatsApp. |
| Foi criada a tela **Administradores**. | Com o cadastro de administradores protegido, era preciso um meio de um administrador cadastrar outros. |

---

## 5. Problemas adicionais encontrados

Durante a verificação e os testes apareceram falhas que não estavam na planilha, mas eram ligadas aos itens dela.

| Id | Problema | Situação |
|---|---|---|
| A | Vincular ou desvincular uma vítima de um abrigo reenviava a data já deslocada, e **cada operação tirava 1 dia da data de nascimento**. | Corrigido junto com o item 47. |
| B | Algumas telas exibiam datas com 1 dia a menos por causa do fuso horário. | Corrigido: as datas são exibidas em UTC. |
| C | A edição de vítima transformava telefone vazio em `""`, o mesmo erro do item 3. | Corrigido na API. |
| D | No módulo do voluntário, o mapa buscava os alertas com o token do administrador, então o voluntário nunca via os alertas. | Corrigido. |
| E | Excluir solicitações e desvincular vítimas não conferiam a resposta da API. | Corrigido. |
| F | A rota usada pelo ChatBot para enviar solicitações de abrigo não valida capacidade nem tamanho dos campos. | **Pendente**: deixado como está para não alterar o comportamento do bot. |
| — | Excluir uma solicitação de abrigo já aprovada apagava a foto usada pelo abrigo criado a partir dela. | Corrigido. |
| — | O código gerado do Prisma estava desatualizado desde a última alteração do banco, e **o cadastro de cidades dava erro 500**. | Resolvido com `npx prisma generate`. Cada integrante precisa rodar esse comando na pasta `Backend`. |

---

## 6. Verificação

| Verificação | Resultado |
|---|---|
| Lint do Frontend (`npm run lint`) | 0 erros. Há 1 aviso, que já existia antes das correções. |
| Build de produção (`vite build`) | Concluído sem erros. |
| Testes da API (`npm run teste:api` com `banco:teste:vazio`) | **96/96 aprovados**: 67 existentes, nenhum precisou de ajuste, e 29 novos. |

As 29 verificações novas cobrem:
- rotas fechadas sem login;
- rotas do ChatBot e do voluntário que continuam abertas;
- cadastro de administrador (sem login e com login);
- capacidade negativa;
- datas inválidas, futuras e vazias;
- CPF longo demais;
- duas vítimas sem telefone;
- data que não perde 1 dia;
- liberação de vaga ao excluir vítima;
- aprovação simultânea;
- administrador vindo do token;
- exclusão de abrigo bloqueada;
- interesse do voluntário pelo token.

**Limitação:** os testes automáticos cobrem a API. As telas foram verificadas por lint e build, mas **o roteiro do Anexo A ainda precisa ser executado manualmente no navegador**.

---

## 7. Funcionalidades não implementadas

A planilha apontou funcionalidades que não existem no sistema. Elas ficaram fora deste trabalho, que se limitou a corrigir falhas. Segue a estimativa de esforço:

| Funcionalidade | Esforço estimado | Observação |
|---|---|---|
| Exportar para XLS/CSV | cerca de 1 dia | Biblioteca SheetJS, reaproveitando as listas já filtradas nas telas. |
| Exportar para PDF | 1 a 2 dias | jsPDF com autotable. O maior esforço é o layout do relatório. |
| Recuperar senha | 1,5 a 2 dias | Exige alterar o banco (tabela de códigos de recuperação), um serviço de e-mail e duas telas novas. |
| Login com Google/Facebook | 3 a 5 dias | Exige registrar o aplicativo em cada serviço, validar o login na API e alterar o banco. O Facebook exige revisão do aplicativo. Recomendado apenas para voluntários. |
| Manual do usuário | 1 a 2 dias | Só redação, sem alteração de código. |

---

## Anexo A — Roteiro de teste no navegador

Preparação, em três terminais na pasta `Backend`, mais um na pasta `Frontend`:

```
npm run banco:teste      (Backend)
npm run back:teste       (Backend)
npm run front            (Frontend)
```

Acesse `http://localhost:5173/login-adm` com `adm@teste.com` / `123456`.

| # | Ação | Resultado esperado |
|---|---|---|
| 1 | Entrar com senha errada | Mensagem de erro em vermelho |
| 2 | Clicar em "Sair" e digitar `/vitimas` na barra de endereço | Volta para a tela de login |
| 3 | Menu **Administradores**: cadastrar um novo administrador | Ele consegue entrar em outra aba |
| 4 | Cadastrar duas vítimas sem telefone | As duas são salvas |
| 5 | Tentar uma data de nascimento futura ou um CPF longo | O formulário impede |
| 6 | Editar uma vítima e salvar sem mudar a data | A data continua a mesma |
| 7 | Excluir um abrigo que tem solicitação de ajuda | Alerta explicando o motivo; o abrigo não é excluído |
| 8 | Clicar duas vezes rápido em "Aprovar" numa solicitação de abrigo | Só um abrigo é criado |
| 9 | Painel: trocar Município e Período | Os números mudam |
| 10 | Como voluntário, marcar interesse; entrar como outro voluntário | O interesse aparece só para o primeiro |
| 11 | Abrir `/cadastro` ou um endereço inexistente | Volta para a tela inicial |
| 12 | Enviar uma foto de até 2 MB | A foto é salva |

## Anexo B — Arquivos alterados

**Backend**
- `src/server.js`
- `src/lib/validacao.js` (novo)
- `src/routes/auth.js`
- `src/routes/abrigos.js`
- `src/routes/vitima.js`
- `src/routes/voluntario.js`
- `src/routes/solicitacao_abrigo.js`
- `src/routes/solicitacao_ajuda.js`
- `testes/api.teste.mjs`

**Frontend**
- Estrutura geral:
  - `src/App.jsx`
  - `src/components/RotaProtegida.jsx` (novo)
  - `src/components/SidebarAdm.jsx`
  - `src/services/api.js`
  - `src/services/voluntario.js`
- Telas de entrada: `sosvale`, `login_adm`, `login-voluntario`, `cadastro-voluntario`
- Painel: `pg_adm`
- Vítimas: `Cadastro-Vitima`, `Detalhes-Vitima`, `Hub-Vitimas`
- Abrigos: `Cadastrar-Abrigo`, `Detalhes-Abrigo`, `Vitimas-Abrigo`
- Solicitações de abrigo e de ajuda: 7 telas
- Mapa: `regioes/mapa`
- Telas novas: `pages/administradores` (nova) e `pages/descontinuada` (telas movidas)
