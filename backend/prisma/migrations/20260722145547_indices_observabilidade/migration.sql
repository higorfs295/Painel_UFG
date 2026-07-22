-- Índices de leitura para as consultas quentes de avisos e auditoria.
-- O feed de avisos filtra por audiência e ordena por (fixado, recência).
CREATE INDEX "Announcement_audience_pinned_createdAt_idx"
    ON "Announcement"("audience", "pinned", "createdAt");

-- "o que este usuário fez?" é a consulta natural da trilha de auditoria.
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
