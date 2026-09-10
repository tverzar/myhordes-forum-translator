const browserAPI = typeof browser !== "undefined" ? browser : chrome;

const DEFAULT_SETTINGS = {
  provider: "google",
  deeplApiKey: "",
  yandexApiKey: "",
  yandexFolderId: "",
  targetLang: "en",
  composeTargetLang: "fr"
};

const targetLangEl = document.getElementById("targetLang");
const providerEls = {
  google: document.getElementById("provider-google"),
  mymemory: document.getElementById("provider-mymemory"),
  deepl: document.getElementById("provider-deepl"),
  yandex: document.getElementById("provider-yandex")
};
const deeplSettingsEl = document.getElementById("deepl-settings");
const deeplApiKeyEl = document.getElementById("deeplApiKey");
const yandexSettingsEl = document.getElementById("yandex-settings");
const yandexApiKeyEl = document.getElementById("yandexApiKey");
const yandexFolderIdEl = document.getElementById("yandexFolderId");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");

function currentProvider() {
  for (const [key, el] of Object.entries(providerEls)) {
    if (el.checked) return key;
  }
  return "google";
}

function updateVisibility() {
  const provider = currentProvider();
  deeplSettingsEl.style.opacity = provider === "deepl" ? "1" : "0.5";
  yandexSettingsEl.style.opacity = provider === "yandex" ? "1" : "0.5";
}

async function load() {
  const settings = await browserAPI.storage.sync.get(DEFAULT_SETTINGS);
  targetLangEl.value = settings.targetLang;
  deeplApiKeyEl.value = settings.deeplApiKey;
  yandexApiKeyEl.value = settings.yandexApiKey;
  yandexFolderIdEl.value = settings.yandexFolderId;

  const provider = providerEls[settings.provider] ? settings.provider : "google";
  providerEls[provider].checked = true;

  updateVisibility();
}

async function save() {
  await browserAPI.storage.sync.set({
    provider: currentProvider(),
    deeplApiKey: deeplApiKeyEl.value.trim(),
    yandexApiKey: yandexApiKeyEl.value.trim(),
    yandexFolderId: yandexFolderIdEl.value.trim(),
    targetLang: targetLangEl.value
  });
  statusEl.textContent = "Saved.";
  setTimeout(() => { statusEl.textContent = ""; }, 1500);
}

Object.values(providerEls).forEach((el) => el.addEventListener("change", updateVisibility));
saveBtn.addEventListener("click", save);

load();
