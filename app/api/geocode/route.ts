import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/geocode?query=...
 *
 * Forward geocode a search query to get location suggestions.
 * Uses Mapbox Geocoding API.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing query parameter' },
        { status: 400 }
      );
    }

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!mapboxToken) {
      return NextResponse.json(
        { error: 'Mapbox token not configured' },
        { status: 500 }
      );
    }

    // Call Mapbox Geocoding API (forward)
    // Encode query for URL safety
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${mapboxToken}&limit=8`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status}`);
    }

    const data = await response.json();

    // Return suggestions with place_name and coordinates
    const suggestions = (data.features || []).map((feature: any) => ({
      name: feature.place_name,
      coordinates: feature.geometry.coordinates, // [lng, lat]
    }));

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Geocode error:', error);
    return NextResponse.json(
      { error: 'Failed to geocode' },
      { status: 500 }
    );
  }
}
