function mockCoords(address: string): { lat: number; lng: number } {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = (hash * 31 + address.charCodeAt(i)) & 0xfffffff;
  }
  // Spread within ~2 km of SF city center
  const lat = 37.7749 + ((hash % 201) - 100) * 0.00009;
  const lng = -122.4194 + (((hash * 13) % 201) - 100) * 0.00012;
  return { lat, lng };
}

export async function geocodeAddress(
  address: string,
  isMockMode: boolean,
): Promise<{ lat: number; lng: number; placeId?: string } | null> {
  if (isMockMode) {
    return mockCoords(address);
  }

  if (!window.google || !window.google.maps) {
    throw new Error("Google Maps not loaded");
  }

  const geocoder = new google.maps.Geocoder();
  try {
    const response = await geocoder.geocode({ address });
    if (response.results && response.results.length > 0) {
      const result = response.results[0];
      return {
        lat: result.geometry.location.lat(),
        lng: result.geometry.location.lng(),
        placeId: result.place_id,
      };
    }
    throw new Error("No results found");
  } catch (error) {
    console.error("Geocoding error:", error);
    throw new Error("We could not find that address. Try a more specific place name or address.");
  }
}
