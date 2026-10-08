import type { MiddlewareHandler } from "hono";

// Verifies the Cloudflare Access JWT on every API request, so the API stays closed even if
// the Access policy is misconfigured or the app is reached via its *.workers.dev URL.
// Needs CF_ACCESS_TEAM_DOMAIN (e.g. "myteam.cloudflareaccess.com") and CF_ACCESS_AUD (the
// application's AUD tag). If either is missing the API fails closed, except on localhost.

export interface AccessEnv {
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
}

type Jwk = JsonWebKey & { kid: string };

let jwksCache: { domain: string; keys: Jwk[]; fetchedAt: number } | null = null;
const JWKS_TTL_MS = 10 * 60 * 1000;

const b64urlToBytes = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "="));
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
};

const decodeJson = (s: string) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

const getKeys = async (domain: string, force = false): Promise<Jwk[]> => {
  if (!force && jwksCache && jwksCache.domain === domain && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  const res = await fetch(`https://${domain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`Could not fetch Access certs (${res.status})`);
  const { keys } = (await res.json()) as { keys: Jwk[] };
  jwksCache = { domain, keys, fetchedAt: Date.now() };
  return keys;
};

const verify = async (token: string, domain: string, aud: string): Promise<boolean> => {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [h, p, sig] = parts;
  const header = decodeJson(h);
  const payload = decodeJson(p);
  if (header.alg !== "RS256") return false;

  let keys = await getKeys(domain);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    keys = await getKeys(domain, true); // keys rotate; refetch once
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) return false;

  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(sig), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) return false;

  const now = Math.floor(Date.now() / 1000);
  const auds: string[] = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  return auds.includes(aud) && payload.iss === `https://${domain}` && typeof payload.exp === "number" && payload.exp > now;
};

const isLocal = (url: string) => {
  const host = new URL(url).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
};

export const requireAccess: MiddlewareHandler<{ Bindings: AccessEnv }> = async (c, next) => {
  if (isLocal(c.req.url)) return next();

  const domain = c.env.CF_ACCESS_TEAM_DOMAIN;
  const aud = c.env.CF_ACCESS_AUD;
  if (!domain || !aud) return c.json({ error: "Access is not configured" }, 503);

  const token = c.req.header("Cf-Access-Jwt-Assertion");
  if (!token) return c.json({ error: "Unauthorized" }, 401);
  try {
    if (!(await verify(token, domain, aud))) return c.json({ error: "Unauthorized" }, 401);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
};
