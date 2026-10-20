-- Indicar abrigo pelo bot: quem pediu diz se é o responsável; se não for, pode virar voluntário
-- do abrigo no WhatsApp e receber os pedidos de ajuda. Só cria colunas/tabela: nada é apagado.

-- AlterEnum
ALTER TYPE "DestinoNotificacao" ADD VALUE 'voluntario';

-- AlterEnum


ALTER TYPE "EventoNotificacao" ADD VALUE 'pedido_ajuda';
ALTER TYPE "EventoNotificacao" ADD VALUE 'aviso_voluntario';

-- AlterTable
ALTER TABLE "solicitacao_abrigo" ADD COLUMN     "querVoluntariar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "solicitanteEhResponsavel" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "voluntario_whatsapp" (
    "id_voluntario_whatsapp" SERIAL NOT NULL,
    "abrigoId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "whatsappId" TEXT NOT NULL,
    "telefone" VARCHAR(20),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "solicitacaoId" INTEGER,
    "desativadoEm" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voluntario_whatsapp_pkey" PRIMARY KEY ("id_voluntario_whatsapp")
);

-- CreateIndex
CREATE INDEX "voluntario_whatsapp_whatsappId_idx" ON "voluntario_whatsapp"("whatsappId");

-- CreateIndex
CREATE UNIQUE INDEX "voluntario_whatsapp_abrigoId_whatsappId_key" ON "voluntario_whatsapp"("abrigoId", "whatsappId");

-- AddForeignKey
ALTER TABLE "voluntario_whatsapp" ADD CONSTRAINT "voluntario_whatsapp_abrigoId_fkey" FOREIGN KEY ("abrigoId") REFERENCES "abrigo"("id_abrigo") ON DELETE CASCADE ON UPDATE CASCADE;

