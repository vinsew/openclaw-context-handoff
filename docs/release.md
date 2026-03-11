# Release Guide

## Standard release checklist

1. Update code and docs.
2. Update [CHANGELOG.md](../CHANGELOG.md).
3. Bump the version in `package.json`.
4. Run:

```bash
npm pack --json
```

5. Publish:

```bash
npm publish --access public
```

6. Create a GitHub release and paste the matching changelog notes.

## Notes

- npm package name: `openclaw-context-handoff`
- internal plugin id: `context-monitor`
- keep install instructions aligned between README and published package
