-- I3b demo story, step 1 of 2: the Spain customers case, ruled with the expected answer 141 (customers by billing country).
-- TEST deployment only. Written by the example jurors from seed.sql (no personal data). Votes have no `source` column, so
-- the example voters use the "example-" user id convention of docket-examples.sql; judge trust never reads votes.
--   node scripts/run-sql.mjs rayfin/seed/i3b-story-1-ruled-case.sql --target=test
-- Then launch ONE real single-question hearing for this case (scripts/i3b-run-hearing.mjs), then run step 2.
-- target: test-only
-- Idempotent: rows are inserted only when their id is missing.
SET NOCOUNT ON;

DECLARE @agent UNIQUEIDENTIFIER = (SELECT TOP (1) id FROM dbo.[Agents] WHERE name = N'Sales Agent' ORDER BY id);
IF @agent IS NULL THROW 50000, 'The Sales Agent is not registered on this deployment.', 1;
DECLARE @now DATETIME2 = SYSUTCDATETIME();
DECLARE @case UNIQUEIDENTIFIER = '00000000-0000-4000-8000-0000000000c1';
DECLARE @t141 UNIQUEIDENTIFIER = '00000000-0000-4000-8000-0000000000c2';

INSERT INTO dbo.[Cases] (id, agent_id, text, category, authorUserId, authorEmail, createdAt)
SELECT @case, @agent, N'How many customers do we have in Spain?', N'Customers', 'example-bruno.expert', 'bruno.expert@example.com', DATEADD(day, -3, @now)
WHERE NOT EXISTS (SELECT 1 FROM dbo.[Cases] WHERE id = @case);

INSERT INTO dbo.[Testimonies] (id, case_id, answer, definition, criterion, timeWindow, population, source, authorUserId, authorEmail, createdAt)
SELECT @t141, @case, N'141', N'Customers whose billing country is Spain.', N'Billing country is Spain', NULL, N'All customers', N'Customer[Country]',
       'example-bruno.expert', 'bruno.expert@example.com', DATEADD(day, -3, @now)
WHERE NOT EXISTS (SELECT 1 FROM dbo.[Testimonies] WHERE id = @t141);

-- Two votes in favour, one from an approver (R3): the case is ruled.
INSERT INTO dbo.[Votes] (id, testimony_id, value, comment, voterUserId, voterEmail, createdAt)
SELECT v.id, @t141, 'for', NULL, 'example-' + v.who, v.who + '@example.com', DATEADD(day, v.daysAgo, @now)
FROM (VALUES
    ('00000000-0000-4000-8000-0000000000e4', 'ana.expert',    -2),
    ('00000000-0000-4000-8000-0000000000e5', 'carla.approver', -2)
) AS v (id, who, daysAgo)
WHERE NOT EXISTS (SELECT 1 FROM dbo.[Votes] WHERE id = v.id);

SELECT 'case' AS what, COUNT(*) AS rows FROM dbo.[Cases] WHERE id = @case
UNION ALL SELECT 'testimony', COUNT(*) FROM dbo.[Testimonies] WHERE id = @t141
UNION ALL SELECT 'votes', COUNT(*) FROM dbo.[Votes] WHERE testimony_id = @t141;
