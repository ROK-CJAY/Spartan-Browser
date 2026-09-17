# Spartan Browser

Miami-Dade County Help Desk browser (Spartan).

## Hosted updates

Desks check this repo for:

- Knowledge admin allow list: [`policy/desk-policy.json`](policy/desk-policy.json)
- Remedy knowledge catalog: [`knowledge/desk-knowledge.json`](knowledge/desk-knowledge.json)
- App releases: GitHub Releases (`v*.*.*` tags)

Raw URLs:

- `https://raw.githubusercontent.com/ROK-CJAY/Spartan-Browser/main/policy/desk-policy.json`
- `https://raw.githubusercontent.com/ROK-CJAY/Spartan-Browser/main/knowledge/desk-knowledge.json`

To change admins, edit `policy/desk-policy.json` on `main`. Desks refresh policy on launch and every 30 minutes.

Knowledge admins can upload a Remedy Excel/CSV export in **Knowledge admin**, then **Publish to all desks**. That writes `knowledge/desk-knowledge.json`. Every open Spartan pulls it about once a minute — no restart. Publishing needs a GitHub token with Contents access (stored only on that PC).

## Desk agent

Workspace asks a real desk agent over the Remedy catalog (not SmartIT scrape, not a web search):

1. Optional County Grok key (`XAI_API_KEY` on the machine)
2. Optional Ollama on this PC, or one County host listed as `modelUrl` in `policy/desk-policy.json` (localhost, `*.miamidade.gov`, or a private RFC1918 address)
3. Always: an extractive answer from the matching current article, with outdated copies cited not followed

The installed Windows app launches Notepad, Calculator, TeamViewer, Mocha, Lockout Status, ADUC, and CmRC on this PC. County sites (NSD, SmartIT, MyIT, Entra) send the signed-in Windows account over NTLM/Kerberos and use the PC’s system proxy / PAC so the desk looks like it is on the County network.

## Installable Windows release

Push a version tag to build a Setup `.exe` and attach it to a GitHub Release:

1. Set the same version in `package.json` and `src/lib/browser/desk-updates.ts` (`APP_VERSION`).
2. Commit on `main`.
3. Tag and push:

```
git tag v0.9.7
git push origin v0.9.7
```

GitHub Actions (Windows) runs tests, builds `SpartanBrowser-Setup-<version>.exe` with NSIS, and publishes the Release (installer + `latest.yml` + policy file).

Installed desks auto-check that Release. **Settings → About → Check for updates** also reads the policy file. Unsigned builds are expected until a County code-signing cert is added.
