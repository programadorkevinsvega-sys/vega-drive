# Repository workflow rules

## Pull-request development workflow

- `main` is the protected integration and production branch; do not make task changes directly on `main`.
- Create a focused branch from the latest `main` for each task and keep the change scoped to one logical PR.
- Open a pull request targeting `main`; do not merge it on behalf of the owner. The repository owner reviews and merges.
- Never force-push, delete branches, discard commits, or rewrite shared history without explicit authorization.
- Keep CI required checks green on the PR merge ref and verify the post-merge `main` run after the owner merges.
- Do not weaken pnpm supply-chain protections, lockfile validation, permissions, security checks, or branch rules to make a build pass.
- Never run production migrations, deploy, rollback, restore D1, change Cloudflare secrets/bindings/feature flags, or alter production data without explicit owner authorization.
- Do not create or assume a staging environment. The current project operates in production only.
- Do not include secrets, credentials, cookies, tokens, signed URLs, private user data, or raw production logs in commits or documentation.
- Update canonical docs (`README.md`, `roadmap.md`, `Security.md`, `Rollback.md`, architecture and phase docs) whenever implementation or operational behavior changes.
- Preserve historical evidence with its original date; label historical snapshots clearly instead of silently rewriting old test results.
