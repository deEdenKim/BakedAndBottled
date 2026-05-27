# Stock Check

Daily stock management tool for cafe floor restocking and warehouse inventory.

## Setup

### 1. Supabase table

Run this SQL in your Supabase dashboard → SQL Editor:

```sql
create table stock_entries (
  id         uuid default gen_random_uuid() primary key,
  entry_date date not null,
  tab        text not null check (tab in ('floor', 'warehouse')),
  item_name  text not null,
  quantity   integer not null default 0,
  order_flag boolean not null default false,
  created_at timestamptz default now()
);

create index on stock_entries (entry_date, tab);
```

### 2. Environment variables (recommended)

Before deploying publicly, move your keys out of `app.js`:

```
SUPABASE_URL=https://xxzljsnsgfjjfrtkrxlp.supabase.co
SUPABASE_KEY=your_anon_key_here
```

Use a build tool (Vite, Parcel) to inject them, or keep them in `app.js` for a private/internal deployment.

### 3. Deploy to GitHub Pages

```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/deEdenKim/BakedAndBottled/StcockCheck.git
git push -u origin main
```

Then in your repo: Settings → Pages → Source: `main` branch / `/ (root)`

## Files

- `index.html` — markup
- `style.css`  — all styles
- `app.js`     — logic + Supabase integration

## Item categories

| Type | Warehouse unit | Floor unit |
|------|---------------|------------|
| Bulk bags | bags | bags |
| Handful (from box) | handfuls | handfuls |
| Box | boxes | boxes |
| Unit | boxes | units (per piece) |
