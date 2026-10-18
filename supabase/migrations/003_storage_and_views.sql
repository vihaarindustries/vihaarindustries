-- Public product images bucket; sensitive business documents should use a separate private bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('product-media','product-media',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('private-documents','private-documents',false,10485760,array['application/pdf','image/jpeg','image/png']) on conflict(id) do nothing;
create policy "public can view product media" on storage.objects for select using(bucket_id='product-media');
create policy "staff upload product media" on storage.objects for insert to authenticated with check(bucket_id='product-media' and public.is_staff());
create policy "staff update product media" on storage.objects for update to authenticated using(bucket_id='product-media' and public.is_staff()) with check(bucket_id='product-media' and public.is_staff());
create policy "staff delete product media" on storage.objects for delete to authenticated using(bucket_id='product-media' and public.is_staff());
create policy "staff manage private docs" on storage.objects for all to authenticated using(bucket_id='private-documents' and public.is_staff()) with check(bucket_id='private-documents' and public.is_staff());
create or replace view public.admin_order_summary with (security_invoker=true) as select status, currency, count(*) as order_count, coalesce(sum(total_minor),0) as order_value_minor from public.orders group by status,currency;
create or replace view public.trial_balance with (security_invoker=true) as select a.code,a.name,a.account_type,coalesce(sum(l.debit_minor),0) as debit_minor,coalesce(sum(l.credit_minor),0) as credit_minor from public.chart_of_accounts a left join public.journal_lines l on l.account_id=a.id left join public.journal_entries j on j.id=l.journal_entry_id and j.status='posted' group by a.id,a.code,a.name,a.account_type;
