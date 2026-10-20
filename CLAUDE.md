# CLAUDE.md

Guia para o Claude Code trabalhar neste repositório. Responda e escreva comentários em **português (pt-BR)**, como o restante do código.

## O projeto

**SOS Vale** é um protótipo acadêmico (Projeto Integrador I – Fatec) de plataforma de assistência a vítimas de desastres naturais no **Vale do Paraíba** (foco em Taubaté, Caçapava e Pindamonhangaba). Ele junta informações de abrigos, pessoas acolhidas, regiões de risco, voluntários, pedidos de ajuda e alertas de ocorrências enviados pelos moradores.

Três processos independentes, cada um com seu próprio `package.json` / `node_modules` (a raiz **não** tem `package.json`):

| Pasta | Stack | Papel |
|---|---|---|
| `Backend/` | Node (ESM) + Fastify 5 + Prisma 6 + PostgreSQL (Supabase) + Supabase Storage + `@fastify/jwt` + bcrypt | API REST na porta **3000** |
| `Frontend/` | React 19 + Vite 8 + React Router 7 + Leaflet/React-Leaflet + react-icons | Painel web (admin, voluntário, mapa) na porta 5173 |
| `ChatBot/` | Node (ESM) + whatsapp-web.js | Bot de WhatsApp para a população (fala só com a API, sem acesso direto ao banco) |
| `Documentações/` | docx/pptx/pdf | Visão de projeto, atas de reunião, sprints (não é código) |

`SOS_Vale_Analise_e_Backlog.pdf` (raiz) é uma análise técnica de 10/09/2026 com code review (CR01–CR15), roadmap e backlog (SEC/DAT/API/UI/US…). Use-o como referência de prioridades.

## Comandos

```bash
# Instalar (em cada pasta separadamente)
cd Backend && npm install
cd Frontend && npm install
cd ChatBot && npm install

# Rodar API + Front juntos (de Backend/ OU de Frontend/ — escolha só um)
npm run dev

# Separadamente
cd Backend && npm run back        # node src/server.js  → http://localhost:3000
cd Frontend && npm run front      # vite                → http://localhost:5173
cd ChatBot && node index.js       # pede QR Code no 1º uso; sessão em .wwebjs_auth/

# Frontend
npm run lint | npm run build | npm run preview

# Banco (Backend/)
npx prisma generate
npx prisma migrate dev --name <nome_descritivo>   # cria nova migração
npx prisma migrate deploy                         # aplica migrações pendentes
npm run seed                                      # só cadastra tipos de Deficiência (estados vêm da migração)
```

```bash
# Testes (banco Postgres em memória via PGlite — nunca toca no Supabase)
cd Backend && npm run banco:teste     # terminal 1: banco de teste na porta 5433, com dados de exemplo (admin adm@teste.com/123456)
cd Backend && npm run banco:teste:vazio  # idem, mas vazio — exigido pelo teste:api
cd Backend && npm run back:teste      # terminal 2: API em modo teste (recusa subir se a API normal estiver aberta)
cd Backend && npm run teste:api       # terminal 3: 107 verificações da API (recusa rodar contra a API real)
cd ChatBot && npm run teste:conversa  # simula conversas do WhatsApp (roteiro fixo; rodar depois do teste:api)
cd ChatBot && npm run teste:interativo  # você digita as mensagens (/foto, /numero, /grupo, /fila, /sair)
# Portas ocupadas? BANCO_TESTE_PORTA=5434 e PORT=3100 (no banco:teste/back:teste) + API_URL=http://127.0.0.1:3100 (nos testes)

# Antes de aplicar migrações no Supabase
cd Backend && npm run backup                              # exporta as tabelas para backups/ (gitignored)
cd Backend && npm run ensaiar-migracao -- backups/<pasta> # aplica as pendentes numa cópia com os dados reais

# Dados de demonstração no banco NORMAL (para apresentar sem o modo teste)
cd Backend && npm run demo:dados      # cria sem duplicar; rode de novo antes de apresentar (renova o alerta 2/3)
cd Backend && npm run demo:remover    # apaga só o que o demo:dados criou (moradores 5500..., vítimas com telefone "(00) 9...")
cd Backend && npm run demo:conferir   # só confere: ocupação de cada abrigo × vítimas vinculadas
```

