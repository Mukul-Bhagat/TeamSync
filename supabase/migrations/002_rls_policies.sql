-- RLS Policies
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_pages ENABLE ROW LEVEL SECURITY;

-- Users: users can read their own profile and org members
CREATE POLICY "Users read own" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own" ON users FOR UPDATE USING (auth.uid() = id);

-- Workspaces: members of org can access
CREATE POLICY "Workspaces read" ON workspaces FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.organization_id = workspaces.organization_id)
);
CREATE POLICY "Workspaces write" ON workspaces FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.organization_id = workspaces.organization_id AND users.role IN ('owner','admin'))
);

-- Projects: workspace members
CREATE POLICY "Projects read" ON projects FOR SELECT USING (
  EXISTS (SELECT 1 FROM workspaces w JOIN users u ON u.organization_id = w.organization_id WHERE w.id = projects.workspace_id AND u.id = auth.uid())
);
CREATE POLICY "Projects write" ON projects FOR ALL USING (
  EXISTS (SELECT 1 FROM workspaces w JOIN users u ON u.organization_id = w.organization_id WHERE w.id = projects.workspace_id AND u.id = auth.uid() AND u.role IN ('owner','admin'))
);

-- Tasks: project members
CREATE POLICY "Tasks read" ON tasks FOR SELECT USING (
  EXISTS (SELECT 1 FROM projects p JOIN workspaces w ON w.id = p.workspace_id JOIN users u ON u.organization_id = w.organization_id WHERE p.id = tasks.project_id AND u.id = auth.uid())
);

-- Channels & Messages: workspace members
CREATE POLICY "Channels read" ON channels FOR SELECT USING (
  EXISTS (SELECT 1 FROM workspaces w JOIN users u ON u.organization_id = w.organization_id WHERE w.id = channels.workspace_id AND u.id = auth.uid())
);
CREATE POLICY "Messages read" ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM channels c JOIN workspaces w ON w.id = c.workspace_id JOIN users u ON u.organization_id = w.organization_id WHERE c.id = messages.channel_id AND u.id = auth.uid())
);
CREATE POLICY "Messages insert" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Activity: workspace members
CREATE POLICY "Activity read" ON activity_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM workspaces w JOIN users u ON u.organization_id = w.organization_id WHERE w.id = activity_logs.workspace_id AND u.id = auth.uid())
);

-- Knowledge: workspace members
CREATE POLICY "Knowledge read" ON knowledge_categories FOR SELECT USING (
  EXISTS (SELECT 1 FROM workspaces w JOIN users u ON u.organization_id = w.organization_id WHERE w.id = knowledge_categories.workspace_id AND u.id = auth.uid())
);
CREATE POLICY "Knowledge pages read" ON knowledge_pages FOR SELECT USING (
  EXISTS (SELECT 1 FROM workspaces w JOIN users u ON u.organization_id = w.organization_id WHERE w.id = knowledge_pages.workspace_id AND u.id = auth.uid())
);
