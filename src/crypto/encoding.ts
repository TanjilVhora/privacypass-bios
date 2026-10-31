export const utf8 = (s: string) => new TextEncoder().encode(s);
export const b64urlEncode = (u: Uint8Array) =>
  btoa(String.fromCharCode(...u)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export const b64urlDecode = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
export const randomNonce = (n = 16) => b64urlEncode(crypto.getRandomValues(new Uint8Array(n)));
export const sha256 = async (u: Uint8Array) =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', u as BufferSource));