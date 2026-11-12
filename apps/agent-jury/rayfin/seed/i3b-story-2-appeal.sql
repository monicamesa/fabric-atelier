-- I3b demo story, step 2 of 2: after the real hearing, an approver says the expected answer is wrong (R9).
-- TEST deployment only. The review is marked source = 'seed': it counts for R9 but judge trust ignores it.
-- 265 is the number of customers by shipping country, proposed by another juror as the better answer.
--   node scripts/run-sql.mjs rayfin/seed/i3b-story-2-appeal.sql --target=test
-- target: test-only
-- Idempotent.
SET NOCOUNT ON;

DECLARE @case UNIQUEIDENTIFIER = '00000000-0000-4000-8000-0000000000c1';
DECLARE @verdict UNIQUEIDENTIFIER = (
    SELECT TOP (1) v.id FROM dbo.[Verdicts] v JOIN dbo.[Hearings] h ON h.id = v.hearing_id
    WHERE v.case_id = @case ORDER BY h.createdAt DESC, v.createdAt DESC);
IF @verdict IS NULL THROW 50000, 'Run the real hearing for the Spain case first.', 1;
DECLARE @judge NVARCHAR(20) = (SELECT judgeVerdict FROM dbo.[Verdicts] WHERE id = @verdict);

INSERT INTO dbo.[Testimonies] (id, case_id, answer, definition, criterion, timeWindow, population, source, authorUserId, authorEmail, createdAt)
SELECT '00000000-0000-4000-8000-0000000000c3', @case, N'265', N'Customers whose shipping country is Spain.', N'Shipping country is Spain', NULL, N'All customers', N'Customer[ShipToCountry]',
       'example-dario.admin', 'dario.admin@example.com', SYSUTCDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.[Testimonies] WHERE id = '00000000-0000-4000-8000-0000000000c3');

-- The approver's point is that the expected answer (141) is the wrong one, whatever the judge and the agent said.
INSERT INTO dbo.[VerdictReviews] (id, verdict_id, humanVerdict, reason, comment, reviewerUserId, reviewerEmail, source, createdAt)
SELECT '00000000-0000-4000-8000-0000000000c6', @verdict,
       'incorrect',
       'expected_answer_wrong',
       N'The business counts customers by shipping country (265). The expected 141 counts billing country, and the agent mixed both.',
       'example-carla.approver', 'carla.approver@example.com', 'seed', SYSUTCDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.[VerdictReviews] WHERE id = '00000000-0000-4000-8000-0000000000c6');

SELECT 'judge said' AS what, @judge AS value
UNION ALL SELECT 'reviews of this verdict', CONVERT(NVARCHAR(20), COUNT(*)) FROM dbo.[VerdictReviews] WHERE verdict_id = @verdict;