- `npm test` do backend não existe; os testes são os scripts acima. Rode `teste:api` sempre com o `banco:teste:vazio` recém-aberto (o teste cria os próprios dados e recusa rodar se o banco já tiver cidades). `Backend/route.http` tem requisições manuais de exemplo (extensão REST Client).
- A `DIRECT_URL` (`db.<projeto>.supabase.co`) só funciona com IPv6. Se `prisma migrate` der P1001, rode com a URL do *session pooler*: `DIRECT_URL="$DATABASE_URL" npx prisma migrate deploy` (Git Bash).
- Não há CI, Docker nem deploy configurados.

## Variáveis de ambiente

Veja `Backend/.env.example` e `ChatBot/.env.example`.
- `Backend/.env`: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_KEY`, `BOT_API_KEY` (+ opcionais `ALERTA_CONFIRMACOES_MINIMAS`=3, `ALERTA_JANELA_HORAS`=6, `PORT`).
- `ChatBot/.env`: `BOT_API_KEY` (mesmo valor do backend), opcional `API_URL`.
- Frontend: todas as telas usam a URL de `src/services/api.js` (`API_URL` = `VITE_API_URL` ou `http://localhost:3000`).

⚠️ `ChatBot/.env` está versionado no git. Nunca exiba, copie ou comite valores de `.env`.

## Arquitetura

### Backend (`Backend/src/`)
- `server.js` registra CORS, JWT e três autenticadores: `app.authenticate` (qualquer token), `app.authenticateAdmin` (token com `tipo: 'admin'`, gerado em `/api/auth/login`) e `app.authenticateBot` (cabeçalho `x-bot-key` igual ao `BOT_API_KEY`).
- Prefixos: `/api/auth` (admin), `/api/abrigos`, `/api/estados`, `/api/cidades`, `/api/bairros`, `/api/vitimas`, `/api/solicitacoes` (solicitação de **abrigo**), `/api/voluntarios`, `/api/solicitacoes-ajuda`, `/api/alertas` (admin), `/api/inscritos` (admin), `/api/mapa` (qualquer login: alertas ativos para o mapa), `/api/bot` (só o ChatBot).
- Cada arquivo em `routes/` é um plugin Fastify. **Todos usam o mesmo cliente do banco:** `import prisma from '../lib/prisma.js'` (nunca `new PrismaClient()` num arquivo de rota — isso estourava o limite de conexões do Supabase, erro `EMAXCONN`). Lógica compartilhada fica em `src/lib/`: `localizacao.js` (select/achatamento de cidade-estado-bairro, ViaCEP), `alertas.js` (regras de relato, disparo, cancelamento e textos das mensagens), `inscritos.js`, `armazenamento.js` (upload no Supabase).
- Convenção de endpoints: `POST /cadastrar`, `GET /listar`, `GET /listar/:id`, `PUT /atualizar/:id`, `DELETE /excluir/:id`. Solicitação de abrigo usa `POST /criar` e `PATCH /analisar/:id`. Leituras de regiões são públicas; escrita exige admin.
- Respostas de erro usam `{ mensagem: '...' }`.
- Fotos chegam em **base64** e vão para o Supabase Storage (buckets `fotos-abrigo`, `fotos-vitima`, `fotos-alerta`). Limite de corpo = 1 MiB, exceto `POST /api/bot/alertas/relatar` (15 MiB).
- `routes/doacao.js` é **legado** (não registrado). `middlewares/autenticar.js` não é usado.

### Banco (`Backend/prisma/schema.prisma` — fonte de verdade)
- **Regiões:** `Estado` (27 UFs cadastradas pela migração) → `Cidade` (`grupoWhatsappId` = grupo que recebe os alertas) → `Bairro` (`nivelRisco` enum, população, área). `Abrigo` e `SolicitacaoAbrigo` têm `cidadeId` (obrigatório) e `bairroId` (opcional). A API continua devolvendo `cidade`/`estado`/`bairro` **como texto** para não quebrar as telas — ao incluir um abrigo em outra consulta, use `selectLocalizacao` + `achatarLocalizacao`.
- **Alertas:** `InscritoAlerta` (morador inscrito pelo bot, `whatsappId` único, bairro onde mora) + `InscritoBairro` (bairros acompanhados) → `RelatoAlerta` (um por pessoa por alerta) → `Alerta` (`em_verificacao` → `ativo` → `encerrado`/`cancelado`) → `Notificacao` (fila de saída do WhatsApp).
- Demais models: `Admin`, `Vitima`, `Deficiencia`, `VitimaDeficiencia` (N:N), `Voluntario`, `SolicitacaoAjuda`, `SolicitacaoAjudaInteresse`.
- PKs seguem o padrão `id_<entidade>` — **exceto** `Admin.id` e `SolicitacaoAjudaInteresse.id`.
- `Abrigo.capacidadeOcupada` é um contador mantido manualmente ao vincular/desvincular vítimas.
- O histórico de migrações contém drops/recriações; revise o SQL gerado antes de aplicar em banco com dados.

