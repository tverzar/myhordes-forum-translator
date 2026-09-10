// Translation provider implementations. Each returns
// { translated: string, detected: string|null, provider: string }
// or throws an Error with a human-readable message.

const DEEPL_TARGET_MAP = {
  en: "EN-US",
  fr: "FR",
  ru: "RU",
  es: "ES"
};

async function translateGoogle(text, target) {
  const url =
    "https://translate.googleapis.com/translate_a/single" +
    "?client=gtx&sl=auto&tl=" + encodeURIComponent(target) +
    "&dt=t&q=" + encodeURIComponent(text);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Google Translate HTTP " + res.status);
  }

  const data = await res.json();
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error("Unexpected Google Translate response");
  }

  const translated = data[0].map((segment) => segment[0]).join("");
  const detected = typeof data[2] === "string" ? data[2] : null;

  return { translated, detected, provider: "google" };
}

async function translateDeepL(text, target, apiKey) {
  const key = apiKey.trim();
  const isFreeKey = key.endsWith(":fx");
  const base = isFreeKey ? "https://api-free.deepl.com" : "https://api.deepl.com";
  const targetLang = DEEPL_TARGET_MAP[target] || target.toUpperCase();

  const body = new URLSearchParams();
  body.set("text", text);
  body.set("target_lang", targetLang);

  const res = await fetch(base + "/v2/translate", {
    method: "POST",
    headers: {
      "Authorization": "DeepL-Auth-Key " + key,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (res.status === 403) {
    throw new Error("DeepL rejected the API key (403). Check the key in the addon options.");
  }
  if (!res.ok) {
    throw new Error("DeepL HTTP " + res.status);
  }

  const data = await res.json();
  const translation = data.translations && data.translations[0];
  if (!translation) {
    throw new Error("Unexpected DeepL response");
  }

  return {
    translated: translation.text,
    detected: translation.detected_source_language ? translation.detected_source_language.toLowerCase() : null,
    provider: "deepl"
  };
}

async function translateMyMemory(text, target) {
  const url =
    "https://api.mymemory.translated.net/get" +
    "?q=" + encodeURIComponent(text) +
    "&langpair=" + encodeURIComponent("autodetect|" + target);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("MyMemory HTTP " + res.status);
  }

  const data = await res.json();
  const translated = data.responseData && data.responseData.translatedText;
  if (typeof translated !== "string") {
    throw new Error("Unexpected MyMemory response");
  }
  if (translated.startsWith("MYMEMORY WARNING") || (data.responseStatus && data.responseStatus !== 200)) {
    throw new Error("MyMemory: " + (data.responseDetails || translated));
  }

  return {
    translated,
    detected: data.responseData.detectedLanguage || null,
    provider: "mymemory"
  };
}

async function translateYandex(text, target, apiKey, folderId) {
  const res = await fetch("https://translate.api.cloud.yandex.net/translate/v2/translate", {
    method: "POST",
    headers: {
      "Authorization": "Api-Key " + apiKey.trim(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      folderId: folderId.trim(),
      texts: [text],
      targetLanguageCode: target
    })
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error("Yandex Translate rejected the API key or folder ID (" + res.status + "). Check the addon options.");
  }
  if (!res.ok) {
    throw new Error("Yandex Translate HTTP " + res.status);
  }

  const data = await res.json();
  const translation = data.translations && data.translations[0];
  if (!translation) {
    throw new Error("Unexpected Yandex Translate response");
  }

  return {
    translated: translation.text,
    detected: translation.detectedLanguageCode || null,
    provider: "yandex"
  };
}
