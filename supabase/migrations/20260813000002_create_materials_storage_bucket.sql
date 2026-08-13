-- The application stores uploaded PDFs and other study files in this private
-- bucket. Keeping bucket creation in a migration means Vercel deployments do
-- not depend on a best-effort runtime call using the service-role secret.
insert into storage.buckets (id, name, public)
values ('materials', 'materials', false)
on conflict (id) do update set public = false;
