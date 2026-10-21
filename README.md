# 🌧️ S.O.S Vale — Apoio a vítimas de desastres naturais no Vale do Paraíba

Protótipo acadêmico do **Projeto Integrador I (Fatec)**. O S.O.S Vale junta, num só lugar, as informações que importam durante enchentes, deslizamentos e outros desastres na região de **Taubaté, Caçapava e Pindamonhangaba**:

- abrigos (vagas, estrutura, responsáveis e pedidos de ajuda);
- pessoas acolhidas (vítimas) e suas necessidades, como deficiências;
- regiões de risco (estados, cidades e bairros);
- voluntários;
- **alertas de ocorrências** enviados pelos próprios moradores pelo WhatsApp.

O sistema tem três partes: um **painel web** (administrador e voluntário), uma **API** e um **bot de WhatsApp** para a população.

---

## ⚙️ Funcionalidades

### Painel do administrador
- **Visão geral** com os números principais e atalhos; **mapa da região** com abrigos e alertas ativos.
- **Abrigos:** cadastro com foto, estrutura (atendimento médico, enfermagem, pets, acessibilidade, cozinha), ocupação, filtros e detalhes. O card avisa quando o bairro do abrigo está em estado de alerta.
- **Vítimas:** cadastro com foto e deficiências, vínculo com abrigo (a ocupação é atualizada sozinha), busca e filtros por faixa etária, entrada e deficiência.
- **Solicitações de abrigo:** locais indicados pelo bot ou pelo site; o admin aprova ou recusa.
- **Pedidos de ajuda do abrigo:** doações, medicamentos, voluntariado e infraestrutura, por urgência e status.
- **Responsáveis e voluntários no WhatsApp:** convite por mensagem ou código, com registro de como o admin conferiu a pessoa.
- **Alertas e inscritos:** relatos dos moradores, confirmação ou cancelamento de alertas e lista de quem recebe os avisos.
- **Regiões:** estados, cidades (com o link do grupo de alertas no WhatsApp) e bairros com nível de risco.
- **Administradores:** um admin logado cadastra outro.

### Painel do voluntário
- Pedidos de ajuda em aberto e as últimas contribuições.
- Lista de abrigos com filtros e vínculo a um abrigo.
- Mapa de abrigos e "Meu perfil".

### Bot de WhatsApp (população)
Menu principal: alertas do meu bairro, solicitar apoio, abrigos disponíveis, apoio psicológico, alertas ativos agora, telefones de emergência, indicar um local para abrigo e encerrar.

- **Inscrição em alertas** pelo nome ou CEP do bairro (o CEP é consultado no ViaCEP).
- **Relato de ocorrência** com perguntas fechadas (local, tipo, gravidade) e foto opcional.
- Quando **3 pessoas diferentes** relatam o mesmo tipo de ocorrência no mesmo bairro (ou o admin confirma), o alerta dispara para quem mora ou acompanha o bairro e para o grupo da cidade.
- Responsáveis de abrigo recebem os avisos do abrigo; voluntários do abrigo recebem cada novo pedido de ajuda.

---

## 🛠️ Tecnologias

| Parte | Pasta | Tecnologias |
|---|---|---|
| API | `Backend/` | Node.js (ES Modules), Fastify 5, Prisma 6, PostgreSQL (Supabase), Supabase Storage, JWT, bcrypt |
| Painel web | `Frontend/` | React 19, Vite, React Router 7, Leaflet / React-Leaflet, react-icons |
| Bot | `ChatBot/` | Node.js, whatsapp-web.js |

Cada pasta tem seu próprio `package.json` e `node_modules` (a raiz não tem). O bot só conversa com a API; ele não acessa o banco diretamente.

---

## 📂 Estrutura

