# Repository collaboration rules

These instructions apply to GPT/Codex, Claude, and other coding agents across this repository.

## Branches and pull requests
- Never push commits directly to `main`; never force-push `main`.
- Start each task from the latest remote `main`, using a new short-lived branch: `gpt/<task>` or `claude/<task>`.
- Read CONTRIBUTING.md before editing. Inspect open PRs and relevant recent changes before choosing files to modify.
- If another active task changes the same files or data contract, coordinate scope with the user before overlapping work. Branches alone do not prevent logical conflicts.
- Commit only the task's changes and open a PR targeting `main`.
- Before merging, fetch the latest `main`, inspect intervening changes, resolve conflicts on the task branch, and repeat relevant checks.
- Do not overwrite another agent's work or force-push a shared branch.
- Merge only after the user's authorization covers the change and relevant checks pass. Report the PR and validation results accurately.
- After merging, verify the Pages deployment if site files changed; do not equate a successful merge with a successful deployment.

## Site-specific checks
- Preserve existing restaurant identifiers, saved lists, import/export compatibility, and data provenance.
- For UI changes, check desktop and narrow mobile layouts, search/filter behavior, and affected map/list features.
- For cached asset changes, inspect `sw.js` and verify both a fresh visit and upgrade from an existing installation. Do not clear users' saved lists to fix cache issues.
- Never claim checks were performed unless they actually ran; record limitations in the PR.
