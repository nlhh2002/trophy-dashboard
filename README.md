# Clash of Clans Trophy Dashboard — GitHub Pages edition

This edition converts the supplied Express/node-cron project into a static GitHub Pages site updated by GitHub Actions. It tracks up to 10 Clash of Clans players and ranks them by **Home Village trophies** (`player.trophies`). Builder Base trophies are not used.

## Files

- `docs/index.html` — public dashboard.
- `docs/data/players.json` — public data snapshot read by the site.
- `config/players.json` — the 10 Player Tag slots.
- `scripts/update.js` — fetches player profiles and rebuilds the snapshot.
- `.github/workflows/update.yml` — scheduled updater and manual run workflow.

## 1. Configure the Player Tags

Edit `config/players.json` and replace the empty strings with your Player Tags. Keep exactly 10 entries; unused slots may remain empty. Example:

```json
{
  "tags": [
    "#PLAYER1",
    "#PLAYER2",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    ""
  ]
}
```

Player Tags are public identifiers, not API credentials. Do not put the API token in this file.

## 2. Add the API token as a GitHub Secret

In the repository, open **Settings → Secrets and variables → Actions → New repository secret**.

- Name: `COC_API_TOKEN`
- Secret: your Supercell API token

Never place the token in HTML, JavaScript, JSON, README, or a committed `.env` file.

## 3. Supercell API key and RoyaleAPI proxy

This updater requests the official Clash of Clans player endpoint through:

`https://cocproxy.royaleapi.dev/v1/players/{playerTag}`

RoyaleAPI's proxy documentation says to allowlist `45.79.218.79` in the Supercell Developer Portal and substitute the official Clash of Clans API host with `cocproxy.royaleapi.dev`. The key is sent as `Authorization: Bearer ...` from GitHub Actions; it is never sent to the browser.

Documentation: https://docs.royaleapi.com/proxy

## 4. Enable GitHub Pages

In the repository, open **Settings → Pages**.

Under **Build and deployment**:
- Source: **Deploy from a branch**
- Branch: `main`
- Folder: `/docs`
- Save

The public URL will normally be:

`https://nlhh2002.github.io/trophy-dashboard/`

## 5. Run the updater

Open **Actions → Update Clash of Clans trophies → Run workflow** to test a manual run.

The scheduled target times are:
- 04:55 UTC = 11:55 Vietnam time
- 16:55 UTC = 23:55 Vietnam time

GitHub Actions scheduled workflows are not guaranteed to start at the exact minute and may be delayed. The workflow also runs manually through `workflow_dispatch`.

After a successful run, `docs/data/players.json` is committed to `main`; GitHub Pages serves that public snapshot. The dashboard displays the last successful data update in Vietnam time.

## Notes

- GitHub Pages is static hosting; it does not run Express or server-side routes.
- The browser only downloads the public snapshot JSON. It never receives the Supercell token.
- `data.players[].trophies` is the top-level Home Village trophy field. `builderBaseTrophies` is intentionally ignored.
- Failed lookups retain the last successful row and mark it `stale`; first-time failures appear as `error`.
- Keep repository visibility public if anyone with the URL should be able to access the site.
- GitHub Actions scheduled runs can be delayed, and GitHub may disable scheduled workflows in an inactive public repository after extended inactivity.
- This project is not affiliated with or endorsed by Supercell.
