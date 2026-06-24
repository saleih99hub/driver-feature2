# Arif Foods — Night Injera Orders (PWA)

Customers order injera at night (bag of 5 / bag of 10); the baker unlocks a
PIN-protected dashboard in the morning to see every customer's order and the
total injera to bake. Orders live in Supabase, so all 25+ customers and the
baker see the same live data.

**Privacy model:** customers can only *submit* orders. The order list (names,
phones, quantities) can only be read through database functions that verify
the baker PIN *server-side*. Even someone reading the app's source code
cannot pull the customer list without the PIN.

---

## 1. Create the Supabase backend (~5 minutes, free)

1. Go to https://supabase.com → **Start your project** → sign in with GitHub
   or email. Create a new project (any name, e.g. `arif-orders`). Pick the
   **West US** region (closest to Seattle). Save the database password it asks
   you to create (you won't need it day-to-day).
2. Open **SQL Editor** (left sidebar) → **New query**.
3. Open `supabase/setup.sql` from this project, **change the PIN** on the line
   marked `>>> SET YOUR BAKER PIN HERE <<<`, paste the whole file into the
   editor, and click **Run**. You should see "Success".
4. Go to **Project Settings → API** and copy two values:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon / public key** (long string starting with `eyJ...`)

> The anon key is safe to ship in the app — that's what it's for. The
> database rules you just ran are what keep the data private.

## 2. Run it locally (optional but recommended)

Requires Node.js 18+.

```bash
cp .env.example .env        # then paste your URL + anon key into .env
npm install
npm run dev                 # opens http://localhost:5173
```

Submit a test order, tap **Staff sign-in** in the footer, enter your PIN,
and confirm the order shows in the dashboard.

## 3. Deploy to Vercel (free)

1. Push this folder to a GitHub repository (private is fine).
2. Go to https://vercel.com → **Add New → Project** → import the repo.
   Vercel auto-detects Vite; keep the defaults.
3. Under **Environment Variables**, add both values from step 1.4:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Click **Deploy**. You'll get a URL like `arif-night-orders.vercel.app`.
5. (Optional) Add a custom domain like `orders.ariffoods.com`:
   Vercel → Project → Settings → Domains, then add a CNAME record in your
   Squarespace DNS pointing `orders` to `cname.vercel-dns.com`.

## 4. Get it on customers' phones

Send the link to your 25 customers (text/WhatsApp group works well):

- **iPhone:** open the link in Safari → Share button → **Add to Home Screen**
- **Android:** open in Chrome → it will offer **Install app** (or ⋮ menu →
  Add to Home screen)

It then launches full-screen with the Arif icon like a normal app.

## 5. Daily use

- **Customers:** open the app at night, enter name + quantities, submit.
  At least one bag size (5 or 10) must have a quantity or the app blocks
  the order.
- **Baker:** open the app → **Staff sign-in** (footer) → PIN → dashboard
  shows today's orders by default, with totals for bags of 5, bags of 10,
  and total injera to bake. Use the date picker for any past night and the
  ✕ button to remove cancelled orders. **Lock** returns to the customer view.

## Changing the baker PIN

Supabase → SQL Editor → run:

```sql
update public.app_settings set value = 'NEWPIN' where key = 'baker_pin';
```

Takes effect immediately; the baker just signs in with the new PIN.

## Project structure

```
├── index.html              App shell
├── vite.config.js          Build + PWA manifest/service worker
├── package.json
├── public/icons/           Arif-branded app icons
├── src/
│   ├── main.jsx            Entry point
│   ├── App.jsx             Order form + PIN gate + baker dashboard
│   └── supabase.js         Data layer (insert order, verify PIN, fetch/delete)
└── supabase/setup.sql      One-time database setup (run in SQL Editor)
```

## Costs

- Supabase free tier: 500 MB database — decades of injera orders.
- Vercel free tier: more than enough for 25 customers.
- Custom domain: only if you want `orders.ariffoods.com` (you already own
  ariffoods.com, so it's free to add the subdomain).

Total: **$0/month**.
