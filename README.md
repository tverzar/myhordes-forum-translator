# MyHordes Forum Translator (Firefox + Chrome)

Translates forum posts on [myhordes.eu](https://myhordes.eu) between French, English,
Russian and Spanish (any direction), and helps you write a reply in your own
language and translate it into the forum's language before posting.

Ships as two packages built from one shared source: `firefox/` (Manifest V2)
and `chrome/` (Manifest V3).

## Features

- Adds a `[ EN ▾ Translate ]`-style control to every forum post's action bar.
  Pick a target language and click Translate — the translation appears in a
  highlighted block right under the post. Click again to hide it.
- Auto-detects the source language (any of FR/EN/RU/ES, or anything else the
  translation service supports).
- Works with the forum's AJAX pagination and dynamically loaded threads (uses
  a `MutationObserver`, not a one-time page scan).
- When you open the post editor (new post/reply), a "✎ Write in my language &
  translate" panel appears above it. Type your message, pick the target
  language, click **Translate & insert** — the translated text is inserted
  into the editor (appended, so it won't erase an existing quote).
- Four translation providers, chosen in the addon's options:
  - **Google Translate** (free, no signup, default).
  - **MyMemory** (free, no key, ~5000 words/day).
  - **DeepL** (best quality, needs your own API key — free tier requires a card at signup, no charge under quota).
  - **Yandex Translate** (very good for Russian, needs a Yandex Cloud API key + folder ID, also requires a linked card).

## Project layout

```
shared/            source of truth: content script, options page, translation providers
firefox/            Firefox package (Manifest V2, background page)
chrome/              Chrome package (Manifest V3, service worker)
build.js            copies shared/ into firefox/ and chrome/
```

Only `firefox/manifest.json` + `firefox/background/background.js` and
`chrome/manifest.json` + `chrome/background/background.js` are
browser-specific (MV2 background page vs. MV3 service worker). Everything
else — `content/`, `options/`, `background/providers.js` — is identical in
both packages.

**After editing anything under `shared/`, run `node build.js`** to re-copy it
into both packages before testing/reloading either browser's copy.

## Install

### Firefox (temporary, for development/personal use)

1. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select `firefox/manifest.json`.
4. The addon is now active on myhordes.eu until you restart Firefox (you'll
   need to reload it then).

For a permanent install, package with [web-ext](https://github.com/mozilla/web-ext)
(`npx web-ext lint --source-dir=./firefox` to validate,
`npx web-ext build --source-dir=./firefox` to zip it) and either
self-distribute a signed `.xpi` (`web-ext sign`, needs a free AMO API key) or
submit it to addons.mozilla.org.

### Chrome / Chromium (Edge, Brave, etc.)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `chrome/` folder.
4. The addon is now active on myhordes.eu.

For the Chrome Web Store, zip the contents of `chrome/` and upload it via the
[developer dashboard](https://chrome.google.com/webstore/devconsole) (a
one-time $5 registration fee applies).

## Configure

Open the options page: `about:addons` → this addon → Preferences (Firefox),
or `chrome://extensions` → this extension → Details → Extension options
(Chrome).

- **Translate forum posts into**: your reading language, used as the default
  in the per-post language dropdown.
- **Translation provider**: Google Translate (default), MyMemory, DeepL, or Yandex Translate.
  - For DeepL, paste your API key. Free-tier keys end in `:fx` and are
    detected automatically to use the correct API endpoint
    (`api-free.deepl.com` vs `api.deepl.com`). Get a key at
    <https://www.deepl.com/pro-api> (a card is required at signup, even for
    the free plan — you won't be charged while under the free quota).
  - For Yandex Translate, you need both an API key and a folder ID from the
    [Yandex Cloud console](https://console.cloud.yandex.com/) (also requires
    linking a card to the Cloud account, similar to DeepL).
  - MyMemory needs nothing — just pick it and go, but it has the lowest
    translation quality and a daily quota (~5000 words, shared across all
    anonymous users of that IP).

The "Translate to" language used by the compose panel is remembered
separately (defaults to French) and can be changed directly from the
dropdown next to the panel.

## Translation quality (rough ranking)

1. **DeepL** — best overall, especially FR/ES/EN. Requires a card at signup.
2. **Yandex Translate** — best specifically for Russian. Requires a card at signup.
3. **Google Translate** — good all-round, no signup — the default for that reason.
4. **MyMemory** — noticeably rougher output, but zero setup and no card ever.

## How it targets the forum

The content script matches on `.forum-post` / `.forum-post-content` /
`.forum-post-footer` and the `<hordes-twino-editor>` custom element, which
are the actual class names/element used by MyHordes' own forum templates
(`templates/ajax/forum/posts.html.twig`, `templates/ajax/editor/base/forum-editor.html.twig`
in the MyHordes source). If MyHordes changes its forum markup, update the
selectors in `shared/content/content.js` and re-run `node build.js`.

## Notes / limitations

- The Google Translate endpoint used here (`translate.googleapis.com`) is the
  free, unofficial one used by the "gtx" client — it can occasionally
  rate-limit or change without notice. Switch providers in the options if
  that happens.
- Translations of forum posts are shown as plain text underneath the post;
  the original post (images, spoilers, polls, BBCode formatting) is left
  untouched.
- Inserting into the editor replaces the editor's whole HTML with
  `existing content + translated text`, since that's the only API the forum's
  `<hordes-twino-editor>` component exposes for programmatic edits.
- The Firefox manifest declares `data_collection_permissions` (websiteContent,
  personalCommunications) because translating text necessarily sends it to
  the chosen third-party translation provider — required since Firefox 140+
  for all extensions distributed through AMO.