### Sistema de alertas (fluxo)
1. O morador se inscreve pelo bot (nome, e-mail, bairro). Se o bairro não está na lista, informa o CEP → ViaCEP → bairro e cidade são criados.
2. Relato = perguntas fechadas (local, tipo, gravidade) + foto opcional (o morador digita *pular* para seguir sem foto). Não há texto livre. O alerta disparado usa a foto mais recente entre todos os relatos (se só o 3º mandou foto, vai a dele); sem nenhuma foto, vai só o texto.
3. Relatos do mesmo tipo no mesmo bairro entram no mesmo `Alerta` (dentro da janela `ALERTA_JANELA_HORAS`). A trava `pg_advisory_xact_lock(bairro, tipo)` evita alertas ou disparos duplicados.
4. Com `ALERTA_CONFIRMACOES_MINIMAS` pessoas diferentes (ou confirmação do admin) o alerta vira `ativo` e gera `Notificacao` para quem mora ou acompanha o bairro + o grupo da cidade.
5. O bot reserva a fila (`POST /api/bot/notificacoes/reservar`), envia e reporta (`PATCH /api/bot/notificacoes/:id`); falhas são repetidas até 3 vezes. Cancelar um alerta ativo envia uma mensagem de correção a quem recebeu.

### Frontend (`Frontend/src/`)
- Rotas em `App.jsx`; uma pasta por página em `pages/<modulo>/<Pagina>/index.jsx` + CSS ao lado.
- **Visual (tema "vidro"):** todas as telas usam `styles/sosvale-glass.css` (tokens `--sv-*` e peças `sv-*`: página, cards, botões, campos, tabelas, listas, modal, gaveta, avisos). A referência de como uma tela deve ficar é `pages/PgAdmGlass/`. Esqueleto de tela com menu: `<div className="sv-app sv-pagina">` + `<div className="sv-fundo">` + `<SidebarGlass />` + `<main className="sv-main">`, com `sv-topo` / `sv-trilha` / `sv-titulo` / `sv-subtitulo` no cabeçalho. Telas públicas e de login: `sv-app sv-publica` + `sv-publica-card`, com o logo `assets/logo-sosvale.png`. Antes de criar CSS novo, procure a peça no tema; se faltar, crie lá com o prefixo `sv-`.
- **Identidade:** azul (`--sv-azul`) para a ação principal, vermelho do logo (`--sv-sirene`) para marca, ações destrutivas, urgência e erro; verde e âmbar (`--sv-ok`, `--sv-atencao`) só como cor de estado. Ícones de `react-icons/lu`, sem emojis (ícone por tipo de alerta: `utils/alertas.jsx`). Fontes Lexend (títulos e números) e Figtree (texto).
- **Listagens com filtros e cards** (Hub de Abrigos, Hub de Vítimas, Abrigos do voluntário) usam `styles/listagem.css` (classes `lg-*` dentro de `.pagina-listagem`) e `utils/listagem.jsx` (estruturas do abrigo, ocupação, busca sem acento). Siga esse padrão em novas telas de listagem, dentro do esqueleto do tema.
- **Voluntário:** Home (`/painel-voluntario`: solicitações de ajuda abertas + últimas contribuições; `?aba=perfil` = Meu perfil) e Abrigos (`/voluntario/abrigos`: filtros e botão Vincular → `PATCH /api/voluntarios/me/abrigo`, via `services/voluntario.js`). O voluntário não vê alertas (nem no mapa).
- **Sidebar:** use sempre `components/SidebarGlass/SidebarGlass.jsx`: `<SidebarGlass ativo="abrigos" />` nas telas do admin e `<SidebarGlass modulo="voluntario" ativo="abrigos" />` nas do voluntário. Para mudar um item do menu, mude só a lista dentro do componente (`itensMenu` / `itensMenuVoluntario`). O "Sair" do admin vai para `ROTA_LOGIN` (`/login-adm`); o do voluntário volta para `/`. O item "Administradores" leva à tela `pages/administradores` (um admin cadastra outro). O Mapa serve os dois módulos (`/mapa` e `/voluntario/mapa`, prop `modulo`).
- **Home do admin:** `/pg_adm` abre `pages/PgAdmGlass`. A home antiga (`pages/pg_adm`), `SidebarAdm.jsx` e `SidebarVoluntario.jsx` continuam no repositório, mas sem uso — não use em telas novas.
- Chamadas à API: `services/api.js` tem `fetchAdmin` (igual ao `fetch`, mas com `API_URL` + `token_adm`; volta ao login em 401 — usado nas telas antigas e na home) e `apiAdmin` (também lança erro se a resposta não for ok — usado em `alertas/`, `inscritos/`, `regioes/Gerenciar-Regioes`, `administradores`); `services/voluntario.js` tem `fetchVoluntario` (`token_voluntario`). Rotas protegidas na API precisam de um desses — `fetch` cru só para rotas públicas. Estado → Cidade → Bairro: `components/SeletorLocalidade.jsx` (também usado nos formulários de abrigo). `pages/alertas/alertas.css` guarda só as peças próprias desses módulos (cards de resumo, filtros, relatos, regiões); botões, linhas, etiquetas, avisos e tabelas vêm do tema.
- **Modais e gavetas** usam `position: fixed`: não coloque `container-type` nem `contain` no `sv-main` (isso prende o modal à área de conteúdo em vez da tela). Para ajustes por largura, use `@media`.
- CSS antigo sem uso (não importado por nenhuma tela): `index.css` (só carregado pelo `main.jsx`), `pg_adm/style.css`, `DetalhesAbrigo.css`, `DetalhesSolicitacao.css`, `DetalhesVitima.css`, `CadastroAbrigo.css` e `vitima.css`.
- **Formulários:** limites, máscaras e exemplos ficam em `utils/campos.js` (os mesmos limites da API em `Backend/src/lib/validacao.js` — mude os dois juntos). Marque os rótulos com `components/MarcasCampo.jsx` (`<Obrigatorio />`, `<Opcional />`, `<AvisoObrigatorios />`, `<ContadorCaracteres />`; estilos `sv-campo-obrigatorio`, `sv-contador`… no tema). Todo `<label>` com `htmlFor` ligado ao `id` do campo.
- Autenticação: tokens em `localStorage` (`token_adm`, `token_voluntario`, `voluntario`). As rotas do admin e do voluntário ficam dentro de `components/RotaProtegida.jsx` no `App.jsx` (sem login válido do tipo certo, volta ao login); endereço inexistente, `/login` e `/cadastro` levam para `/`. Mapa via Leaflet + geocodificação no navegador com Nominatim.

