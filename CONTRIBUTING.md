# Working on Karobar360

`main` is the live site. It is locked: nobody can push to it directly, admins included.
Every change goes through a branch and a pull request.

## The routine

1. Start from the latest main:
   ```bash
   git switch main && git pull
   git switch -c feat/short-name      # or fix/…, chore/…
   ```
2. Make the change. Commit small and often; push the branch whenever you like:
   ```bash
   git push -u origin feat/short-name
   ```
3. Open a pull request into `main` on GitHub. Two things happen on their own:
   - **CI** runs the type check and the build. It must pass before merging.
   - **Vercel** posts a preview link. Click through it before merging.
4. If `main` moved while you worked, bring it in and fix any conflicts on your machine:
   ```bash
   git pull origin main
   ```
5. Merge with **Squash and merge**. Vercel deploys `main` to the live site automatically, and the branch is deleted.

## Keeping out of each other's way

- Keep branches short: merge within a day or two.
- Tell each other before changing shared files: `components/stone/StoneApp.tsx` (menu and routing),
  `lib/stone/types.ts`, `lib/stone/seed.ts`, `lib/stone/calc.ts`, `components/stone/ui.tsx`, `app/globals.css`.
- New data fields must be optional. Never rename or remove a field without a migration:
  customers already have data saved in the old shape.
- Unfinished work can be merged switched off (module settings), instead of keeping a branch alive for weeks.
