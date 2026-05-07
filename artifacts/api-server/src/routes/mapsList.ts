/**
 * GET /api/maps-list?url=<google-maps-url>
 *
 * Resolves a Google Maps shared list URL (maps.app.goo.gl short link or full
 * placelists/list URL) and returns the list of places with name, address, lat,
 * and lng by calling Google's internal entitylist/getlist data API.
 *
 * Data format (confirmed from live response 2026-05):
 *   After stripping )]}'  the JSON is:
 *   [[
 *     [LIST_TOKEN, 1, ...],          // [0] list metadata
 *     4,                              // [1]
 *     [3, 1, "CANONICAL_URL"],        // [2]
 *     ["USER", "AVATAR", "USER_ID"], // [3]
 *     "LIST_TITLE",                  // [4]
 *     "", null, null,                 // [5-7]
 *     [[PLACE_ENTRY, ...]]            // [8] — wrapped in an extra array!
 *   ]]
 *
 *   Each PLACE_ENTRY:
 *   [
 *     null,                                           // [0]
 *     [null, null, FULL_ADDR, null, SHORT_ADDR,       // [1]
 *       [null, null, LAT, LNG],                       // [1][5]
 *       [FEATURE_IDS], "/g/PLACE_PATH"],
 *     "PLACE_NAME",                                   // [2]
 *     ...
 *   ]
 */

import https from "node:https";
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

export interface ParsedLocation {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  placeId?: string;
}

// ── Resolve a short URL by reading the raw 302 Location header ───────────────
// maps.app.goo.gl returns 302 with Location for non-browser user agents
// but renders a 200 JS page for browser UAs (which hides the redirect target).
// Using a minimal non-browser UA here bypasses that and gives us the target URL.

function resolveShortUrl(url: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const req = https.request(
        {
          method: "GET",
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          headers: { "User-Agent": "curl/8.4.0" },
        },
        (res) => {
          res.resume(); // discard body
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            resolve(new URL(res.headers.location, url).href);
          } else {
            resolve(url);
          }
        },
      );
      req.on("error", () => resolve(url));
      req.end();
    } catch {
      resolve(url);
    }
  });
}

// ── Validate input URL ───────────────────────────────────────────────────────

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

// ── Extract the list share token from a Maps URL ──────────────────────────────
// Handles three formats:
//   1. maps.app.goo.gl/XXX → redirect target contains !2s{TOKEN} in data= param
//   2. www.google.com/maps/@/data=...!2s{TOKEN}...
//   3. www.google.com/maps/placelists/list/{TOKEN}

function extractTokenFromUrl(url: string): string | null {
  // Format 3: /maps/placelists/list/{TOKEN}
  const listPathMatch = url.match(/\/maps\/placelists\/list\/([A-Za-z0-9_=-]{10,})/);
  if (listPathMatch) return listPathMatch[1];

  // Formats 1 & 2: !2s{TOKEN} inside data= param
  // The token appears as !2s followed by alphanumeric chars
  const dataParamMatch = url.match(/[!&]2s([A-Za-z0-9_=-]{10,})/);
  if (dataParamMatch) return dataParamMatch[1];

  return null;
}

// ── Build the getlist pb parameter ────────────────────────────────────────────
// Confirmed working without session token for public lists.

function buildGetlistPb(token: string): string {
  return `!1m4!1s${token}!2e1!3m1!1e1!2e2!3e2!4i500`;
}

// ── Parse the known getlist response format ───────────────────────────────────

