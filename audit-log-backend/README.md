# Lonex Simple Activity Log — Separate Supabase Setup

This package is for a **new, separate Supabase project only**. It must never be linked to, migrated against, or executed in the existing Lonex Investments database.

The feature is a basic management activity log. Because business data and logs are stored in different projects, a successful business action can be missing from the log when the network or audit service fails. It is not a guaranteed tamper-proof financial audit trail.

## Values required before deployment

- `AUDIT_PROJECT_URL`: `https://<AUDIT_PROJECT_REF>.supabase.co`
- `AUDIT_PROJECT_PUBLISHABLE_KEY`: public/publishable key from the new audit project
- `LONEX_SUPABASE_URL`: URL of the existing primary Lonex project
- `LONEX_SUPABASE_PUBLISHABLE_KEY`: public/publishable key of the primary Lonex project
- `AUDIT_MANAGER_USER_IDS`: comma-separated primary Lonex Auth user UUIDs, for example `<MANAGER_UUID_1>,<MANAGER_UUID_2>`
- `ALLOWED_APP_ORIGINS`: comma-separated exact origins, for example `http://localhost:4200,https://<PRODUCTION_DOMAIN>`

Never place either project's secret/service key in Angular or source control.

## Manual setup steps

1. Create a new Supabase project dedicated to Activity Logs.
2. Confirm that its project reference is different from the existing Lonex project.
3. Open the new project's SQL Editor.
4. Review and run `schema.sql` in the **new audit project only**.
5. Initialize/link a Supabase CLI working directory to the new audit project, or copy the provided `supabase/functions/activity-log/index.ts` into that project's function source.
6. Keep `[functions.activity-log] verify_jwt = false` from `supabase/config.toml`. This is necessary because the supplied user token is issued by the primary project; the function performs explicit primary Auth validation itself.
7. Configure these function secrets in the new audit project:

   ```text
   LONEX_SUPABASE_URL=<PRIMARY_LONEX_PROJECT_URL>
   LONEX_SUPABASE_PUBLISHABLE_KEY=<PRIMARY_LONEX_PUBLIC_KEY>
   AUDIT_MANAGER_USER_IDS=<PRIMARY_MANAGER_UUID_1>,<PRIMARY_MANAGER_UUID_2>
   ALLOWED_APP_ORIGINS=http://localhost:4200,https://<PRODUCTION_DOMAIN>
   ```

8. Deploy only the `activity-log` Edge Function to the new audit project.
9. Put the new audit project's public values into both Angular environment files:

   ```typescript
   auditProjectUrl: 'https://<AUDIT_PROJECT_REF>.supabase.co',
   auditProjectPublishableKey: '<AUDIT_PROJECT_PUBLISHABLE_KEY>'
   ```

10. Sign in as a manager and verify that Analysis → Audit Log loads an empty list.
11. In an isolated non-production workflow, create one test business record and confirm exactly one future event appears.
12. Verify a non-management user receives HTTP 403 on Activity Log reads.
13. Verify resending the same idempotency key does not create another row.
14. Do not backfill, copy, or infer historical events.

## Activation

Activity logging begins only after the Edge Function is deployed and the two Angular public configuration values are set. Existing data is never read into or copied into `activity_logs` automatically.

## Security notes

- The function derives the actor UUID and email from the primary Supabase Auth response.
- Angular cannot select the stored actor.
- Direct table access is revoked from `anon` and `authenticated` in the audit project.
- Management reads are checked against `AUDIT_MANAGER_USER_IDS` inside the function.
- Only action-specific references, short descriptions, amounts, and small non-sensitive detail objects are stored.
- The function exposes no update or delete operation.
