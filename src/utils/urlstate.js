// src/utils/urlState.js

const PARAM = "s";
const VERSION = 1;

// Base64url helpers that work with unicode via TextEncoder/TextDecoder
function base64UrlEncodeUint8(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeToUint8(b64url) {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function encodeAppStateToQuery(stateObj) {
  const payload = { v: VERSION, ...stateObj };
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  return base64UrlEncodeUint8(bytes);
}

export function decodeAppStateFromQuery(encoded) {
  const bytes = base64UrlDecodeToUint8(encoded);
  const json = new TextDecoder().decode(bytes);
  const obj = JSON.parse(json);

  if (!obj || typeof obj !== "object") return null;
  if (obj.v !== VERSION) return null; // keep simple: reject unknown versions
  return obj;
}

export function readStateFromUrl() {
  const url = new URL(window.location.href);
  const encoded = url.searchParams.get(PARAM);
  if (!encoded) return null;
  try {
    return decodeAppStateFromQuery(encoded);
  } catch {
    return null;
  }
}

export function writeStateToUrl(stateObj) {
  const url = new URL(window.location.href);
  const encoded = encodeAppStateToQuery(stateObj);
  url.searchParams.set(PARAM, encoded);
  window.history.replaceState(null, "", url.toString());
}

export function copyShareUrl(stateObj) {
  const url = new URL(window.location.href);
  url.searchParams.set(PARAM, encodeAppStateToQuery(stateObj));
  return url.toString();
}