```
📦 Projeto-Integrador-I
 ┣ 📂 Backend
 ┃ ┣ 📂 prisma          → schema.prisma (fonte de verdade do banco), migrações e seed
 ┃ ┣ 📂 scripts         → banco de teste, backup, dados de demonstração
 ┃ ┣ 📂 src
 ┃ ┃ ┣ 📂 lib           → regras compartilhadas (alertas, localização, validação, fotos…)
 ┃ ┃ ┣ 📂 routes        → uma rota por assunto (abrigos, vitimas, alertas, bot…)
 ┃ ┃ ┗ 📄 server.js     → sobe a API na porta 3000
 ┃ ┣ 📂 testes          → verificações automáticas da API
 ┃ ┗ 📄 route.http      → requisições de exemplo (extensão REST Client)
 ┣ 📂 Frontend
 ┃ ┗ 📂 src
 ┃   ┣ 📂 components    → sidebar, seletores, marcas de campo…
 ┃   ┣ 📂 pages         → uma pasta por tela
 ┃   ┣ 📂 services      → chamadas à API (admin e voluntário)
 ┃   ┣ 📂 styles        → tema visual (sosvale-glass.css)
 ┃   ┗ 📂 utils         → limites e máscaras dos campos, rótulos, filtros
 ┣ 📂 ChatBot
 ┃ ┣ 📂 controllers     → fluxos de conversa (menu, alertas, abrigo, apoio…)
 ┃ ┣ 📂 services        → cliente da API, envio da fila de mensagens, fotos
 ┃ ┣ 📂 testes          → simulação de conversas
 ┃ ┗ 📄 index.js
 ┗ 📂 Documentações     → visão de projeto, atas, sprints, guias e relatórios
```

---

