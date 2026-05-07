import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

const VALID_HOSTS = ["maps.app.goo.gl", "maps.google.com", "www.google.com", "goo.gl"];

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

function cleanPlaceName(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, " ")).trim();
  } catch {
    return raw.replace(/\+/g, " ").trim();
  }
}

function parseLocationsFromHtml(html: string): ParsedLocation[] {
  const locations: ParsedLocation[] = [];
  const seen = new Set<string>();

  // Strategy 1: /maps/place/NAME/@LAT,LNG pattern (most reliable)
  // Appears in anchor hrefs for each place in a list
  const placeUrlPattern = /\/maps\/place\/([^/@\s"'\\]+)\/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/g;
  let match: RegExpExecArray | null;

  while ((match = placeUrlPattern.exec(html)) !== null) {
    const name = cleanPlaceName(match[1]);
    const lat = parseFloat(match[2]);
    const lng = parseFloat(match[3]);
    const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;

    if (name && !isNaN(lat) && !isNaN(lng) && !seen.has(key)) {
      seen.add(key);
      locations.push({ name, address: name, latitude: lat, longitude: lng });
    }
  }

  // Strategy 2: !3d{lat}!4d{lng} encoded data URLs
  // These appear in the data= parameter of Google Maps URLs
  if (locations.length === 0) {
    const dataPattern = /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/g;
    let idx = 1;
    while ((match = dataPattern.exec(html)) !== null) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
      if (!isNaN(lat) && !isNaN(lng) && !seen.has(key)) {
        seen.add(key);
        locations.push({ name: `Location ${idx++}`, address: "", latitude: lat, longitude: lng });
      }
    }
  }

  // Strategy 3: JSON-LD Place blocks
  if (locations.length === 0) {
    const jsonLdPattern = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    while ((match = jsonLdPattern.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1]);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          const name = item.name || item["@name"];
          const geo = item.geo || (item.location && item.location.geo);
          if (name && geo && geo.latitude != null && geo.longitude != null) {
            const lat = parseFloat(geo.latitude);
            const lng = parseFloat(geo.longitude);
            const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
            if (!isNaN(lat) && !isNaN(lng) && !seen.has(key)) {
              seen.add(key);
              const address = item.address?.streetAddress || item.address || name;
              locations.push({ name, address, latitude: lat, longitude: lng });
            }
          }
        }
      } catch {
        // skip malformed JSON-LD
      }
    }
  }

  return locations;
}

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

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      logger.warn({ status: response.status, url }, "Google Maps fetch returned non-OK status");
      res.status(502).json({ error: `Google Maps returned status ${response.status}` });
      return;
    }

    const finalUrl = response.url;
    const html = await response.text();
    const locations = parseLocationsFromHtml(html);

    logger.info({ count: locations.length, finalUrl }, "Parsed locations from Google Maps list");

    res.json({ locations, finalUrl, count: locations.length });
  } catch (err) {
    logger.error({ err, url }, "Failed to fetch Google Maps page");
    res.status(502).json({ error: "Failed to fetch the Google Maps page. Check that the URL is a public shared list." });
  }
});

export default router;
