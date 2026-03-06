# Releasing

## Release checklist

1. Verify tests pass:
   - `npm test`
2. Verify package contents:
   - `npm pack --dry-run`
3. Ensure npm auth is active:
   - `npm whoami`
4. Publish public scoped package:
   - `npm publish --access public`
5. Tag release in git:
   - `git tag v<version>`
   - `git push origin v<version>`

## Notes

- Package name: `@tacman1123/twig-browser`
- License: BSD-2-Clause
- Third-party attribution: `THIRD_PARTY_NOTICES.md`