## 🚀 Como executar

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão LTS recente) e npm.
- Um projeto no [Supabase](https://supabase.com/) (banco PostgreSQL + Storage com os buckets `fotos-abrigo`, `fotos-vitima` e `fotos-alerta`).
- Para o bot: um número de WhatsApp para ser o bot.

### 1. Clonar e instalar
```bash
git clone https://github.com/VitoriaSCouto/Projeto-Integrador-I.git
cd Projeto-Integrador-I

cd Backend  && npm install && cd ..
cd Frontend && npm install && cd ..
cd ChatBot  && npm install && cd ..
```

### 2. Configurar as variáveis de ambiente
Copie os exemplos e preencha com os dados do seu projeto:

- `Backend/.env.example` → `Backend/.env`: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_KEY`, `BOT_API_KEY` (e opcionais como `ALERTA_CONFIRMACOES_MINIMAS`, `ALERTA_JANELA_HORAS`, `PORT`, `BOT_WHATSAPP_NUMERO`).
- `ChatBot/.env.example` → `ChatBot/.env`: `BOT_API_KEY` (o **mesmo valor** do backend) e, se precisar, `API_URL`.
- Frontend (opcional): `VITE_API_URL`, se a API não estiver em `http://localhost:3000`.

> ⚠️ Nunca publique os arquivos `.env`. Eles têm as senhas do banco e as chaves do sistema.

### 3. Preparar o banco
```bash
cd Backend
npx prisma migrate deploy   # cria as tabelas e cadastra os 27 estados
npx prisma generate         # gera o cliente do Prisma
npm run seed                # cadastra os tipos de deficiência
```
> Se o `migrate` der erro **P1001**, a `DIRECT_URL` provavelmente exige IPv6. No Git Bash, rode com a URL do *session pooler*: `DIRECT_URL="$DATABASE_URL" npx prisma migrate deploy`.

### 4. Ligar o sistema
```bash
# API + painel juntos (de dentro de Backend/ OU de Frontend/ — só um dos dois)
npm run dev
```
- API: http://localhost:3000
- Painel: http://localhost:5173

Ou separadamente: `cd Backend && npm run back` e `cd Frontend && npm run front`.

**Primeiro acesso:** enquanto não houver nenhum administrador, o primeiro pode ser criado com `POST /api/auth/cadastrar` (exemplo em `Backend/route.http`). Depois disso, só um admin logado cadastra outros, pela tela **Administradores**.

### 5. Ligar o bot de WhatsApp
```bash
cd ChatBot
npm run bot
```
No primeiro uso aparece um **QR Code** no terminal: leia com o WhatsApp do número do bot (Aparelhos conectados). A sessão fica salva em `.wwebjs_auth/`. O bot religa sozinho se o WhatsApp Web travar; `Ctrl + C` desliga. Rode **um bot só** por vez.

---

## 🧪 Testes (sem tocar no banco real)

Os testes usam um PostgreSQL **em memória** (PGlite). Nada é gravado no Supabase e nenhuma mensagem de verdade é enviada.

```bash
# Terminal 1 — banco de teste vazio (o teste da API exige vazio)
cd Backend && npm run banco:teste:vazio

# Terminal 2 — API em modo teste (feche antes o npm run dev)
cd Backend && npm run back:teste

# Terminal 3 — verificações automáticas da API
cd Backend && npm run teste:api

# Depois, simulação de conversas do WhatsApp
cd ChatBot && npm run teste:conversa      # roteiro fixo
cd ChatBot && npm run teste:interativo    # você digita as mensagens
```

Para testar à mão, use `npm run banco:teste` (com dados de exemplo; admin `adm@teste.com` / `123456`, voluntário `voluntario@teste.com` / `123456`).
Portas ocupadas? Use `BANCO_TESTE_PORTA=5434` e `PORT=3100` no banco e na API de teste, e `API_URL=http://127.0.0.1:3100` nos testes.

O passo a passo completo está em [`Documentações/GUIA-TESTES-E-ALERTAS.md`](Documentações/GUIA-TESTES-E-ALERTAS.md).

---

## 🎬 Dados de demonstração (para apresentar)

No banco normal, sem o modo teste:

```bash
cd Backend
npm run demo:dados      # cria abrigos, vítimas, moradores e um alerta com 2 de 3 relatos (rode de novo antes de apresentar)
npm run demo:conferir   # confere a ocupação de cada abrigo
npm run demo:remover    # apaga só o que o demo:dados criou
```

Antes de aplicar migrações novas no Supabase, faça um backup e ensaie:
```bash
npm run backup                              # exporta as tabelas para Backend/backups/
npm run ensaiar-migracao -- backups/<pasta> # aplica as migrações numa cópia com os dados reais
```

---

## 📖 Como funciona o alerta

1. O morador se inscreve pelo bot (nome, e-mail e bairro).
2. Ele relata uma ocorrência respondendo perguntas fechadas, com foto opcional.
3. Relatos do mesmo tipo, no mesmo bairro e dentro de 6 horas, entram no mesmo alerta.
4. Com 3 pessoas diferentes (ou a confirmação do admin), o alerta fica **ativo** e as mensagens entram numa fila.
5. O bot envia a fila para os moradores do bairro e para o grupo da cidade, repetindo até 3 vezes se falhar.
6. Se o admin cancelar um alerta ativo, quem recebeu ganha uma mensagem de correção.

---

## 📚 Documentação

- [`Documentações/DOCUMENTACAO-TECNICA.md`](Documentações/DOCUMENTACAO-TECNICA.md) — **como o sistema funciona por dentro**: tecnologias, banco, todas as rotas, telas, bot e fluxos de dados.
- `Documentações/` — visão de projeto, atas das reuniões, sprints, pôster e relatórios.
- `Documentações/RELATORIO-CORRECOES-TESTES.md` — correções feitas a partir da planilha de testes.
- `SOS_Vale_Analise_e_Backlog.pdf` — análise técnica, roadmap e backlog.
- `CLAUDE.md` — guia técnico detalhado da arquitetura e das convenções do código.

---

## 📌 Pendências e melhorias futuras

- Validar capacidade e tamanho dos campos na criação de solicitação de abrigo (rota pública).
- Levar os fluxos de **apoio** e **apoio psicológico** do bot para o banco (hoje ficam só na memória).
- Ações do responsável pelo bot (confirmar voluntário, avisar que o abrigo lotou…).
- Fotos de abrigo e vítima no modo teste (hoje vão direto ao Supabase).
- Integração com órgãos oficiais (Defesa Civil) e configuração de CI/deploy.

---

Projeto acadêmico — Fatec · Projeto Integrador I · 2026.
