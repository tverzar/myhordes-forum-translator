# MyHordes Forum Translator (Tampermonkey userscript)
<img width="377" height="707" alt="firefox_VDE9xijYku" src="https://github.com/user-attachments/assets/bc65ad4c-3a94-400e-9502-e10b03c1caa0" />


Translates forum posts on MyHordes (myhordes.eu, myhordes.de, myhordes.fr,
myhordes.com — same app, different community domains) between French,
English, Russian and Spanish (any direction), and lets you write a reply in
your own language and have it replaced with the translated version before
posting.

One file, no build step, no browser store, no signing — install it in
[Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge, etc.)
and it just works, permanently, immediately.

## Features

- Adds a small **🌐 Translate** button under every forum post. One click
  translates it into your configured reading language and shows the
  translation in a highlighted block right under the post. Click again to
  hide it. No per-post language picker — the language is fixed once in the
  settings panel.
- Auto-detects the source language (any of FR/EN/RU/ES, or anything else the
  translation service supports).
- Works with the forum's AJAX pagination and dynamically loaded threads (uses
  a `MutationObserver`, not a one-time page scan).
- When you open the post editor (new post/reply), a **🌐 Translate my
  message** button appears above it. Type your reply in your own language,
  click it — the editor's content is replaced in place with the translation
  into your configured writing language.
- A floating **🌐** button (bottom-right corner of the page) opens the
  settings panel: reading language, writing/reply language, translation
  provider, API keys.
- Four translation providers:
  - **Google Translate** (free, no signup, default).
  - **MyMemory** (free, no key, ~5000 words/day).
  - **DeepL** (best quality, needs your own API key — free tier requires a card at signup, no charge under quota).
  - **Yandex Translate** (very good for Russian, needs a Yandex Cloud API key + folder ID, also requires a linked card).

## Install

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension
   (works in Chrome, Firefox, Edge, Brave, Opera...).
2. Open Tampermonkey's dashboard → **Create a new script**, delete the
   placeholder content, and paste in the contents of
   [`tampermonkey/myhordes-forum-translator.user.js`](tampermonkey/myhordes-forum-translator.user.js).
   (Or: Tampermonkey dashboard → Utilities → **Import from file** and pick
   that file directly.)
3. Save (Ctrl+S). That's it — no restart needed, it's live immediately on
   any myhordes.eu/.de/.fr/.com page.

### Updating

The script ships with `@updateURL`/`@downloadURL` pointing at this repo, so
Tampermonkey checks for new versions on its own (periodically, per its
Settings → Update interval). To force an immediate check instead of waiting:
Tampermonkey Dashboard → **Utilities** tab → **Update all scripts to their
latest version** (or open the script and use its own "check for updates").

## Configure

Click the **🌐** button fixed at the bottom-right corner of any MyHordes
page:

- **Translate forum posts into**: your reading language — used by the
  per-post 🌐 Translate button.
- **Translate my replies into**: your writing language — used by the 🌐
  Translate my message button above the reply editor.
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

All settings are stored via Tampermonkey's `GM_setValue`/`GM_getValue`
(local to your browser, per-script).

## Translation quality (rough ranking)

1. **DeepL** — best overall, especially FR/ES/EN. Requires a card at signup.
2. **Yandex Translate** — best specifically for Russian. Requires a card at signup.
3. **Google Translate** — good all-round, no signup — the default for that reason.
4. **MyMemory** — noticeably rougher output, but zero setup and no card ever.

## How it targets the forum

The script matches on `.forum-post` / `.forum-post-content` /
`.forum-post-footer` and the `<hordes-twino-editor>` custom element, which
are the actual class names/element used by MyHordes' own forum templates
(`templates/ajax/forum/posts.html.twig`, `templates/ajax/editor/base/forum-editor.html.twig`
in the MyHordes source). If MyHordes changes its forum markup, update the
selectors in `tampermonkey/myhordes-forum-translator.user.js`.

## Notes / limitations

- The Google Translate endpoint used here (`translate.googleapis.com`) is the
  free, unofficial one used by the "gtx" client — it can occasionally
  rate-limit or change without notice. Switch providers in the 🌐 settings if
  that happens.
- Translations of forum posts are shown as plain text underneath the post;
  the original post (images, spoilers, polls, BBCode formatting) is left
  untouched.
- The "Translate my message" button **replaces** the reply editor's whole
  content with the translation — it doesn't merge with what was there
  before, since that's the only API the forum's `<hordes-twino-editor>`
  component exposes for programmatic edits.
- Cross-origin requests to the translation APIs go through
  `GM_xmlhttpRequest`, which Tampermonkey exempts from the page's CORS
  restrictions — no background script or manifest permissions needed.
