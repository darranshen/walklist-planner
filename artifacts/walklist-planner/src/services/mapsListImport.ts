export interface ImportedLocation {
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

export async function importFromMapsUrl(url: string): Promise<ImportedLocation[]> {
  const params = new URLSearchParams({ url });
  const response = await fetch(`/api/maps-list?${params.toString()}`);

  let body: { locations?: ImportedLocation[]; error?: string; count?: number };
  try {
    body = await response.json();
  } catch {
    throw new Error("Unexpected response from server.");
  }

  if (!response.ok) {
    throw new Error(body.error ?? `Server error ${response.status}`);
  }

  if (!Array.isArray(body.locations)) {
    throw new Error("Unexpected response format from server.");
  }

  if (body.locations.length === 0) {
    throw new Error(
      "No locations were found in this list. The list may be private, empty, or require sign-in to view.",
    );
  }

  return body.locations;
}