function parseGetlistResponse(raw: string): ParsedLocation[] {
  const json = raw.replace(/^\s*\)\]\}'\s*/, "").trim();

  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (e) {
    logger.warn({ err: e }, "Failed to JSON.parse getlist response");
    return [];
  }

  // data[0][8][0] is the places array (double-wrapped)
  const outer = Array.isArray(data) && Array.isArray(data[0]) ? (data[0] as unknown[]) : null;
  if (!outer) {
    logger.warn("Unexpected top-level structure in getlist response");
    return [];
  }

  // Note: outer[1] === 4 is a normal field in a working list response — NOT an
  // error code. The list title is at outer[4]; places are at outer[8][0].

  // Places are at outer[8] — a direct Array(N) of place entries, NOT double-wrapped.
  // (Confirmed: outer[8] = [PLACE1, PLACE2, ...], each PLACE = Array(13) of fields.)
  const places = Array.isArray(outer[8]) ? (outer[8] as unknown[]) : null;

  if (!places) {
    logger.warn(
      { outer8Type: typeof outer[8], outer8: JSON.stringify(outer[8])?.slice(0, 200) },
      "Could not find places array at outer[8]",
    );
    return [];
  }

  logger.info({ candidatePlaces: places.length }, "Found candidate place entries");

  const results: ParsedLocation[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < places.length; i++) {
    const entry = places[i];
    if (!Array.isArray(entry)) continue;

    // entry[2] = place name
    const name = entry[2];
    if (typeof name !== "string" || !name.trim()) {
      logger.debug({ idx: i, entry0: entry[0], entry2: entry[2] }, "Skipping entry: no name at [2]");
      continue;
    }

    // entry[1] = place data array
    const placeData = entry[1];
    if (!Array.isArray(placeData)) {
      logger.debug({ idx: i, name }, "Skipping entry: no placeData array at [1]");
      continue;
    }

    // placeData[5] = [null, null, lat, lng]
    const coordArr = placeData[5];
    if (!Array.isArray(coordArr) || coordArr.length < 4) {
      logger.debug({ idx: i, name, coordArr }, "Skipping entry: coordArr not at [1][5] or too short");
      continue;
    }

    const lat = coordArr[2];
    const lng = coordArr[3];
    if (typeof lat !== "number" || typeof lng !== "number") {
      logger.debug({ idx: i, name, lat, lng }, "Skipping entry: lat/lng not numbers");
      continue;
    }

    const key = `${lat.toFixed(7)},${lng.toFixed(7)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // placeData[4] = short address, placeData[2] = full address
    const shortAddr = typeof placeData[4] === "string" ? placeData[4] : "";
    const fullAddr = typeof placeData[2] === "string" ? placeData[2] : "";
    const address = shortAddr || fullAddr || name;

    // placeData[7] = "/g/PLACE_PATH"
    const placeId =
      typeof placeData[7] === "string" ? placeData[7].replace(/^\/g\//, "") : undefined;

    results.push({ name: name.trim(), address, latitude: lat, longitude: lng, placeId });
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

  // ── Step 1: Resolve the canonical Maps URL ────────────────────────────────
  // maps.app.goo.gl returns 200 + JS page for browser UAs (client-side redirect)
  // but returns 302 + Location header for non-browser UAs.
  // We use resolveShortUrl (curl UA) to get the Location target, which contains
  // the list share token in its data= parameter as !2s{TOKEN}.
  let finalUrl = url;

  const parsed = new URL(url);
  if (parsed.hostname === "maps.app.goo.gl" || parsed.hostname === "goo.gl") {
    finalUrl = await resolveShortUrl(url);
    logger.info({ originalUrl: url, finalUrl }, "Resolved short URL");
  }

  // ── Step 2: Extract the list share token from the canonical URL ───────────
  let token = extractTokenFromUrl(finalUrl);
  logger.info({ finalUrl, token }, "Token extracted from canonical URL");

  // ── Step 3: If no token yet, fetch the Maps page HTML to find the preload ──
  // This handles cases where the user pastes a full maps.google.com URL directly
  // rather than a short link. The full Maps page embeds a getlist preload URL.
  let html = "";
  if (!token) {
    try {
      const pageRes = await fetch(finalUrl, { headers: BROWSER_HEADERS, redirect: "follow" });
      html = await pageRes.text();
      logger.info({ htmlBytes: html.length, status: pageRes.status }, "Fetched Maps HTML for preload");
      // Try extracting token from preload URL embedded in the HTML
      const pbMatch = html.match(/entitylist\/getlist[^"]*[?&]pb=([^"&\s]+)/);
      if (pbMatch) {
        const pbDecoded = decodeURIComponent(pbMatch[1]);
        const t = pbDecoded.match(/!1s([A-Za-z0-9_=-]{10,})/);
        if (t) {
          token = t[1];
          logger.info({ token }, "Extracted token from HTML preload pb param");
        }
      }
    } catch (err) {
      logger.warn({ err }, "Failed to fetch Maps HTML");
    }
  }

  // ── Step 4: Call getlist directly using the token ─────────────────────────
  if (token) {
    try {
      const pb = buildGetlistPb(token);
      const getlistUrl = `https://www.google.com/maps/preview/entitylist/getlist?pb=${encodeURIComponent(pb)}`;
      logger.info({ getlistUrl }, "Calling getlist API with extracted token");

      const dataRes = await fetch(getlistUrl, {
        headers: { ...BROWSER_HEADERS, Accept: "*/*", Referer: "https://www.google.com/maps/" },
      });
      const raw = await dataRes.text();
      logger.info(
        {
          status: dataRes.status,
          contentType: dataRes.headers.get("content-type"),
          rawLength: raw.length,
          preview: raw.slice(0, 800).replace(/lh3\.googleusercontent\.com\/[^\s"]+/g, "[AVATAR]"),
        },
        "getlist API response",
      );

      const locations = parseGetlistResponse(raw);
      logger.info({ count: locations.length }, "Parsed locations from token-based getlist");

      if (locations.length > 0) {
        res.json({ locations, count: locations.length });
        return;
      }

      // Token resolved but got no places — check for private/not-found error
      const stripped = raw.replace(/^\s*\)\]\}'\s*/, "").trim();
      if (!stripped.startsWith("[[") || /^\[\[null,4/.test(stripped) || /\[4,/.test(stripped.slice(0, 80))) {
        res.status(404).json({
          error:
            "The list could not be found or is set to private. In Google Maps, open the list → Share → set to Anyone with the link.",
        });
        return;
      }
    } catch (err) {
      logger.warn({ err }, "Token-based getlist call failed; trying HTML preload fallback");
    }
  }

  // ── Step 5: Fallback — use the getlist preload URL embedded in the HTML ───
  const preloadMatch = html.match(/href="(\/maps\/preview\/entitylist\/getlist[^"]+)"/);
  if (preloadMatch) {
    const getlistPath = preloadMatch[1].replace(/&amp;/g, "&");
    logger.info({ getlistPath }, "Found getlist preload link in HTML");

    try {
      const dataRes = await fetch(`https://www.google.com${getlistPath}`, {
        headers: { ...BROWSER_HEADERS, Accept: "*/*", Referer: finalUrl },
      });
      const raw = await dataRes.text();
      logger.info(
        { rawLength: raw.length, preview: raw.slice(0, 600).replace(/lh3\.googleusercontent\.com\/[^\s"]+/g, "[AVATAR]") },
        "HTML-preload getlist response",
      );

      const locations = parseGetlistResponse(raw);
      logger.info({ count: locations.length }, "Parsed locations from HTML-preload getlist");
      if (locations.length > 0) {
        res.json({ locations, count: locations.length });
        return;
      }
    } catch (err) {
      logger.warn({ err }, "HTML-preload getlist call failed");
    }
  } else {
    logger.warn({ htmlBytes: html.length, finalUrl }, "No entitylist/getlist preload found in HTML");
  }

  // Nothing worked
  res.status(404).json({
    error:
      "The list is public but this Google Maps response format is not yet supported. Check server diagnostics for the raw response.",
  });
});

export default router;
