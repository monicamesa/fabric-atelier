-- Hearing examples for the TEST deployment only: ruled and disputed cases for the real "Sales Agent",
-- written by the example jurors from seed.sql (no personal data). Expected answers were computed with DAX
-- against the SalesModel semantic model; the DAX is in each testimony's definition.
--   node scripts/run-sql.mjs rayfin/seed/hearing-examples.sql --target=test --var AgentWorkspace=WORKSPACE_ID_AGENT_JURY_DEMO --var AgentItem=DATA_AGENT_ID_SALES_AGENT
-- The workspace and item ids come from .private/values.env; they never appear in this file.
-- target: test-only
-- Idempotent: rows are inserted only when their id is missing; the agent is registered only if absent.
SET NOCOUNT ON;

DECLARE @now DATETIME2 = SYSUTCDATETIME();
DECLARE @agent UNIQUEIDENTIFIER = (SELECT TOP (1) id FROM dbo.[Agents] WHERE name = N'Sales Agent' OR (LOWER(workspaceId) = LOWER('$(AgentWorkspace)') AND LOWER(itemId) = LOWER('$(AgentItem)')));
IF @agent IS NULL
BEGIN
    SET @agent = '00000000-0000-4000-8000-000000000023';
    INSERT INTO dbo.[Agents] (id, name, workspaceId, itemId, active) VALUES (@agent, N'Sales Agent', LOWER('$(AgentWorkspace)'), LOWER('$(AgentItem)'), 1);
END

DECLARE @cases TABLE (id UNIQUEIDENTIFIER, text NVARCHAR(1000), category NVARCHAR(100), who NVARCHAR(20), daysAgo INT);
INSERT INTO @cases VALUES
    ('00000000-0000-4000-8000-0000000000a1', N'How many orders were placed in fiscal year 2026?', N'Sales', 'bruno.expert', 12),
    ('00000000-0000-4000-8000-0000000000a2', N'What was our revenue in fiscal year 2025?', N'Sales', 'ana.expert', 12),
    ('00000000-0000-4000-8000-0000000000a3', N'What is the average order value?', N'Sales', 'bruno.expert', 11),
    ('00000000-0000-4000-8000-0000000000a4', N'What was our revenue in fiscal year 2026?', N'Sales', 'ana.expert', 11),
    ('00000000-0000-4000-8000-0000000000a5', N'How many active customers did we have at the end of June 2026?', N'Customers', 'ana.expert', 10);

INSERT INTO dbo.[Cases] (id, agent_id, text, category, authorUserId, authorEmail, createdAt)
SELECT c.id, @agent, c.text, c.category, 'example-' + c.who, c.who + '@example.com', DATEADD(day, -c.daysAgo, @now)
FROM @cases AS c
WHERE NOT EXISTS (SELECT 1 FROM dbo.[Cases] AS existing WHERE existing.id = c.id);

DECLARE @testimonies TABLE (
    id UNIQUEIDENTIFIER, case_id UNIQUEIDENTIFIER, answer NVARCHAR(2000), definition NVARCHAR(1000),
    criterion NVARCHAR(300), timeWindow NVARCHAR(300), population NVARCHAR(300), source NVARCHAR(300),
    who NVARCHAR(20), daysAgo INT);
