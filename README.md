# mise

*Everything in its place* — a simple, self-hostable web app to store, view, and edit your recipes.

> 🚧 Early development.

## Tech stack

- [Next.js](https://nextjs.org) (App Router, TypeScript, Tailwind CSS)
- [Supabase](https://supabase.com) (Postgres, Auth, Storage)
- [Vercel](https://vercel.com) (hosting)

## Features

- Recipes with ingredients, steps, notes, servings, times, category and tags
- Photos of the dish plus scans of the original recipe (card, cookbook page)
- Shared cookbooks: invite family or friends with a one-time link
- Open sign-up or invite-only mode
- English and German UI

## Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In the Supabase **SQL Editor**, run the files in `supabase/migrations/` in order.
3. Optional: under **Authentication → Sign In / Providers → Email**, turn off
   *Confirm email* if you don't want to set up an email provider.
4. Copy `.env.example` to `.env.local` and fill in your project URL and publishable key.
5. Run the app:

   ```bash
   npm install
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) and create your account.

### Invite-only mode

By default anyone can sign up and gets their own cookbook. To allow sign-up
only via invite links (the first account can always be created), run:

```sql
update public.app_config set signup_mode = 'invite';
```

Invite links are created on the **Cookbook** page.

## License

MIT
