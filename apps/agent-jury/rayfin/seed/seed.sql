-- Example jurors and agents for Agent Jury (no personal data).
-- Run after the first `npx rayfin up` with data enabled; see rayfin/seed/README.md.
-- Rayfin pluralizes table names (Juror -> dbo.Jurors, Agent -> dbo.Agents).
SET NOCOUNT ON;

DECLARE @jurors TABLE (id UNIQUEIDENTIFIER, email NVARCHAR(254), role NVARCHAR(20), team NVARCHAR(100));
INSERT INTO @jurors (id, email, role, team) VALUES
    ('00000000-0000-4000-8000-000000000011', 'ana.expert@example.com',     'expert',   N'Finance'),
    ('00000000-0000-4000-8000-000000000012', 'bruno.expert@example.com',   'expert',   N'Sales'),
    ('00000000-0000-4000-8000-000000000013', 'carla.approver@example.com', 'approver', N'Finance'),
    ('00000000-0000-4000-8000-000000000014', 'dario.admin@example.com',    'admin',    N'Data team');

INSERT INTO dbo.[Jurors] (id, email, role, team, active)
SELECT j.id, j.email, j.role, j.team, 1
FROM @jurors AS j
WHERE NOT EXISTS (SELECT 1 FROM dbo.[Jurors] AS existing WHERE existing.id = j.id OR existing.email = j.email);

DECLARE @agents TABLE (id UNIQUEIDENTIFIER, name NVARCHAR(200), workspaceId NVARCHAR(36), itemId NVARCHAR(36));
INSERT INTO @agents (id, name, workspaceId, itemId) VALUES
    ('00000000-0000-4000-8000-000000000021', N'Sales agent (example)',   '00000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000041'),
    ('00000000-0000-4000-8000-000000000022', N'Finance agent (example)', '00000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000042');

INSERT INTO dbo.[Agents] (id, name, workspaceId, itemId, active)
SELECT a.id, a.name, a.workspaceId, a.itemId, 1
FROM @agents AS a
WHERE NOT EXISTS (SELECT 1 FROM dbo.[Agents] AS existing WHERE existing.id = a.id);

SELECT 'Juror' AS entity, COUNT(*) AS rows FROM dbo.[Jurors]
UNION ALL
SELECT 'Agent', COUNT(*) FROM dbo.[Agents];
