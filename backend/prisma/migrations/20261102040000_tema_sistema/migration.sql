-- Tema padrão das contas NOVAS passa a ser "system" (segue o sistema operacional).
-- As contas existentes mantêm o valor que já têm: não dá para distinguir quem escolheu
-- "dark" de quem só herdou o padrão antigo, então nada é reescrito aqui.
ALTER TABLE "User" ALTER COLUMN "theme" SET DEFAULT 'system';
