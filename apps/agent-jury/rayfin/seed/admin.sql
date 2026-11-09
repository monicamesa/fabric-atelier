-- Creates or reactivates the first admin juror.
-- The email is a SQLCMD variable supplied at run time and never stored in the repository:
--   node scripts/run-sql.mjs rayfin/seed/admin.sql --var AdminEmail=ACCOUNT_EMAIL   (value read from .private/values.env)
-- or sqlcmd ... -v AdminEmail="<ACCOUNT_EMAIL>" -i rayfin/seed/admin.sql
SET NOCOUNT ON;

DECLARE @email NVARCHAR(254) = LOWER(LTRIM(RTRIM(N'$(AdminEmail)')));

IF @email = N'' OR @email NOT LIKE N'%_@_%._%'
    THROW 50001, 'AdminEmail is missing or is not an email address.', 1;

IF EXISTS (SELECT 1 FROM dbo.[Jurors] WHERE LOWER(email) = @email)
    UPDATE dbo.[Jurors] SET role = N'admin', active = 1 WHERE LOWER(email) = @email;
ELSE
    INSERT INTO dbo.[Jurors] (id, email, role, team, active) VALUES (NEWID(), @email, N'admin', NULL, 1);

SELECT role, active FROM dbo.[Jurors] WHERE LOWER(email) = @email;
