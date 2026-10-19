# KIP700 website

A static site: no build step, no server. Open `index.html` in a browser to preview.

## Edit your details
Open `config.js` and fill in your email or WhatsApp number, plan prices and Gumroad links. Save and refresh.

## Put it on GitHub and make it live (free with GitHub Pages)
1. Create an account at github.com, then click New repository. Name it `kip700-site`. Leave it empty.
2. In this folder, run:
   ```
   git init
   git add .
   git commit -m "First version of KIP700 site"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/kip700-site.git
   git push -u origin main
   ```
3. On GitHub: Settings > Pages > Source: Deploy from a branch > Branch: `main` / `(root)` > Save.
4. After a minute your site is at `https://YOUR-USERNAME.github.io/kip700-site/`.

## Files
- `index.html`, `styles.css`: the landing page
- `app.html`, `app.css`, `app.js`: the working dashboard (upload CSV or Excel, match columns, see results)
- `config.js`: your prices, links and contact details

## Premium keys
- `keygen.html` makes licence keys (open it on your computer, never upload it; it is in `.gitignore`). Send the key to the buyer and paste the hash line into `licenseHashes` in `config.js`, then push the change.
- Test key for now: `KIP-DEMO-TEST-0001`. Delete its line from `config.js` before you launch.
- Keys are checked in the browser. That is fine for early sales, but a technical user could bypass it. A server-checked system comes later if you need it.
