(function () {
  const browserAPI = typeof browser !== "undefined" ? browser : chrome;

  const LANGS = [
    { code: "en", label: "EN" },
    { code: "fr", label: "FR" },
    { code: "ru", label: "RU" },
    { code: "es", label: "ES" }
  ];

  const PROCESSED_ATTR = "data-mh-translate-init";
  const EDITOR_PROCESSED_ATTR = "data-mh-compose-init";
  const TRANSLATE_LABEL = "Translate";
  const HIDE_LABEL = "Hide translation";
  const BUSY_LABEL = "...";

  let defaultTarget = "en";
  let composeTarget = "fr";

  browserAPI.storage.sync.get({ targetLang: "en", composeTargetLang: "fr" }).then((s) => {
    defaultTarget = s.targetLang;
    composeTarget = s.composeTargetLang;
  });

  browserAPI.storage.onChanged.addListener((changes) => {
    if (changes.targetLang) defaultTarget = changes.targetLang.newValue;
    if (changes.composeTargetLang) composeTarget = changes.composeTargetLang.newValue;
  });

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

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

  function buildControls() {
    const wrap = document.createElement("span");
    wrap.className = "mh-translate-controls";

    const select = buildLangSelect(defaultTarget);

    const link = document.createElement("a");
    link.className = "action-button mh-translate-btn";
    link.href = "#";
    link.textContent = TRANSLATE_LABEL;

    wrap.appendChild(document.createTextNode("[ "));
    wrap.appendChild(select);
    wrap.appendChild(document.createTextNode(" "));
    wrap.appendChild(link);
    wrap.appendChild(document.createTextNode(" ]"));

    return { wrap, select, link };
  }

  function findAnchor(postEl) {
    const footerRight = postEl.querySelector(".forum-post-footer .float-right");
    if (footerRight) return { parent: footerRight, before: footerRight.firstChild };
    const footer = postEl.querySelector(".forum-post-footer");
    if (footer) return { parent: footer, before: footer.firstChild };
    return null;
  }

  function insertControls(postEl) {
    if (postEl.hasAttribute(PROCESSED_ATTR)) return;

    const contentEl = postEl.querySelector(".forum-post-content");
    const anchor = findAnchor(postEl);
    if (!contentEl || !anchor) return;

    postEl.setAttribute(PROCESSED_ATTR, "1");

    const { wrap, select, link } = buildControls();
    link.addEventListener("click", (event) => {
      event.preventDefault();
      onTranslateClick(contentEl, select.value, link);
    });

    anchor.parent.insertBefore(wrap, anchor.before);
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
    const providerLabel = result.provider === "deepl" ? "DeepL" : "Google Translate";
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

  async function onTranslateClick(contentEl, target, link) {
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
      const result = await browserAPI.runtime.sendMessage({ type: "mh-translate", text, target });
      if (!result) throw new Error("No response from background script");
      if (result.error) throw new Error(result.error);

      renderTranslationBlock(contentEl, target, result);
      link.textContent = HIDE_LABEL;
    } catch (err) {
      link.textContent = previousLabel;
      alert("Translation failed: " + (err && err.message ? err.message : err));
    }
  }

  function attachComposeTranslator(editorEl) {
    if (editorEl.hasAttribute(EDITOR_PROCESSED_ATTR)) return;
    editorEl.setAttribute(EDITOR_PROCESSED_ATTR, "1");

    const panel = document.createElement("div");
    panel.className = "mh-compose-translate";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "mh-compose-toggle";
    toggle.textContent = "✎ Write in my language & translate";

    const body = document.createElement("div");
    body.className = "mh-compose-body";
    body.hidden = true;

    const textarea = document.createElement("textarea");
    textarea.className = "mh-compose-textarea";
    textarea.placeholder = "Type your message in your own language here…";
    textarea.rows = 3;

    const controls = document.createElement("div");
    controls.className = "mh-compose-controls";

    const label = document.createElement("span");
    label.textContent = "Translate to:";

    const select = buildLangSelect(composeTarget);
    select.addEventListener("change", () => {
      composeTarget = select.value;
      browserAPI.storage.sync.set({ composeTargetLang: composeTarget });
    });

    const translateBtn = document.createElement("button");
    translateBtn.type = "button";
    translateBtn.className = "mh-compose-insert";
    translateBtn.textContent = "Translate & insert";

    const status = document.createElement("span");
    status.className = "mh-compose-status";

    controls.appendChild(label);
    controls.appendChild(select);
    controls.appendChild(translateBtn);
    controls.appendChild(status);

    body.appendChild(textarea);
    body.appendChild(controls);

    panel.appendChild(toggle);
    panel.appendChild(body);

    toggle.addEventListener("click", () => {
      body.hidden = !body.hidden;
    });

    translateBtn.addEventListener("click", async () => {
      const text = textarea.value.trim();
      if (!text) return;

      status.textContent = BUSY_LABEL;
      translateBtn.disabled = true;

      try {
        const result = await browserAPI.runtime.sendMessage({ type: "mh-translate", text, target: select.value });
        if (!result) throw new Error("No response from background script");
        if (result.error) throw new Error(result.error);

        const htmlFragment = result.translated.split("\n").map(escapeHtml).join("<br>");
        const current = `${editorEl.html || ""}`;
        const separator = current.trim() ? "<br>" : "";
        editorEl.html = current + separator + "<p>" + htmlFragment + "</p>";

        status.textContent = "Inserted (" + (result.provider === "deepl" ? "DeepL" : "Google") + ")";
        textarea.value = "";
      } catch (err) {
        status.textContent = "Error: " + (err && err.message ? err.message : err);
      } finally {
        translateBtn.disabled = false;
      }
    });

    editorEl.insertAdjacentElement("beforebegin", panel);
  }

  function scan(root) {
    if (!root.querySelectorAll) return;
    root.querySelectorAll(".forum-post").forEach(insertControls);
    root.querySelectorAll("hordes-twino-editor").forEach(attachComposeTranslator);
  }

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
