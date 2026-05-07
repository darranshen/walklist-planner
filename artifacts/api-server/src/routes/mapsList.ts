import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

const VALID_HOSTS = ["maps.app.goo.gl", "maps.google.com", "www.google.com", "goo.gl"];

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "identity",
};

function isGoogleMapsUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (!VALID_HOSTS.includes(url.hostname)) return false;
    if (url.hostname === "www.google.com" && !url.pathname.startsWith("/maps")) return false;
    return true;
  } catch {
    return false;
  }
}

export interface ParsedLocation {
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

// ── Coordinate validation ─────────────────────────────────────────────────────

function looksLikeLatLng(a: unknown, b: unknown): a is number {
  if (typeof a !== "number" || typeof b !== "number") return false;
  // Both must be floats (not just integers like 1 or 500)
  if (a === Math.floor(a) && b === Math.floor(b)) return false;
  if (Math.abs(a as number) < 0.1 || Math.abs(a as number) >= 90) return false;
  if (Math.abs(b as number) < 0.1 || Math.abs(b as number) >= 180) return false;
  return true;
}

// ── Recursive tree walker ─────────────────────────────────────────────────────
// Approach: walk the full nested JSON. Collect all (string, [lat,lng]) pairs
// that appear in the same parent array. The first string in a parent that also
// contains a coordinate pair is treated as the place name; the next long string
// (if any) is the address.

interface CoordHit {
  lat: number;
  lng: number;
  /** Strings found in the same array as the coordinate pair */
  siblings: string[];
}

function collectCoords(node: unknown, depth = 0): CoordHit[] {
  if (depth > 25 || !Array.isArray(node)) return [];

  const hits: CoordHit[] = [];

  // Check if THIS array starts with a valid lat/lng pair (length >= 2)
  if (
    node.length >= 2 &&
    looksLikeLatLng(node[0], node[1])
  ) {
    const lat = node[0] as number;
    const lng = node[1] as number;
    // Collect string siblings in the same parent (done by parent — leave it)
    hits.push({ lat, lng, siblings: [] });
  }

  // Collect sibling strings + recurse
  const localStrings: string[] = [];
  const childHits: CoordHit[] = [];

  for (const item of node) {
    if (
      typeof item === "string" &&
      item.length > 1 &&
      item.length < 400 &&
      !item.startsWith("http") &&
      !item.startsWith("ChIJ") // skip place IDs
    ) {
      localStrings.push(item);
    } else if (Array.isArray(item)) {
      const sub = collectCoords(item, depth + 1);
      childHits.push(...sub);
    }
  }

  // Attach local strings to any direct coord hits found in children arrays
  for (const h of childHits) {
    if (h.siblings.length === 0 && localStrings.length > 0) {
      h.siblings.push(...localStrings);
    }
  }

  hits.push(...childHits);
  return hits;
}

function parseGetlistResponse(raw: string): ParsedLocation[] {
  // Strip Google's XSSI prefix  )]}'
  const json = raw.replace(/^\s*\)\]\}'\s*/, "").trim();

  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    logger.warn("Failed to JSON.parse getlist response");
    return [];
  }

  const hits = collectCoords(data);
  const seen = new Set<string>();
  const results: ParsedLocation[] = [];

  for (const hit of hits) {
    const key = `${hit.lat.toFixed(6)},${hit.lng.toFixed(6)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // First sibling string = name, second (if longer / has comma) = address
    const [firstName, ...rest] = hit.siblings;
    const name = firstName || `Location ${results.length + 1}`;
    const address =
      rest.find((s) => s.length > name.length || s.includes(",")) || firstName || name;

    results.push({ name, address, latitude: hit.lat, longitude: hit.lng });
  }

  return results;
}

// ── Extract getlist preload URL from HTML ─────────────────────────────────────

function extractGetlistUrl(html: string): string | null {
  const match = html.match(/href="(\/maps\/preview\/entitylist\/getlist[^"]+)"/);
  if (!match) return null;
  return match[1].replace(/&amp;/g, "&");
}

// ── Fallback: scan HTML for /maps/place/ URLs ─────────────────────────────────

function parseHtmlPlaceUrls(html: string): ParsedLocation[] {
  const results: ParsedLocation[] = [];
  const seen = new Set<string>();
  const re = /\/maps\/place\/([^/@\s"'\\]+)\/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const name = decodeURIComponent(m[1].replace(/\+/g, " ")).trim();
      const lat = parseFloat(m[2]);
      const lng = parseFloat(m[3]);
      const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
      if (name && !isNaN(lat) && !isNaN(lng) && !seen.has(key)) {
        seen.add(key);
        results.push({ name, address: name, latitude: lat, longitude: lng });
      }
    } catch { /* skip */ }
  }
  return results;
}

// ── Route handler ─────────────────────────────────────────────────────────────

router.get("/maps-list", async (req, res) => {
  const { url } = req.query;

  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "url query parameter is required" });
    return;
  }

  if (!isGoogleMapsUrl(url)) {
    res.status(400).json({ error: "URL must be a valid Google Maps URL" });
    return;
  }

  // ── Step 1: Fetch the list page HTML ──────────────────────────────────────
  let html: string;
  let finalUrl: string;
  try {
    const pageRes = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow" });
    if (!pageRes.ok) {
      res.status(502).json({ error: `Google Maps returned status ${pageRes.status}` });
      return;
    }
    finalUrl = pageRes.url;
    html = await pageRes.text();
  } catch (err) {
    logger.error({ err, url }, "Failed to fetch Google Maps page");
    res.status(502).json({ error: "Could not reach Google Maps. Check the URL and try again." });
    return;
  }

  logger.info({ finalUrl, htmlBytes: html.length }, "Fetched list page HTML");

  // ── Step 2: Call the getlist data API ─────────────────────────────────────
  const getlistPath = extractGetlistUrl(html);
  logger.info({ getlistPath }, "Extracted getlist path");

  if (getlistPath) {
    try {
      const dataRes = await fetch(`https://www.google.com${getlistPath}`, {
        headers: { ...BROWSER_HEADERS, Accept: "*/*", Referer: finalUrl },
      });

      if (dataRes.ok) {
        const raw = await dataRes.text();
        // Log enough to diagnose format issues without PII overflow
        logger.info(
          { rawLength: raw.length, preview: raw.slice(0, 500) },
          "getlist raw response",
        );

        // Detect "list not found / private" signal
        const stripped = raw.replace(/^\s*\)\]\}'\s*/, "").trim();
        if (stripped.includes('"4"') || /\[4,/.test(stripped) || /,4,/.test(stripped.slice(0, 60))) {
          res.status(404).json({
            error:
              "This list could not be found or is private. In Google Maps, open the list, tap Share, and make sure sharing is set to 'Anyone with the link'.",
          });
          return;
        }

        const locations = parseGetlistResponse(raw);
        logger.info({ count: locations.length }, "Parsed locations");

        if (locations.length > 0) {
          res.json({ locations, count: locations.length });
          return;
        }
      } else {
        logger.warn({ status: dataRes.status }, "getlist API non-OK response");
      }
    } catch (err) {
      logger.warn({ err }, "getlist API call failed");
    }
  }

  // ── Step 3: Fallback — scan HTML for place URLs ───────────────────────────
  const htmlLocations = parseHtmlPlaceUrls(html);
  if (htmlLocations.length > 0) {
    logger.info({ count: htmlLocations.length }, "Found locations via HTML fallback");
    res.json({ locations: htmlLocations, count: htmlLocations.length });
    return;
  }

  // Nothing found — give a helpful, specific error
  res.status(404).json({
    error:
      "No locations were found. Make sure the list is shared publicly: in Google Maps, open your list → Share → Anyone with the link. Then paste the link here and try again.",
  });
});

export default router;
