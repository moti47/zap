# Admin recovery

If you accidentally removed yourself from admin and you can't reach `/admin` anymore.

## Why the obvious `update` failed

`profiles.is_admin` is locked down by `enforce_admin_pin_trg` from migration `0005_hardening.sql`. The trigger refuses any update that sets `is_admin = true` unless the row's id matches the Postgres GUC `app.admin_user_id`. By default the GUC is empty, so **every** attempt to set `is_admin = true` raises:

```
is_admin can only be true for the env-pinned ADMIN_USER_ID (… != …)
```

## Two ways back in

### Option A — set the GUC, then flip the column

Pick whichever user id is the canonical admin (`select id from auth.users where email = 'you@example.com';`) and pin it in the database GUC:

```sql
-- run as DB owner (Supabase SQL editor uses the owner role)
alter database postgres set app.admin_user_id = '<uuid>';

-- re-connect so the GUC reloads, then:
update public.profiles
   set is_admin = true
 where id = '<uuid>';
```

Re-deploy your app with `ADMIN_USER_ID=<uuid>` set in the environment so the middleware + `requireAdmin()` checks line up.

### Option B — use the `role` column (no GUC needed)

`isCurrentUserAdmin()` also accepts `profiles.role = 'admin'`. The trigger only pins `is_admin`, not `role`, so this works straight from the SQL editor:

```sql
update public.profiles
   set role = 'admin'
 where id = '<uuid>';
```

You still need `ADMIN_USER_ID` set in the environment (the middleware refuses /admin routes by user-id match before it even hits this column), so make sure your `.env.local` has:

```
ADMIN_USER_ID=<uuid>
```

…then restart `next dev`. Visiting `/admin` should now load.

## Verifying

After either fix, `select id, is_admin, role from public.profiles where id = '<uuid>';` should show the admin row, and the topbar should expose the **Admin** nav link the moment you reload the page.

## Note about the 9,999,999 ⚡ bootstrap balance

`bootstrap_admin(uuid)` (from migration `0003_polish_1.sql`) sets `zaps = 9_999_999`. If you'd rather start from a normal balance, after promoting yourself run:

```sql
update public.profiles set zaps = 50 where id = '<uuid>';
```

It's just a number — the rest of the economy works whether you're at 50 or 10 million.
