-- CreateIndex
CREATE INDEX "activity_logs_tenant_id_idx" ON "activity_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs"("user_id");

-- CreateIndex
CREATE INDEX "attachments_tenant_id_idx" ON "attachments"("tenant_id");

-- CreateIndex
CREATE INDEX "attachments_project_id_idx" ON "attachments"("project_id");

-- CreateIndex
CREATE INDEX "attachments_task_id_idx" ON "attachments"("task_id");

-- CreateIndex
CREATE INDEX "attachments_user_id_idx" ON "attachments"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_read_idx" ON "notifications"("read");

-- CreateIndex
CREATE INDEX "projects_tenant_id_idx" ON "projects"("tenant_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "tasks_project_id_idx" ON "tasks"("project_id");

-- CreateIndex
CREATE INDEX "tasks_assigned_user_id_idx" ON "tasks"("assigned_user_id");

-- CreateIndex
CREATE INDEX "tasks_creator_id_idx" ON "tasks"("creator_id");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");