### ChatBot (`ChatBot/`)
- `index.js` → `controllers/message-controller.js`: ignora status e grupos (em grupos só responde `!alertas ...`, ver `grupo-controller.js`); `oi`/`menu` sempre voltam ao menu; depois despacha para os fluxos conforme `state.step` (`alerta_*`, `help_*`, `psycho_*`, `sol_*`).
- `alerta-flow.js`: inscrição, gerenciar bairros, relato. `services/api.js` (cliente da API com `x-bot-key`), `services/notificacao-service.js` (envia a fila a cada 15s), `services/midia.js` (download de fotos).
- **whatsapp-web.js 1.34.7 tem um bug no envio de mídia** desde a atualização do WhatsApp Web de 17/09/2026 (`Data passed to getter must include an id property`). `ChatBot/scripts/corrigir-wwebjs-midia.cjs` roda no `postinstall` e aplica a correção (`delete message.__x_id`) em `node_modules`. Se a foto ainda falhar, o `notificacao-service` manda o texto com o link da foto.
- Contatos novos chegam como `123...@lid` (código interno), não `55...@c.us`. Para o número real use `numeroReal()` de `services/telefone.js`; ao ligar, o bot corrige inscritos antigos que ficaram com o código no lugar do telefone.
- Escolha de bairro no bot: a pessoa digita o **CEP ou o nome** do bairro (comparação sem acento/maiúscula); não há listas de cidades/bairros.
- Menu: 1 = alertas do bairro (inscrição, relatar, entrar no grupo da cidade pelo link, bairros acompanhados), 5 = alertas ativos agora. Os fluxos de apoio (2) e psicológico (4) ainda salvam só em memória (`registroService.js`).
- Mensagens seguem o padrão de `utils/formato.js` (título com emoji + separador, opções 1️⃣ 2️⃣, rodapés). Saudações (`oi`, `oii`, `olá`, `OLAA`, `bom dia`...) abrem o menu em qualquer etapa (`ehSaudacao`); `cancelar` desiste de qualquer fluxo.
- Link do grupo de cada cidade: `Cidade.grupoWhatsappLink`, editado no painel (Regiões); o bot lê em `GET /api/bot/cidades/grupos`.
- Atenção: os pedidos do bot **não** são `SolicitacaoAjuda` — esta é uma necessidade criada pelo admin para um abrigo.

