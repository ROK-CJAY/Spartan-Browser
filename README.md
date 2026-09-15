# Spartan Browser

Miami-Dade County Help Desk browser (Spartan).

## Hosted updates

Desks check this repo for:

- Knowledge admin allow list: [`policy/desk-policy.json`](policy/desk-policy.json)
- App releases: GitHub Releases (`v*.*.*` tags)

Raw policy URL:

`https://raw.githubusercontent.com/ROK-CJAY/Spartan-Browser/main/policy/desk-policy.json`

To change admins, edit `policy/desk-policy.json` on `main`. Desks refresh on launch and every 30 minutes.

## Installable Windows release

Push a version tag to build a Setup `.exe` and attach it to a GitHub Release:

1. Set the same version in `package.json` and `src/lib/browser/desk-updates.ts` (`APP_VERSION`).
2. Commit on `main`.
3. Tag and push:

```
git tag v0.9.1
git push origin v0.9.1
```

GitHub Actions (Windows) runs tests, builds `SpartanBrowser-Setup-<version>.exe` with NSIS, and publishes the Release (installer + `latest.yml` + policy file).

Installed desks auto-check that Release. **Settings → About → Check now** also reads the policy file. Unsigned builds are expected until a County code-signing cert is added.
