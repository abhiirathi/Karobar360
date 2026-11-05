# Instructions for Claude working on Karobar360

## Every change goes to GitHub, without being asked

`main` is locked: no direct pushes, one approval and the CI check are required. So after **every** change, however small, and without waiting to be asked:

1. **Before starting**, update and branch from the latest main:
   `git switch main && git pull && git switch -c <type>/<short-name>` (type: `feat`, `fix` or `chore`).
   If you are continuing work on an open pull request, stay on its branch instead.
2. **Check it** before committing: `npx tsc --noEmit` and `npm run build` must pass.
   For screen changes, also try it in the demo (`/stone/demo`) and at phone width.
3. **Commit and push** the branch: `git push -u origin <branch>`.
4. **Open a pull request into `main`** (or update the open one) with a short plain-language description of what changed and anything the reviewer should click.
5. **Tell the user** the pull request link and the Vercel preview link once it appears.

Never push to `main`, never force-push, and never merge your own pull request: the other person reviews and merges, and Vercel then deploys the live site.

If the change is not finished when the conversation ends, still commit and push the branch (open the pull request as a draft), so no work is lost.

## Coordination

- Shared files need care: `components/stone/StoneApp.tsx`, `lib/stone/types.ts`, `lib/stone/seed.ts`, `lib/stone/calc.ts`, `components/stone/ui.tsx`, `app/globals.css`. Mention any change to them in the pull request.
- New data fields must be optional; never rename or remove a field without a migration. Customers already have data saved.
- See `CONTRIBUTING.md` for the full routine.

## Product notes

- Stone always moves mine → processing unit → distribution; keep firms, lists and flows in that order.
- Frontend work follows the Taste Skill framework (taste-skill; redesign-skill when revamping an existing screen).
