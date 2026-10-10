# Repository workflow rules

## Main-only development

- `main` is the only permitted working branch.
- Never create, switch to, push, or propose a feature, fix, chore, release, or other task branch.
- Make repository changes directly on `main`.
- Do not use pull requests as the development workflow for this repository.
- Before making changes, verify the current branch is `main`. If it is not, stop and ask for the safe recovery procedure; do not create another branch.
- Do not delete existing branches or discard commits unless their contents have been inspected and the user has authorized the cleanup.
- Keep automated workflows from creating branches or pull requests. Dependency updates must be handled directly on `main` under the same project rule.
