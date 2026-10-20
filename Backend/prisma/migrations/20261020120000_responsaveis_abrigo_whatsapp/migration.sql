-- Responsáveis do abrigo no WhatsApp (convite conferido pelo admin + vínculo confirmado pela própria pessoa).
-- Só cria tabelas/colunas e deixa notificacao."alertaId" opcional: nenhum dado existente é apagado.

-- CreateEnum
CREATE TYPE "MetodoConferencia" AS ENUM ('solicitacao_aprovada', 'numero_do_cadastro', 'ligacao_contato_oficial', 'orgao_publico', 'presencial');

-- CreateEnum
CREATE TYPE "OrigemConvite" AS ENUM ('solicitacao', 'admin');

-- CreateEnum
CREATE TYPE "StatusConvite" AS ENUM ('pendente', 'aceito', 'recusado', 'cancelado');

-- AlterEnum
ALTER TYPE "DestinoNotificacao" ADD VALUE 'responsavel';

-- AlterEnum


ALTER TYPE "EventoNotificacao" ADD VALUE 'convite_responsavel';
ALTER TYPE "EventoNotificacao" ADD VALUE 'aviso_responsavel';

-- AlterTable
ALTER TABLE "notificacao" ADD COLUMN     "conviteId" INTEGER,
ALTER COLUMN "alertaId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "solicitacao_abrigo" ADD COLUMN     "aceitaAvisosWhatsapp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "solicitanteWhatsappId" TEXT;

-- CreateTable
CREATE TABLE "convite_responsavel" (
    "id_convite" SERIAL NOT NULL,
    "abrigoId" INTEGER NOT NULL,
    "nome" TEXT,
    "telefone" VARCHAR(20),
    "whatsappId" TEXT,
    "codigoHash" TEXT,
    "origem" "OrigemConvite" NOT NULL,
    "metodoConferencia" "MetodoConferencia" NOT NULL,
    "observacao" TEXT,
    "status" "StatusConvite" NOT NULL DEFAULT 'pendente',
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "respondidoEm" TIMESTAMP(3),
    "criadoPorId" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convite_responsavel_pkey" PRIMARY KEY ("id_convite")
);

-- CreateTable
CREATE TABLE "responsavel_abrigo" (
    "id_responsavel" SERIAL NOT NULL,
    "abrigoId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "whatsappId" TEXT NOT NULL,
    "telefone" VARCHAR(20),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "conviteId" INTEGER,
    "desativadoEm" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "responsavel_abrigo_pkey" PRIMARY KEY ("id_responsavel")
);

-- CreateIndex
CREATE INDEX "convite_responsavel_abrigoId_idx" ON "convite_responsavel"("abrigoId");

-- CreateIndex
CREATE INDEX "convite_responsavel_status_idx" ON "convite_responsavel"("status");

-- CreateIndex
CREATE INDEX "convite_responsavel_codigoHash_idx" ON "convite_responsavel"("codigoHash");

-- CreateIndex
CREATE UNIQUE INDEX "responsavel_abrigo_conviteId_key" ON "responsavel_abrigo"("conviteId");

-- CreateIndex
CREATE INDEX "responsavel_abrigo_abrigoId_idx" ON "responsavel_abrigo"("abrigoId");

-- CreateIndex
CREATE INDEX "responsavel_abrigo_whatsappId_idx" ON "responsavel_abrigo"("whatsappId");

-- AddForeignKey
ALTER TABLE "notificacao" ADD CONSTRAINT "notificacao_conviteId_fkey" FOREIGN KEY ("conviteId") REFERENCES "convite_responsavel"("id_convite") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convite_responsavel" ADD CONSTRAINT "convite_responsavel_abrigoId_fkey" FOREIGN KEY ("abrigoId") REFERENCES "abrigo"("id_abrigo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convite_responsavel" ADD CONSTRAINT "convite_responsavel_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responsavel_abrigo" ADD CONSTRAINT "responsavel_abrigo_abrigoId_fkey" FOREIGN KEY ("abrigoId") REFERENCES "abrigo"("id_abrigo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responsavel_abrigo" ADD CONSTRAINT "responsavel_abrigo_conviteId_fkey" FOREIGN KEY ("conviteId") REFERENCES "convite_responsavel"("id_convite") ON DELETE SET NULL ON UPDATE CASCADE;

