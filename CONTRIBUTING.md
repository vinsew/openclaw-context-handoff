# Contributing

Thanks for contributing to `openclaw-context-handoff`.

## Scope

This project is intentionally small and opinionated. Good contributions usually
fall into one of these categories:

- bug fixes
- documentation improvements
- safer install and migration behavior
- clearer handoff prompts
- compatibility improvements with OpenClaw plugin loading

## Before you change code

Please open an issue first if the change affects:

- handoff semantics
- threshold behavior
- installation flow
- default configuration
- handoff policy injection

This helps avoid shipping behavior changes that feel small in code but large in
real usage.

## Development notes

- Keep ASCII by default unless a file already uses another charset.
- Preserve the internal plugin id `openclaw-context-handoff`.
- Keep the public npm install story simple.
- Prefer natural-language instructions that agents can follow reliably.
- Do not introduce hardcoded machine-specific paths.

## Local packaging check

Use this command before publishing:

```bash
npm pack --json
```

## Pull requests

Please keep pull requests focused:

- one behavior change per PR when possible
- explain user-facing impact clearly
- mention config compatibility if defaults change
- update docs when behavior changes
- add a changelog entry if the change is notable

## Release mindset

This plugin is used in live agent environments. Favor clarity, portability, and
safe defaults over cleverness.
