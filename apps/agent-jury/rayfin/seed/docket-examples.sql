-- Example docket for the TEST deployment only: one case in each state, written by the example jurors
-- from seed.sql (no personal data). It lets reviewers see every state, which a single account can't
-- produce through the app because votes must come from different jurors.
--   node scripts/run-sql.mjs rayfin/seed/docket-examples.sql --target=test
-- The marker below makes run-sql.mjs refuse this file without --target=test.
-- target: test-only
-- Idempotent: rows are inserted only when their id is missing.
SET NOCOUNT ON;

DECLARE @agent UNIQUEIDENTIFIER = '00000000-0000-4000-8000-000000000021';
DECLARE @now DATETIME2 = SYSUTCDATETIME();

DECLARE @cases TABLE (id UNIQUEIDENTIFIER, text NVARCHAR(1000), category NVARCHAR(100), who NVARCHAR(20), daysAgo INT);
INSERT INTO @cases VALUES
    ('00000000-0000-4000-8000-000000000061', N'Which region had the highest net sales in 2025?', N'Sales', 'ana.expert', 9),
    ('00000000-0000-4000-8000-000000000062', N'How many active customers were there in March 2026?', N'Customers', 'bruno.expert', 6),
    ('00000000-0000-4000-8000-000000000063', N'What was the average order value in Q1 2026?', N'Sales', 'carla.approver', 3),
    ('00000000-0000-4000-8000-000000000064', N'Is the business doing well?', N'Sales', 'bruno.expert', 5),
    ('00000000-0000-4000-8000-000000000065', N'Which 3 products had the best margin last quarter?', N'Products', 'ana.expert', 1);

INSERT INTO dbo.[Cases] (id, agent_id, text, category, authorUserId, authorEmail, createdAt)
SELECT c.id, @agent, c.text, c.category, 'example-' + c.who, c.who + '@example.com', DATEADD(day, -c.daysAgo, @now)
FROM @cases AS c
WHERE NOT EXISTS (SELECT 1 FROM dbo.[Cases] AS existing WHERE existing.id = c.id);

DECLARE @testimonies TABLE (
    id UNIQUEIDENTIFIER, case_id UNIQUEIDENTIFIER, answer NVARCHAR(2000), definition NVARCHAR(1000),
    criterion NVARCHAR(300), timeWindow NVARCHAR(300), population NVARCHAR(300), source NVARCHAR(300),
    who NVARCHAR(20), daysAgo INT);
INSERT INTO @testimonies VALUES
    ('00000000-0000-4000-8000-000000000071', '00000000-0000-4000-8000-000000000061', N'West', N'Net sales after returns, grouped by the customer''s billing region.',
        NULL, NULL, NULL, NULL, 'ana.expert', 9),
    ('00000000-0000-4000-8000-000000000072', '00000000-0000-4000-8000-000000000062', N'1,480', N'Customers with at least one order in the 90 days before 31 March.',
        N'At least one order', N'Last 90 days', N'All customers', N'FactSales', 'bruno.expert', 6),
    ('00000000-0000-4000-8000-000000000073', '00000000-0000-4000-8000-000000000062', N'1,215', N'Customers with an open contract on 31 March.',
        N'An open contract', N'On the last day of the month', N'All customers', N'DimContract', 'ana.expert', 5),
    ('00000000-0000-4000-8000-000000000074', '00000000-0000-4000-8000-000000000063', N'€312', N'Net sales divided by the number of orders, January to March.',
        NULL, NULL, NULL, NULL, 'carla.approver', 3);

INSERT INTO dbo.[Testimonies] (id, case_id, answer, definition, criterion, timeWindow, population, source, authorUserId, authorEmail, createdAt)
SELECT t.id, t.case_id, t.answer, t.definition, t.criterion, t.timeWindow, t.population, t.source,
       'example-' + t.who, t.who + '@example.com', DATEADD(day, -t.daysAgo, @now)
FROM @testimonies AS t
WHERE NOT EXISTS (SELECT 1 FROM dbo.[Testimonies] AS existing WHERE existing.id = t.id);

DECLARE @votes TABLE (id UNIQUEIDENTIFIER, testimony_id UNIQUEIDENTIFIER, value NVARCHAR(10), comment NVARCHAR(1000), who NVARCHAR(20), daysAgo INT);
INSERT INTO @votes VALUES
    -- Ruled: two votes in favour, one from an approver.
    ('00000000-0000-4000-8000-000000000081', '00000000-0000-4000-8000-000000000071', 'for', NULL, 'bruno.expert', 8),
    ('00000000-0000-4000-8000-000000000082', '00000000-0000-4000-8000-000000000071', 'for', NULL, 'carla.approver', 7),
    -- Disputed: each answer has a vote in favour.
    ('00000000-0000-4000-8000-000000000083', '00000000-0000-4000-8000-000000000072', 'for', NULL, 'carla.approver', 4),
    ('00000000-0000-4000-8000-000000000084', '00000000-0000-4000-8000-000000000073', 'for', NULL, 'dario.admin', 2),
    ('00000000-0000-4000-8000-000000000085', '00000000-0000-4000-8000-000000000072', 'against', N'A customer who only has a contract never ordered anything.', 'dario.admin', 2),
    -- Under review: one vote of two.
    ('00000000-0000-4000-8000-000000000086', '00000000-0000-4000-8000-000000000074', 'for', NULL, 'ana.expert', 1);

INSERT INTO dbo.[Votes] (id, testimony_id, value, comment, voterUserId, voterEmail, createdAt)
SELECT v.id, v.testimony_id, v.value, v.comment, 'example-' + v.who, v.who + '@example.com', DATEADD(day, -v.daysAgo, @now)
FROM @votes AS v
WHERE NOT EXISTS (SELECT 1 FROM dbo.[Votes] AS existing WHERE existing.id = v.id);

INSERT INTO dbo.[CaseDismissals] (id, case_id, reason, dismissedByUserId, dismissedByEmail, createdAt)
SELECT '00000000-0000-4000-8000-000000000091', '00000000-0000-4000-8000-000000000064',
       N'No single right answer: a business expert can''t check it.', 'example-bruno.expert', 'bruno.expert@example.com', DATEADD(day, -4, @now)
WHERE NOT EXISTS (SELECT 1 FROM dbo.[CaseDismissals] WHERE id = '00000000-0000-4000-8000-000000000091');

SELECT 'Case' AS entity, COUNT(*) AS rows FROM dbo.[Cases] WHERE id IN (SELECT id FROM @cases)
UNION ALL SELECT 'Testimony', COUNT(*) FROM dbo.[Testimonies] WHERE id IN (SELECT id FROM @testimonies)
UNION ALL SELECT 'Vote', COUNT(*) FROM dbo.[Votes] WHERE id IN (SELECT id FROM @votes);
