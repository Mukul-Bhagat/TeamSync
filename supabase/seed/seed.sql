-- Seed data for development
INSERT INTO organizations (id, name, slug, plan) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Demo Corp', 'demo-corp', 'pro');

INSERT INTO workspaces (id, name, slug, organization_id, owner_id, color) VALUES
  ('00000000-0000-0000-0000-000000000010', 'Engineering', 'engineering', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', '#3b82f6');

INSERT INTO channels (id, name, description, workspace_id, is_private, created_by) VALUES
  ('00000000-0000-0000-0000-000000000100', 'general', 'Team announcements', '00000000-0000-0000-0000-000000000010', false, '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-000000000101', 'engineering', 'Core infrastructure', '00000000-0000-0000-0000-000000000010', false, '00000000-0000-0000-0000-000000000000');

INSERT INTO knowledge_categories (id, name, slug, workspace_id, description, color, position) VALUES
  ('00000000-0000-0000-0000-000000000200', 'Getting Started', 'getting-started', '00000000-0000-0000-0000-000000000010', 'Onboarding docs', '#3b82f6', 0),
  ('00000000-0000-0000-0000-000000000201', 'Engineering', 'engineering-docs', '00000000-0000-0000-0000-000000000010', 'Technical docs', '#10b981', 1);

INSERT INTO knowledge_pages (id, title, slug, content, workspace_id, category_id, author_id, is_published, position) VALUES
  ('00000000-0000-0000-0000-000000000300', 'Welcome', 'welcome', 'Welcome to PipeSync! This is your team workspace.', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000200', '00000000-0000-0000-0000-000000000000', true, 0),
  ('00000000-0000-0000-0000-000000000301', 'API Guide', 'api-guide', 'The PipeSync API is RESTful and uses JSON.', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000000', true, 0);
