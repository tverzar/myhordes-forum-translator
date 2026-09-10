# MyHordes Forum Translator (Tampermonkey userscript)

Translates forum posts on MyHordes (myhordes.eu, myhordes.de, myhordes.fr,
myhordes.com — same app, different community domains) between French,
English, Russian and Spanish (any direction), and helps you write a reply in
your own language and translate it into the forum's language before posting.

One file, no build step, no browser store, no signing — install it in
[Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge, etc.)
and it just works, permanently, immediately.

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
- A floating ⚙ button (bottom-right corner of the page) opens the settings
  panel: reading language, translation provider, API keys.
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

To update later, just replace the script's contents with the new version the
same way.

## Configure

Click the **⚙** button that appears fixed at the bottom-right corner of any
MyHordes page:

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
dropdown next to the panel. All settings are stored via Tampermonkey's
`GM_setValue`/`GM_getValue` (local to your browser, per-script).

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
  rate-limit or change without notice. Switch providers in the ⚙ settings if
  that happens.
- Translations of forum posts are shown as plain text underneath the post;
  the original post (images, spoilers, polls, BBCode formatting) is left
  untouched.
- Inserting into the editor replaces the editor's whole HTML with
  `existing content + translated text`, since that's the only API the forum's
  `<hordes-twino-editor>` component exposes for programmatic edits.
- Cross-origin requests to the translation APIs go through
  `GM_xmlhttpRequest`, which Tampermonkey exempts from the page's CORS
  restrictions — no background script or manifest permissions needed.
