'use client';

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Map, { Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import PointDetailsModal from "@/components/PointDetailsModal";

interface Trip {
  id: string;
  title: string;
  description: string | null;
  visibility: string;
  createdAt: string;
  updatedAt: string;
  owner?: {
    id: string;
    email: string;
  };
}

interface Point {
  id: string;
  lat: number;
  lng: number;
  title: string;
  description: string | null;
  photoUrl: string | null;
  createdAt: string;
}

interface TripPoint {
  id: string;
  tripId: string;
  pointId: string;
  order: number;
  note: string | null;
  createdAt: string;
  point: Point;
}

export default function SharedTripPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Trip points state
  const [tripPoints, setTripPoints] = useState<TripPoint[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  // Point details modal state
  const [selectedPointForModal, setSelectedPointForModal] = useState<TripPoint | null>(null);

  // Map state
  const [viewState, setViewState] = useState({
    longitude: 15.0,
    latitude: 50.0,
    zoom: 4,
  });
  const mapRef = useRef<any>(null);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    fetchSharedTrip();
  }, [token]);

  const fetchSharedTrip = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/share/trips/${token}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError("This shared trip was not found or is no longer available.");
          return;
        }
        throw new Error("Failed to fetch shared trip");
      }

      const data = await response.json();
      setTrip(data.trip);
      setTripPoints(data.tripPoints || []);

      // Auto-center map on first point if available
      if (data.tripPoints && data.tripPoints.length > 0) {
        const firstPoint = data.tripPoints[0].point;
        setViewState({
          longitude: firstPoint.lng,
          latitude: firstPoint.lat,
          zoom: 10,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shared trip");
    } finally {
      setLoading(false);
    }
  };

  const handlePointClick = (tripPoint: TripPoint) => {
    setSelectedPointId(tripPoint.pointId);
    setSelectedPointForModal(tripPoint);

    // Center map on clicked point
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [tripPoint.point.lng, tripPoint.point.lat],
        zoom: 12,
        duration: 1000,
      });
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600 text-center py-4">Loading shared trip...</p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">{error || "Trip not found"}</p>
          <a
            href="/"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Go to homepage
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex">
      {/* Left Sidebar - Trip Info & Points List */}
      <div className="w-[450px] bg-white border-r overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b bg-gray-50 sticky top-0 z-10">
          {/* Badges */}
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            <span className="inline-block px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
              🔗 Shared link
            </span>
            <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full" title="You cannot edit this trip">
              🔒 Read-only
            </span>
          </div>

          {trip.owner && (
            <div className="mb-2 text-xs text-gray-500">
              Shared by {trip.owner.email}
            </div>
          )}

          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {trip.title}
          </h1>
          <p className="text-sm text-gray-600">
            {trip.description || "No description"}
          </p>
          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
            <span>
              {tripPoints.length} {tripPoints.length === 1 ? "point" : "points"}
            </span>
          </div>
        </div>

        {/* Points List */}
        <div className="p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Points in this Trip
          </h2>

          {tripPoints.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-2">This trip has no points yet.</p>
              <p className="text-sm text-gray-400">
                The owner hasn't added places yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tripPoints.map((tp) => (
                <div
                  key={tp.id}
                  onClick={() => handlePointClick(tp)}
                  className={`border rounded-lg p-3 cursor-pointer transition-all ${
                    selectedPointId === tp.pointId
                      ? "border-blue-500 bg-blue-50 shadow-md"
                      : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex gap-3">
                    {/* Thumbnail */}
                    {tp.point.photoUrl ? (
                      <img
                        src={tp.point.photoUrl}
                        alt={tp.point.title}
                        className="w-16 h-16 object-cover rounded flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded flex-shrink-0 flex items-center justify-center">
                        <span className="text-gray-400 text-xs">No photo</span>
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {tp.point.title}
                      </h3>
                      {tp.point.description && (
                        <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                          {tp.point.description}
                        </p>
                      )}
                      {tp.note && (
                        <p className="text-xs text-blue-600 mt-1 italic">
                          Note: {tp.note}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Map */}
      <div className="flex-1 relative">
        {!mapboxToken ? (
          <div className="h-full flex items-center justify-center bg-gray-100">
            <p className="text-gray-500">Map not configured</p>
          </div>
        ) : (
          <Map
            ref={mapRef}
            {...viewState}
            onMove={(evt) => setViewState(evt.viewState)}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            mapboxAccessToken={mapboxToken}
            style={{ width: "100%", height: "100%" }}
          >
            {tripPoints.map((tp) => (
              <Marker
                key={tp.id}
                longitude={tp.point.lng}
                latitude={tp.point.lat}
                anchor="bottom"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  handlePointClick(tp);
                }}
              >
                <div
                  className={`cursor-pointer transition-transform ${
                    selectedPointId === tp.pointId
                      ? "scale-125"
                      : "hover:scale-110"
                  }`}
                >
                  <svg
                    width="30"
                    height="40"
                    viewBox="0 0 30 40"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M15 0C6.716 0 0 6.716 0 15c0 11.25 15 25 15 25s15-13.75 15-25c0-8.284-6.716-15-15-15z"
                      fill={
                        selectedPointId === tp.pointId ? "#2563eb" : "#3b82f6"
                      }
                    />
                    <circle cx="15" cy="15" r="5" fill="white" />
                  </svg>
                </div>
              </Marker>
            ))}
          </Map>
        )}

        {/* Map overlay info */}
        {tripPoints.length > 0 && (
          <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg px-4 py-2">
            <p className="text-sm font-medium text-gray-900">
              Showing {tripPoints.length} point{tripPoints.length !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Click markers or list items to highlight
            </p>
          </div>
        )}
      </div>

      {/* Point Details Modal */}
      <PointDetailsModal
        point={selectedPointForModal?.point || null}
        note={selectedPointForModal?.note}
        onClose={() => setSelectedPointForModal(null)}
      />
    </div>
  );
}
