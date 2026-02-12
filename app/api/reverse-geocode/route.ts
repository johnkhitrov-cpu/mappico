import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/reverse-geocode?lng=...&lat=...
 *
 * Reverse geocode coordinates to get a human-readable address.
 * Uses Mapbox Geocoding API.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lng = searchParams.get('lng');
    const lat = searchParams.get('lat');

    if (!lng || !lat) {
      return NextResponse.json(
        { error: 'Missing lng or lat parameters' },
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

    // Call Mapbox Geocoding API (reverse)
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status}`);
    }

    const data = await response.json();

    // Return the first result (most relevant)
    if (data.features && data.features.length > 0) {
      return NextResponse.json({
        address: data.features[0].place_name,
        coordinates: data.features[0].geometry.coordinates,
      });
    } else {
      return NextResponse.json({ address: null });
    }
  } catch (error) {
    console.error('Reverse geocode error:', error);
    return NextResponse.json(
      { error: 'Failed to reverse geocode' },
      { status: 500 }
    );
  }
}