INSERT INTO @testimonies VALUES
    ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', N'997',
        N'DAX: CALCULATE([Orders], Calendar[Year] = 2026). Calendar[Year] is the fiscal year, from July to June.',
        N'Every order', N'Fiscal year 2026 (1 July 2025 to 30 June 2026)', N'All customers', N'SalesModel: SalesOrder', 'bruno.expert', 12),
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a2', N'2,147,910.60',
        N'DAX: CALCULATE([Net Sales], Calendar[Year] = 2025). Net sales exclude tax and freight; the year is the fiscal year.',
        N'Net of tax and freight', N'Fiscal year 2025 (1 July 2024 to 30 June 2025)', N'All customers', N'SalesModel: SalesOrder', 'ana.expert', 12),
    ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000a3', N'2,226.97',
        N'DAX: DIVIDE([Net Sales], [Orders]). Net sales per order, excluding tax and freight.',
        N'Net of tax and freight', N'All dates', N'All customers', N'SalesModel: SalesOrder', 'bruno.expert', 11),
    ('00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000a4', N'2,183,973.48',
        N'DAX: CALCULATE([Net Sales], Calendar[Year] = 2026). Net sales exclude tax and freight; the year is the fiscal year.',
        N'Net of tax and freight', N'Fiscal year 2026 (1 July 2025 to 30 June 2026)', N'All customers', N'SalesModel: SalesOrder', 'ana.expert', 11),
    ('00000000-0000-4000-8000-0000000000b5', '00000000-0000-4000-8000-0000000000a5', N'245',
        N'DAX: [Active Customers]. Customers with at least one order in the 90 days up to 30 June 2026.',
        N'At least one order', N'Last 90 days', N'All customers', N'SalesModel: SalesOrder', 'ana.expert', 10),
    ('00000000-0000-4000-8000-0000000000b6', '00000000-0000-4000-8000-0000000000a5', N'489',
        N'DAX: [Customers With Open Contract]. Customers with a contract open at the end of June 2026.',
        N'An open contract', N'On 30 June 2026', N'All customers', N'SalesModel: Contract', 'bruno.expert', 9);

INSERT INTO dbo.[Testimonies] (id, case_id, answer, definition, criterion, timeWindow, population, source, authorUserId, authorEmail, createdAt)
SELECT t.id, t.case_id, t.answer, t.definition, t.criterion, t.timeWindow, t.population, t.source,
       'example-' + t.who, t.who + '@example.com', DATEADD(day, -t.daysAgo, @now)
FROM @testimonies AS t
WHERE NOT EXISTS (SELECT 1 FROM dbo.[Testimonies] AS existing WHERE existing.id = t.id);

-- Ruled cases: a vote in favour from an approver and one from an expert, neither from the author.
DECLARE @votes TABLE (id UNIQUEIDENTIFIER, testimony_id UNIQUEIDENTIFIER, value NVARCHAR(10), who NVARCHAR(20), daysAgo INT);
INSERT INTO @votes VALUES
    ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b1', 'for', 'ana.expert',     11),
    ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000b1', 'for', 'carla.approver', 11),
    ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000b2', 'for', 'bruno.expert',   11),
    ('00000000-0000-4000-8000-0000000000c4', '00000000-0000-4000-8000-0000000000b2', 'for', 'carla.approver', 11),
    ('00000000-0000-4000-8000-0000000000c5', '00000000-0000-4000-8000-0000000000b3', 'for', 'ana.expert',     10),
    ('00000000-0000-4000-8000-0000000000c6', '00000000-0000-4000-8000-0000000000b3', 'for', 'carla.approver', 10),
    ('00000000-0000-4000-8000-0000000000c7', '00000000-0000-4000-8000-0000000000b4', 'for', 'bruno.expert',   10),
    ('00000000-0000-4000-8000-0000000000c8', '00000000-0000-4000-8000-0000000000b4', 'for', 'carla.approver', 10),
    -- Disputed: each answer has a vote in favour.
    ('00000000-0000-4000-8000-0000000000c9', '00000000-0000-4000-8000-0000000000b5', 'for', 'carla.approver',  8),
    ('00000000-0000-4000-8000-0000000000ca', '00000000-0000-4000-8000-0000000000b6', 'for', 'dario.admin',      8);

INSERT INTO dbo.[Votes] (id, testimony_id, value, comment, voterUserId, voterEmail, createdAt)
SELECT v.id, v.testimony_id, v.value, NULL, 'example-' + v.who, v.who + '@example.com', DATEADD(day, -v.daysAgo, @now)
FROM @votes AS v
WHERE NOT EXISTS (SELECT 1 FROM dbo.[Votes] AS existing WHERE existing.id = v.id);

SELECT 'Case' AS entity, COUNT(*) AS rows FROM dbo.[Cases] WHERE id IN (SELECT id FROM @cases)
UNION ALL SELECT 'Testimony', COUNT(*) FROM dbo.[Testimonies] WHERE id IN (SELECT id FROM @testimonies)
UNION ALL SELECT 'Vote', COUNT(*) FROM dbo.[Votes] WHERE id IN (SELECT id FROM @votes)
UNION ALL SELECT 'Agent named Sales Agent', COUNT(*) FROM dbo.[Agents] WHERE name = N'Sales Agent';
