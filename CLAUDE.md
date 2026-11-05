# Instructions for Claude working on Karobar360

## Every change goes to GitHub, without being asked

`main` is locked: no direct pushes; every change arrives through a pull request whose CI check ("Type check and build") has passed. No approval is required. So after **every** change, however small, and without waiting to be asked:

1. **Before starting**, update and branch from the latest main:
   `git switch main && git pull && git switch -c <type>/<short-name>` (type: `feat`, `fix` or `chore`).
   If you are continuing work on an open pull request, stay on its branch instead.
2. **Check it** before committing: `npx tsc --noEmit` and `npm run build` must pass.
   For screen changes, also try it in the demo (`/stone/demo`) and at phone width.
3. **Commit and push** the branch: `git push -u origin <branch>`.
4. **Open a pull request into `main`** (or update the open one) with a short plain-language description of what changed and anything the reviewer should click.
5. **Merge it yourself once the check is green.** Wait for "Type check and build" to pass, then squash-merge:
   `gh api -X PUT repos/abhiirathi/Karobar360/pulls/<n>/merge -f merge_method=squash`
   and delete the branch. If GitHub says the branch is out of date, merge `origin/main` into it, re-run the checks, push, and wait for the check again. If the check fails, fix it and push; never merge a red check.
6. **Tell the user** the pull request link and that it is merged; the live site updates about 2 minutes later.

Do not merge when the user asked to hold or review it first, when the work is unfinished, or when a migration of saved customer data is involved: leave those as an open pull request and say so.

Never push to `main` directly and never force-push. Vercel deploys `main` to the live site after every merge.

If the change is not finished when the conversation ends, still commit and push the branch (open the pull request as a draft, not merged), so no work is lost.

## Coordination

- Shared files need care: `components/stone/StoneApp.tsx`, `lib/stone/types.ts`, `lib/stone/seed.ts`, `lib/stone/calc.ts`, `components/stone/ui.tsx`, `app/globals.css`. Mention any change to them in the pull request.
- New data fields must be optional; never rename or remove a field without a migration. Customers already have data saved.
- See `CONTRIBUTING.md` for the full routine.

## Product notes

- Stone always moves mine → processing unit → distribution; keep firms, lists and flows in that order.
- Frontend work follows the Taste Skill framework (taste-skill; redesign-skill when revamping an existing screen).
