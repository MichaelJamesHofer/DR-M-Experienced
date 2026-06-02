This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Episodes (dynamic at build)

Each build runs `sync-episodes.mjs`: it pulls **public** episode data from Vimeo, Spotify, and YouTube (app tokens / API keys only, no user login), merges by title/date, sorts by publish date, and writes `episodes-from-platforms.json`. New episodes on any platform show up on the next deploy. One template per episode, same layout and link order (Vimeo → Spotify → YouTube → Rumble). Optional notes/links: `src/data/episodes-enrichment.json` keyed by Vimeo (or Spotify/YouTube) ID.

## Contact and Subscribe Forms

The contact and newsletter forms write directly to Supabase from the static site. Apply the migration in `supabase/migrations`, then configure these GitHub Actions secrets:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`

The anon key is public by design. The SQL enables Row Level Security and only grants anonymous insert access, not read/update/delete access.

## Deploy

The site is statically exported and deployed by `.github/workflows/deploy.yml` to GitHub Pages. The workflow builds `out/` and publishes that artifact, so generated root HTML and `_next/` files are intentionally not committed.

Production custom domain: `drmexperienced.com`.
