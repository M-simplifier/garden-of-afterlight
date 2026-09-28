# Afterlight technical guide

The guide is served at
<https://m-simplifier.github.io/garden-of-afterlight/guide/>.
It is a separate static page. The game's entry page and menus do not link to it.

`index.html` contains the Japanese article, styles, interactions and extracted
Haskell declarations. Source links point to the exact `9163e6b` revision used by
the article. The three screenshots live in `assets/`; the guide loads no game
runtime, analytics, external fonts or scripts.

`card.html` is the 1200 × 630 HTML artwork for `assets/social-card.jpg`.
Render it in a browser at that viewport and capture the page content when
updating the card. The current image uses the same night scene, typography and
title as the article. Both Open Graph and `summary_large_image` metadata are
included directly in `index.html`, with absolute HTTPS image URLs.

## Preview and package

From the repository root:

```sh
python3 -m http.server 8000 --directory web
```

Open `http://127.0.0.1:8000/guide/`. `web/build.sh` also copies the guide and its
assets into `guide/` in a normal browser build. `card.html` and this README are
authoring files and are not copied to the game distribution.

The current GitHub Pages source is the root of `gh-pages`. For a guide-only
update, copy `index.html` and `assets/` to that branch's `guide/` directory and
commit only that directory. Preserve every existing game file. No Haskell or
Wasm rebuild is needed for an article update.

If the published card is replaced, use a new image filename and update the
Open Graph and Twitter image URLs together so existing social caches can fetch
the new image. A successful public fetch and valid metadata do not by themselves
confirm the final card rendered by X.
