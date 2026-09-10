// ==UserScript==
// @name         MyHordes Forum Translator
// @namespace    https://myhordes.eu/
// @version      1.2.0
// @description  Translate MyHordes forum posts between French, English, Russian and Spanish (Google Translate, MyMemory, DeepL or Yandex), and translate your own replies into the forum's language.
// @author       you
// @updateURL    https://raw.githubusercontent.com/tverzar/myhordes-forum-translator/master/tampermonkey/myhordes-forum-translator.user.js
// @downloadURL  https://raw.githubusercontent.com/tverzar/myhordes-forum-translator/master/tampermonkey/myhordes-forum-translator.user.js
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgdmlld0JveD0iMCAwIDY0IDY0Ij4KICA8Y2lyY2xlIGN4PSIzMiIgY3k9IjMyIiByPSIzMCIgZmlsbD0iIzZhODc1OSIvPgogIDx0ZXh0IHg9IjMyIiB5PSI0NCIgZm9udC1zaXplPSIzNCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+8J+MkDwvdGV4dD4KPC9zdmc+Cg==
// @match        https://myhordes.eu/*
// @match        https://*.myhordes.eu/*
// @match        https://myhordes.de/*
// @match        https://*.myhordes.de/*
// @match        https://myhordes.fr/*
// @match        https://*.myhordes.fr/*
// @match        https://myhordes.com/*
// @match        https://*.myhordes.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      translate.googleapis.com
// @connect      api-free.deepl.com
// @connect      api.deepl.com
// @connect      api.mymemory.translated.net
// @connect      translate.api.cloud.yandex.net
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // Settings (stored via GM_setValue/GM_getValue, per-script and per-site)
  // ---------------------------------------------------------------------

  const DEFAULTS = {
    provider: "google", // "google" | "mymemory" | "deepl" | "yandex"
    deeplApiKey: "",
    yandexApiKey: "",
    yandexFolderId: "",
    targetLang: "en", // reading language: "en" | "fr" | "ru" | "es"
    composeTargetLang: "fr"
  };

  function getSetting(key) {
    return GM_getValue(key, DEFAULTS[key]);
  }

  function setSetting(key, value) {
    GM_setValue(key, value);
  }

  const LANGS = [
    { code: "en", label: "EN" },
    { code: "fr", label: "FR" },
    { code: "ru", label: "RU" },
    { code: "es", label: "ES" }
  ];

  // ---------------------------------------------------------------------
  // Translation providers
  // ---------------------------------------------------------------------

  function gmRequest(details) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        ...details,
        onload: (res) => resolve(res),
        onerror: () => reject(new Error("Network error contacting " + details.url)),
        ontimeout: () => reject(new Error("Timeout contacting " + details.url))
      });
    });
  }

  const DEEPL_TARGET_MAP = { en: "EN-US", fr: "FR", ru: "RU", es: "ES" };

  async function translateGoogle(text, target) {
    const url =
      "https://translate.googleapis.com/translate_a/single" +
      "?client=gtx&sl=auto&tl=" + encodeURIComponent(target) +
      "&dt=t&q=" + encodeURIComponent(text);

    const res = await gmRequest({ method: "GET", url });
    if (res.status < 200 || res.status >= 300) {
      throw new Error("Google Translate HTTP " + res.status);
    }

    const data = JSON.parse(res.responseText);
    if (!Array.isArray(data) || !Array.isArray(data[0])) {
      throw new Error("Unexpected Google Translate response");
    }

    const translated = data[0].map((segment) => segment[0]).join("");
    const detected = typeof data[2] === "string" ? data[2] : null;
    return { translated, detected, provider: "google" };
  }

  async function translateMyMemory(text, target) {
    const url =
      "https://api.mymemory.translated.net/get" +
      "?q=" + encodeURIComponent(text) +
      "&langpair=" + encodeURIComponent("autodetect|" + target);

    const res = await gmRequest({ method: "GET", url });
    if (res.status < 200 || res.status >= 300) {
      throw new Error("MyMemory HTTP " + res.status);
    }

    const data = JSON.parse(res.responseText);
    const translated = data.responseData && data.responseData.translatedText;
    if (typeof translated !== "string") {
      throw new Error("Unexpected MyMemory response");
    }
    if (translated.startsWith("MYMEMORY WARNING") || (data.responseStatus && data.responseStatus !== 200)) {
      throw new Error("MyMemory: " + (data.responseDetails || translated));
    }

    return { translated, detected: data.responseData.detectedLanguage || null, provider: "mymemory" };
  }

  async function translateDeepL(text, target, apiKey) {
    const key = apiKey.trim();
    const isFreeKey = key.endsWith(":fx");
    const base = isFreeKey ? "https://api-free.deepl.com" : "https://api.deepl.com";
    const targetLang = DEEPL_TARGET_MAP[target] || target.toUpperCase();

    const body = "text=" + encodeURIComponent(text) + "&target_lang=" + encodeURIComponent(targetLang);

    const res = await gmRequest({
      method: "POST",
      url: base + "/v2/translate",
      headers: {
        "Authorization": "DeepL-Auth-Key " + key,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      data: body
    });

    if (res.status === 403) {
      throw new Error("DeepL rejected the API key (403). Check the key in the settings panel.");
    }
    if (res.status < 200 || res.status >= 300) {
      throw new Error("DeepL HTTP " + res.status);
    }

    const data = JSON.parse(res.responseText);
    const translation = data.translations && data.translations[0];
    if (!translation) throw new Error("Unexpected DeepL response");

    return {
      translated: translation.text,
      detected: translation.detected_source_language ? translation.detected_source_language.toLowerCase() : null,
      provider: "deepl"
    };
  }

  async function translateYandex(text, target, apiKey, folderId) {
    const res = await gmRequest({
      method: "POST",
      url: "https://translate.api.cloud.yandex.net/translate/v2/translate",
      headers: {
        "Authorization": "Api-Key " + apiKey.trim(),
        "Content-Type": "application/json"
      },
      data: JSON.stringify({
        folderId: folderId.trim(),
        texts: [text],
        targetLanguageCode: target
      })
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error("Yandex Translate rejected the API key or folder ID (" + res.status + "). Check the settings panel.");
    }
    if (res.status < 200 || res.status >= 300) {
      throw new Error("Yandex Translate HTTP " + res.status);
    }

    const data = JSON.parse(res.responseText);
    const translation = data.translations && data.translations[0];
    if (!translation) throw new Error("Unexpected Yandex Translate response");

    return {
      translated: translation.text,
      detected: translation.detectedLanguageCode || null,
      provider: "yandex"
    };
  }

  async function translate(text, target) {
    const provider = getSetting("provider");

    switch (provider) {
      case "deepl": {
        const key = getSetting("deeplApiKey");
        if (!key) throw new Error("No DeepL API key set. Open the 🌐 settings panel and add one, or switch provider.");
        return translateDeepL(text, target, key);
      }
      case "yandex": {
        const key = getSetting("yandexApiKey");
        const folderId = getSetting("yandexFolderId");
        if (!key || !folderId) throw new Error("Yandex Translate needs both an API key and a folder ID. Open the 🌐 settings panel, or switch provider.");
        return translateYandex(text, target, key, folderId);
      }
      case "mymemory":
        return translateMyMemory(text, target);
      default:
        return translateGoogle(text, target);
    }
  }

  // ---------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------

  const style = document.createElement("style");
  style.textContent = `
    .mh-translate-controls { display: block; clear: both; max-width: 100%; margin-top: 4px; }
    .mh-translate-btn {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 2px 10px; border-radius: 10px;
      background: rgba(106, 135, 89, 0.15); border: 1px solid #6a8759;
      color: inherit; font-size: 0.85em; line-height: 1.6;
      text-decoration: none; cursor: pointer;
    }
    .mh-translate-btn:hover { background: rgba(106, 135, 89, 0.3); }
    .mh-translate-btn::before { content: "🌐"; font-size: 0.9em; }

    .mh-translation-block { margin-top: 6px; padding: 6px 8px; border-left: 3px solid #6a8759; background: rgba(106, 135, 89, 0.1); font-size: 0.95em; }
    .mh-translation-header { font-size: 0.8em; opacity: 0.7; margin-bottom: 4px; }

    .mh-compose-controls { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap; }
    .mh-compose-status { font-size: 0.85em; opacity: 0.8; }

    #mh-translate-fab {
      position: fixed; right: 16px; bottom: 16px; z-index: 100000;
      width: 40px; height: 40px; border-radius: 50%; border: none;
      background: #6a8759; color: #fff; font-size: 20px; cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      display: flex; align-items: center; justify-content: center; padding: 0;
    }
    #mh-translate-fab:hover { background: #557046; }

    #mh-translate-settings-overlay {
      position: fixed; inset: 0; z-index: 100001;
      background: rgba(0,0,0,0.45);
      display: flex; align-items: center; justify-content: center;
    }
    #mh-translate-settings-overlay[hidden] {
      display: none;
    }
    #mh-translate-settings-panel {
      background: #fdfaf3; color: #2a2a2a; width: 380px; max-width: calc(100vw - 32px);
      max-height: calc(100vh - 32px); overflow: auto;
      border-radius: 6px; padding: 16px 18px; font-family: sans-serif; font-size: 13px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    }
    #mh-translate-settings-panel h2 { font-size: 15px; margin: 0 0 10px; }
    #mh-translate-settings-panel fieldset { border: 1px solid #ccc; border-radius: 4px; margin: 0 0 10px; }
    #mh-translate-settings-panel label { display: block; margin: 6px 0; }
    #mh-translate-settings-panel .mh-indent { margin-left: 18px; }
    #mh-translate-settings-panel input[type="password"],
    #mh-translate-settings-panel input[type="text"] { width: 100%; box-sizing: border-box; }
    #mh-translate-settings-panel .mh-hint { font-size: 11px; opacity: 0.75; margin: 4px 0 0; }
    #mh-translate-settings-panel .mh-settings-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
    #mh-translate-settings-panel button { cursor: pointer; }
  `;
  document.head.appendChild(style);

  // ---------------------------------------------------------------------
  // Settings panel (gear button + modal)
  // ---------------------------------------------------------------------

  function buildLangSelect(selected) {
    const select = document.createElement("select");
    select.className = "mh-translate-lang";
    LANGS.forEach((lang) => {
      const opt = document.createElement("option");
      opt.value = lang.code;
      opt.textContent = lang.label;
      if (lang.code === selected) opt.selected = true;
      select.appendChild(opt);
    });
    return select;
  }

  function buildSettingsPanel() {
    const overlay = document.createElement("div");
    overlay.id = "mh-translate-settings-overlay";
    overlay.hidden = true;

    const panel = document.createElement("div");
    panel.id = "mh-translate-settings-panel";
    overlay.appendChild(panel);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.hidden = true;
    });

    const title = document.createElement("h2");
    title.textContent = "MyHordes Forum Translator";
    panel.appendChild(title);

    // Reading language
    const readingFieldset = document.createElement("fieldset");
    const readingLegend = document.createElement("legend");
    readingLegend.textContent = "Reading translations";
    readingFieldset.appendChild(readingLegend);

    const readingLabel = document.createElement("label");
    readingLabel.textContent = "Translate forum posts into: ";
    const readingSelect = buildLangSelect(getSetting("targetLang"));
    readingSelect.classList.remove("mh-translate-lang");
    readingLabel.appendChild(readingSelect);
    readingFieldset.appendChild(readingLabel);
    panel.appendChild(readingFieldset);

    // Writing language
    const writingFieldset = document.createElement("fieldset");
    const writingLegend = document.createElement("legend");
    writingLegend.textContent = "Writing replies";
    writingFieldset.appendChild(writingLegend);

    const writingLabel = document.createElement("label");
    writingLabel.textContent = "Translate my replies into: ";
    const writingSelect = buildLangSelect(getSetting("composeTargetLang"));
    writingSelect.classList.remove("mh-translate-lang");
    writingLabel.appendChild(writingSelect);
    writingFieldset.appendChild(writingLabel);

    const writingHint = document.createElement("p");
    writingHint.className = "mh-hint";
    writingHint.textContent = "Write your reply in your own language in the editor, then click the 🌐 Translate button that appears above it — it replaces what you typed with the translation into this language.";
    writingFieldset.appendChild(writingHint);

    panel.appendChild(writingFieldset);

    // Provider
    const providerFieldset = document.createElement("fieldset");
    const providerLegend = document.createElement("legend");
    providerLegend.textContent = "Translation provider";
    providerFieldset.appendChild(providerLegend);

    const providerRadios = {};
    const providerOptions = [
      ["google", "Google Translate — free, no signup or key required."],
      ["mymemory", "MyMemory — free, no key, ~5000 words/day (lower quality)."],
      ["deepl", "DeepL — best quality, needs your own API key."],
      ["yandex", "Yandex Translate — very good for Russian, needs API key + folder ID."]
    ];

    providerOptions.forEach(([value, text]) => {
      const label = document.createElement("label");
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "mh-provider";
      radio.value = value;
      providerRadios[value] = radio;
      label.appendChild(radio);
      label.appendChild(document.createTextNode(" " + text));
      providerFieldset.appendChild(label);

      if (value === "deepl") {
        const wrap = document.createElement("div");
        wrap.className = "mh-indent";

        const keyLabel = document.createElement("label");
        keyLabel.textContent = "DeepL API key: ";
        const keyInput = document.createElement("input");
        keyInput.type = "password";
        keyInput.autocomplete = "off";
        keyInput.placeholder = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx[:fx]";
        keyInput.id = "mh-deepl-key";
        keyLabel.appendChild(keyInput);
        wrap.appendChild(keyLabel);

        const hint = document.createElement("p");
        hint.className = "mh-hint";
        hint.textContent = "Free-plan keys end in \":fx\" and are detected automatically. A card is required at DeepL signup, even for the free plan (no charge under the free quota).";
        wrap.appendChild(hint);

        providerFieldset.appendChild(wrap);
      }

      if (value === "yandex") {
        const wrap = document.createElement("div");
        wrap.className = "mh-indent";

        const keyLabel = document.createElement("label");
        keyLabel.textContent = "Yandex API key: ";
        const keyInput = document.createElement("input");
        keyInput.type = "password";
        keyInput.autocomplete = "off";
        keyInput.id = "mh-yandex-key";
        keyLabel.appendChild(keyInput);
        wrap.appendChild(keyLabel);

        const folderLabel = document.createElement("label");
        folderLabel.textContent = "Yandex Folder ID: ";
        const folderInput = document.createElement("input");
        folderInput.type = "text";
        folderInput.autocomplete = "off";
        folderInput.id = "mh-yandex-folder";
        folderLabel.appendChild(folderInput);
        wrap.appendChild(folderLabel);

        const hint = document.createElement("p");
        hint.className = "mh-hint";
        hint.textContent = "Create both in the Yandex Cloud console (Translate service). Also requires linking a card to the Cloud account.";
        wrap.appendChild(hint);

        providerFieldset.appendChild(wrap);
      }
    });

    panel.appendChild(providerFieldset);

    // Actions
    const actions = document.createElement("div");
    actions.className = "mh-settings-actions";

    const status = document.createElement("span");
    status.className = "mh-compose-status";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", () => { overlay.hidden = true; });

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", () => {
      const provider = Object.keys(providerRadios).find((k) => providerRadios[k].checked) || "google";
      setSetting("provider", provider);
      setSetting("targetLang", readingSelect.value);
      setSetting("composeTargetLang", writingSelect.value);
      setSetting("deeplApiKey", document.getElementById("mh-deepl-key").value.trim());
      setSetting("yandexApiKey", document.getElementById("mh-yandex-key").value.trim());
      setSetting("yandexFolderId", document.getElementById("mh-yandex-folder").value.trim());
      status.textContent = "Saved.";
      setTimeout(() => { status.textContent = ""; }, 1500);
    });

    actions.appendChild(status);
    actions.appendChild(closeBtn);
    actions.appendChild(saveBtn);
    panel.appendChild(actions);

    function loadIntoForm() {
      const provider = providerRadios[getSetting("provider")] ? getSetting("provider") : "google";
      providerRadios[provider].checked = true;
      readingSelect.value = getSetting("targetLang");
      writingSelect.value = getSetting("composeTargetLang");
      document.getElementById("mh-deepl-key").value = getSetting("deeplApiKey");
      document.getElementById("mh-yandex-key").value = getSetting("yandexApiKey");
      document.getElementById("mh-yandex-folder").value = getSetting("yandexFolderId");
    }

    const gear = document.createElement("button");
    gear.id = "mh-translate-fab";
    gear.type = "button";
    gear.textContent = "🌐";
    gear.title = "MyHordes Forum Translator settings";
    gear.addEventListener("click", () => {
      loadIntoForm();
      overlay.hidden = false;
    });

    document.body.appendChild(gear);
    document.body.appendChild(overlay);
  }

  // ---------------------------------------------------------------------
  // Per-post translate controls
  // ---------------------------------------------------------------------

  const PROCESSED_ATTR = "data-mh-translate-init";
  const EDITOR_PROCESSED_ATTR = "data-mh-compose-init";
  const TRANSLATE_LABEL = "Translate";
  const HIDE_LABEL = "Hide translation";
  const BUSY_LABEL = "...";

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function buildControls() {
    const wrap = document.createElement("span");
    wrap.className = "mh-translate-controls";

    const link = document.createElement("a");
    link.className = "mh-translate-btn";
    link.href = "#";
    link.textContent = TRANSLATE_LABEL;

    wrap.appendChild(link);

    return { wrap, link };
  }

  function insertControls(postEl) {
    if (postEl.hasAttribute(PROCESSED_ATTR)) return;

    const contentEl = postEl.querySelector(".forum-post-content");
    const footer = postEl.querySelector(".forum-post-footer");
    if (!contentEl || !footer) return;

    postEl.setAttribute(PROCESSED_ATTR, "1");

    const { wrap, link } = buildControls();
    link.addEventListener("click", (event) => {
      event.preventDefault();
      onTranslateClick(contentEl, link);
    });

    footer.insertAdjacentElement("afterend", wrap);
  }

  function findTranslationBlock(contentEl) {
    const next = contentEl.nextElementSibling;
    return next && next.classList.contains("mh-translation-block") ? next : null;
  }

  function renderTranslationBlock(contentEl, target, result) {
    const block = document.createElement("div");
    block.className = "mh-translation-block";
    block.dataset.lang = target;

    const header = document.createElement("div");
    header.className = "mh-translation-header";
    const providerLabels = { deepl: "DeepL", google: "Google Translate", mymemory: "MyMemory", yandex: "Yandex Translate" };
    const providerLabel = providerLabels[result.provider] || result.provider;
    const sourceLabel = result.detected ? result.detected.toUpperCase() + " → " : "";
    header.textContent = "Translation (" + sourceLabel + target.toUpperCase() + ", " + providerLabel + ")";

    const body = document.createElement("div");
    body.className = "mh-translation-text";
    const lines = result.translated.split("\n");
    lines.forEach((line, i) => {
      if (i > 0) body.appendChild(document.createElement("br"));
      body.appendChild(document.createTextNode(line));
    });

    block.appendChild(header);
    block.appendChild(body);
    contentEl.insertAdjacentElement("afterend", block);
  }

  async function onTranslateClick(contentEl, link) {
    const target = getSetting("targetLang");
    const existing = findTranslationBlock(contentEl);
    if (existing) {
      const sameLang = existing.dataset.lang === target;
      existing.remove();
      link.textContent = TRANSLATE_LABEL;
      if (sameLang) return;
    }

    const text = contentEl.innerText.trim();
    if (!text) return;

    const previousLabel = link.textContent;
    link.textContent = BUSY_LABEL;

    try {
      const result = await translate(text, target);
      renderTranslationBlock(contentEl, target, result);
      link.textContent = HIDE_LABEL;
    } catch (err) {
      link.textContent = previousLabel;
      alert("Translation failed: " + (err && err.message ? err.message : err));
    }
  }

  // ---------------------------------------------------------------------
  // Compose translator (attached above the forum's post editor)
  // ---------------------------------------------------------------------

  function htmlToText(html) {
    const withBreaks = `${html || ""}`
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n");
    const div = document.createElement("div");
    div.innerHTML = withBreaks;
    return div.textContent.replace(/\n{3,}/g, "\n\n").trim();
  }

  function attachComposeTranslator(editorEl) {
    if (editorEl.hasAttribute(EDITOR_PROCESSED_ATTR)) return;
    editorEl.setAttribute(EDITOR_PROCESSED_ATTR, "1");

    const wrap = document.createElement("span");
    wrap.className = "mh-compose-controls";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mh-translate-btn";
    btn.textContent = "Translate my message";

    const status = document.createElement("span");
    status.className = "mh-compose-status";

    wrap.appendChild(btn);
    wrap.appendChild(status);

    btn.addEventListener("click", async () => {
      const text = htmlToText(editorEl.html);
      if (!text) return;

      const previousLabel = btn.textContent;
      btn.textContent = BUSY_LABEL;
      btn.disabled = true;

      try {
        const target = getSetting("composeTargetLang");
        const result = await translate(text, target);
        const htmlFragment = result.translated.split("\n").map(escapeHtml).join("<br>");
        editorEl.html = "<p>" + htmlFragment + "</p>";

        const providerLabels = { deepl: "DeepL", google: "Google", mymemory: "MyMemory", yandex: "Yandex" };
        status.textContent = "Replaced (" + (providerLabels[result.provider] || result.provider) + ")";
        setTimeout(() => { status.textContent = ""; }, 2500);
      } catch (err) {
        status.textContent = "Error: " + (err && err.message ? err.message : err);
      } finally {
        btn.textContent = previousLabel;
        btn.disabled = false;
      }
    });

    editorEl.insertAdjacentElement("beforebegin", wrap);
  }

  // ---------------------------------------------------------------------
  // Scan + observe
  // ---------------------------------------------------------------------

  function scan(root) {
    if (!root.querySelectorAll) return;
    root.querySelectorAll(".forum-post").forEach(insertControls);
    root.querySelectorAll("hordes-twino-editor").forEach(attachComposeTranslator);
  }

  buildSettingsPanel();
  scan(document);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.matches && node.matches(".forum-post")) {
          insertControls(node);
        } else if (node.matches && node.matches("hordes-twino-editor")) {
          attachComposeTranslator(node);
        } else {
          scan(node);
        }
      });
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