## Problemas conhecidos (do relatório de análise)

Considere-os ao mexer nas áreas afetadas; não "conserte" por conta própria fora do escopo pedido, mas avise se a mudança tocar neles.
Já corrigidos pela planilha de testes (`Documentações/RELATORIO-CORRECOES-TESTES.md`): rotas de gestão exigem admin, cadastro de admin fechado depois do primeiro, admin/voluntário vêm do token (fim dos IDs fixos), aprovação de solicitação e exclusão/edição de vítima em transação, filtros da home, `/login` e `/cadastro` descontinuadas. Ainda pendentes:
- **Segurança:** `GET /api/abrigos/listar` e `POST /api/solicitacoes/criar` continuam abertas de propósito (ChatBot e voluntário); a rota de criação não valida capacidade nem tamanho dos campos (item F do relatório).
- **Transações:** o cadastro de vítima já vinculada a um abrigo ainda incrementa `capacidadeOcupada` fora da transação.
- **Navegação:** links para rotas inexistentes (`/login_voluntario`, `/abrigos/:id`, `/voluntario`…) podem existir em telas antigas.
- **UI otimista:** algumas telas antigas ainda mostram sucesso sem checar `response.ok`.
- **Fotos no modo teste:** as rotas de abrigo e vítima enviam a foto direto ao Supabase (não usam `armazenamento.js`), então no `back:teste` o cadastro com foto responde "erro ao salvar a foto".
- **Dependências:** `fastify`, `@fastify/jwt`, `@prisma/client` e `dotenv` estão em `devDependencies` do backend.

Ordem de prioridade sugerida pelo relatório: segurança → integridade de dados → contratos/navegação → testes/CI.

## Convenções

- JavaScript ES Modules em tudo (`"type": "module"`); sem TypeScript (exceto `prisma/seed.ts`).
- Nomes de domínio, variáveis, rotas e mensagens em português, sem acento em identificadores (`abrigo`, `vitima`, `capacidadeTotal`, `possuiPets`).
- Comentários explicativos em português são comuns e bem-vindos (projeto acadêmico); mantenha o estilo do arquivo.
- Ao criar rota nova: novo plugin em `Backend/src/routes/`, registrar em `server.js` com prefixo `/api/...`, seguir o padrão de verbos acima e adicionar exemplo em `route.http`. Rotas administrativas novas devem usar `app.authenticateAdmin`.
- Ao alterar o schema: gerar migração com nome descritivo e rodar `npx prisma generate`. O bot não usa Prisma — se ele precisar de dados novos, crie uma rota em `/api/bot`.
- Ao criar página: pasta em `Frontend/src/pages/...`, registrar em `App.jsx` respeitando a caixa exata do caminho, importar `styles/sosvale-glass.css` e usar o esqueleto do tema com o `SidebarGlass` do módulo. Confira em 390px de largura: sem rolagem lateral, tabelas dentro de `sv-tabela-caixa`.
- Ambiente de desenvolvimento é Windows; os commits são feitos direto na `main` pela equipe.
