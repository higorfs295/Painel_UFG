-- CreateIndex
CREATE INDEX "ExtraComponent_enrollmentId_idx" ON "ExtraComponent"("enrollmentId");

-- CreateIndex
CREATE INDEX "InviteToken_userId_idx" ON "InviteToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "Requisite_subjectId_idx" ON "Requisite"("subjectId");

-- CreateIndex
CREATE INDEX "Requisite_requiresSubjectId_idx" ON "Requisite"("requiresSubjectId");

-- CreateIndex
CREATE INDEX "Scenario_enrollmentId_idx" ON "Scenario"("enrollmentId");

-- CreateIndex
CREATE INDEX "ScenarioDiscipline_scenarioId_idx" ON "ScenarioDiscipline"("scenarioId");
