import { Location } from '../types/route';

export async function geocodeAddress(
  address: string,
  isMockMode: boolean
): Promise<{ lat: number; lng: number; placeId?: string } | null> {
  if (isMockMode) {
    return null;
  }

  if (!window.google || !window.google.maps) {
    throw new Error("Google Maps not loaded");
  }

  const geocoder = new window.google.maps.Geocoder();
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
