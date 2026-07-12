# Releasing

## Release checklist

1. Verify tests pass:
   - `npm test`
2. Verify package contents:
   - `npm pack --dry-run`
3. Ensure npm auth is active:
   - `npm whoami`
4. Bump version in `package.json` and add entry to `CHANGELOG.md`.
5. Publish:
   - `npm publish --access public`
6. Tag release in git:
   - `git tag v<version>`
   - `git push origin v<version>`

## Notes

- Package name: `@tacman1123/twig-browser`
- License: BSD-2-Clause
- Third-party attribution: `THIRD_PARTY_NOTICES.md`
- Consumers using Symfony AssetMapper should run `importmap:require` after each version bump
  to pull down updated vendored files.
- `npm publish` runs `scripts/check-not-regressed.mjs` (via `prepublishOnly`), which refuses to
  publish if `package.json`'s version isn't strictly newer than the registry's current `latest`.
  This exists because a stale local checkout was once published over a much newer version,
  silently retagging `latest` backward and breaking every consumer (2026-07). If this check
  ever fires unexpectedly, it means you're publishing from the wrong commit — `git pull` first.
