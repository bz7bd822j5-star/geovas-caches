export const API_URL = "https://script.google.com/macros/s/AKfycbyZ7D1Wf7E-3S0yNnEdE_u2IshBAk_0UEcXmI6TdNNXXFBTFNSjjdJS1Rg96E6K1scU/exec";
export const API_TOKEN = "geovas_7c2b9a4f1d6e8a3c5b0d9f2a1e7c4b8d";

export async function postCache(cache) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ token: API_TOKEN, cache }),
  });
  if (!response.ok) {
    throw new Error("POST failed");
  }
  return response.json();
}

export async function pullSince(since) {
  const url = since ? `${API_URL}?since=${encodeURIComponent(since)}` : API_URL;
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error("GET failed");
  }
  return response.json();
}
