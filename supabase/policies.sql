alter table public.admin_users enable row level security;
alter table public.notes enable row level security;
alter table public.posts enable row level security;
alter table public.gallery_items enable row level security;
alter table public.music_items enable row level security;
alter table public.music_reviews enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists "Users can view own admin membership" on public.admin_users;
create policy "Users can view own admin membership"
on public.admin_users
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Admins can read all admin memberships" on public.admin_users;
create policy "Admins can read all admin memberships"
on public.admin_users
for select
to authenticated
using (public.is_admin());

drop policy if exists "Public can read published notes" on public.notes;
create policy "Public can read published notes"
on public.notes
for select
to anon, authenticated
using (is_published = true);

drop policy if exists "Admins can read all notes" on public.notes;
create policy "Admins can read all notes"
on public.notes
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert notes" on public.notes;
create policy "Admins can insert notes"
on public.notes
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update notes" on public.notes;
create policy "Admins can update notes"
on public.notes
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete notes" on public.notes;
create policy "Admins can delete notes"
on public.notes
for delete
to authenticated
using (public.is_admin());

drop policy if exists "Public can read published posts" on public.posts;
create policy "Public can read published posts"
on public.posts
for select
to anon, authenticated
using (is_published = true);

drop policy if exists "Admins can read all posts" on public.posts;
create policy "Admins can read all posts"
on public.posts
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert posts" on public.posts;
create policy "Admins can insert posts"
on public.posts
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update posts" on public.posts;
create policy "Admins can update posts"
on public.posts
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete posts" on public.posts;
create policy "Admins can delete posts"
on public.posts
for delete
to authenticated
using (public.is_admin());

drop policy if exists "Public can read published gallery items" on public.gallery_items;
create policy "Public can read published gallery items"
on public.gallery_items
for select
to anon, authenticated
using (is_published = true);

drop policy if exists "Admins can read all gallery items" on public.gallery_items;
create policy "Admins can read all gallery items"
on public.gallery_items
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert gallery items" on public.gallery_items;
create policy "Admins can insert gallery items"
on public.gallery_items
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update gallery items" on public.gallery_items;
create policy "Admins can update gallery items"
on public.gallery_items
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete gallery items" on public.gallery_items;
create policy "Admins can delete gallery items"
on public.gallery_items
for delete
to authenticated
using (public.is_admin());

drop policy if exists "Public can read published music items" on public.music_items;
create policy "Public can read published music items"
on public.music_items
for select
to anon, authenticated
using (is_published = true);

drop policy if exists "Admins can read all music items" on public.music_items;
create policy "Admins can read all music items"
on public.music_items
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert music items" on public.music_items;
create policy "Admins can insert music items"
on public.music_items
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update music items" on public.music_items;
create policy "Admins can update music items"
on public.music_items
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete music items" on public.music_items;
create policy "Admins can delete music items"
on public.music_items
for delete
to authenticated
using (public.is_admin());

drop policy if exists "Public can read published music reviews" on public.music_reviews;
create policy "Public can read published music reviews"
on public.music_reviews
for select
to anon, authenticated
using (is_published = true);

drop policy if exists "Admins can read all music reviews" on public.music_reviews;
create policy "Admins can read all music reviews"
on public.music_reviews
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert music reviews" on public.music_reviews;
create policy "Admins can insert music reviews"
on public.music_reviews
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update music reviews" on public.music_reviews;
create policy "Admins can update music reviews"
on public.music_reviews
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete music reviews" on public.music_reviews;
create policy "Admins can delete music reviews"
on public.music_reviews
for delete
to authenticated
using (public.is_admin());

drop policy if exists "Public can read site settings" on public.site_settings;
create policy "Public can read site settings"
on public.site_settings
for select
to anon, authenticated
using (true);

drop policy if exists "Admins can insert site settings" on public.site_settings;
create policy "Admins can insert site settings"
on public.site_settings
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update site settings" on public.site_settings;
create policy "Admins can update site settings"
on public.site_settings
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete site settings" on public.site_settings;
create policy "Admins can delete site settings"
on public.site_settings
for delete
to authenticated
using (public.is_admin());

drop policy if exists "Admins can upload managed media" on storage.objects;
create policy "Admins can upload managed media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('images', 'covers', 'audio')
  and public.is_admin()
);

drop policy if exists "Admins can update managed media" on storage.objects;
create policy "Admins can update managed media"
on storage.objects
for update
to authenticated
using (
  bucket_id in ('images', 'covers', 'audio')
  and public.is_admin()
)
with check (
  bucket_id in ('images', 'covers', 'audio')
  and public.is_admin()
);

drop policy if exists "Admins can delete managed media" on storage.objects;
create policy "Admins can delete managed media"
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('images', 'covers', 'audio')
  and public.is_admin()
);
