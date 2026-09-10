// MV3 service worker. Classic (non-module) service workers can pull in
// extra scripts via importScripts(), so the translation provider
// implementations live in a separate shared file loaded here.
importScripts("providers.js");

const DEFAULT_SETTINGS = {
  provider: "google", // "google" | "deepl" | "mymemory" | "yandex"
  deeplApiKey: "",
  yandexApiKey: "",
  yandexFolderId: "",
  targetLang: "en", // "en" | "fr" | "ru" | "es"
  composeTargetLang: "fr"
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "mh-translate") return;
  handleTranslateRequest(message.text, message.target).then(sendResponse);
  return true; // keep the message channel open for the async sendResponse
});

async function handleTranslateRequest(text, target) {
  try {
    const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);

    switch (settings.provider) {
      case "deepl":
        if (!settings.deeplApiKey) {
          throw new Error("No DeepL API key set. Open the addon options and add one, or switch provider.");
        }
        return await translateDeepL(text, target, settings.deeplApiKey);

      case "yandex":
        if (!settings.yandexApiKey || !settings.yandexFolderId) {
          throw new Error("Yandex Translate needs both an API key and a folder ID. Open the addon options to set them, or switch provider.");
        }
        return await translateYandex(text, target, settings.yandexApiKey, settings.yandexFolderId);

      case "mymemory":
        return await translateMyMemory(text, target);

      default:
        return await translateGoogle(text, target);
    }
  } catch (err) {
    return { error: err.message || String(err) };
  }
}
