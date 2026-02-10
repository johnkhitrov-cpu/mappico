'use client';

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { getAuthHeaders } from "@/lib/clientAuth";
import { useGlobalToast } from "@/components/ClientLayout";
import Map, { Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import PointDetailsModal from "@/components/PointDetailsModal";
import { TripDetailHeaderSkeleton, PointCardSkeleton, MapSkeleton } from "@/components/Skeleton";

interface Trip {
  id: string;
  title: string;
  description: string | null;
  visibility: string;
  createdAt: string;
  updatedAt: string;
  isOwner: boolean;
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

export default function TripDetailPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;
  const { success, error: showError } = useGlobalToast();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "FRIENDS" | "UNLISTED">("PRIVATE");

  // Trip points state
  const [tripPoints, setTripPoints] = useState<TripPoint[]>([]);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [removingPointId, setRemovingPointId] = useState<string | null>(null);

  // Share link state
  const [generatingShareLink, setGeneratingShareLink] = useState(false);

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
    fetchTrip();
    fetchTripPoints();
  }, [tripId]);

  const fetchTrip = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          showError("Trip not found");
          router.push("/trips");
          return;
        }
        if (response.status === 403) {
          showError("You don't have permission to view this trip");
          router.push("/trips");
          return;
        }
        throw new Error("Failed to fetch trip");
      }

      const data = await response.json();
      setTrip(data.trip);
      setTitle(data.trip.title);
      setDescription(data.trip.description || "");
      setVisibility(data.trip.visibility);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to load trip");
    } finally {
      setLoading(false);
    }
  };

  const fetchTripPoints = async () => {
    setPointsLoading(true);
    try {
      const response = await fetch(`/api/trips/${tripId}/points`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
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
      }
    } catch (err) {
      console.error("Failed to fetch trip points:", err);
    } finally {
      setPointsLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditing(true);

    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          title,
          description: description || null,
          visibility,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          showError("Too many requests. Please try again later.");
        } else {
          showError(data.error || "Failed to update trip");
        }
        throw new Error(data.error);
      }

      success("Trip updated successfully!");
      setTrip(data.trip);
    } catch (err) {
      console.error("Update trip error:", err);
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this trip? This action cannot be undone.")) {
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const data = await response.json();
        showError(data.error || "Failed to delete trip");
        throw new Error(data.error);
      }

      success("Trip deleted successfully!");
      router.push("/trips");
    } catch (err) {
      console.error("Delete trip error:", err);
      setDeleting(false);
    }
  };

  const handleRemoveFromTrip = async (pointId: string) => {
    if (!confirm("Remove this point from the trip?\n\nThe point will remain in your collection and on the map.")) {
      return;
    }

    setRemovingPointId(pointId);

    try {
      const response = await fetch(`/api/trips/${tripId}/points/${pointId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const data = await response.json();
        showError(data.error || "Failed to remove point from trip");
        throw new Error(data.error);
      }

      // Remove from local state
      setTripPoints(tripPoints.filter((tp) => tp.pointId !== pointId));

      // Clear selection if this point was selected
      if (selectedPointId === pointId) {
        setSelectedPointId(null);
      }

      success("Point removed from trip!");
    } catch (err) {
      console.error("Remove point from trip error:", err);
    } finally {
      setRemovingPointId(null);
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

  const handleCopyShareLink = async () => {
    setGeneratingShareLink(true);

    try {
      const response = await fetch(`/api/trips/${tripId}/share-token`, {
        method: "POST",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const data = await response.json();
        showError(data.error || "Failed to generate share link");
        throw new Error(data.error);
      }

      const data = await response.json();

      // Copy to clipboard
      await navigator.clipboard.writeText(data.shareUrl);

      success("Share link copied to clipboard!");
    } catch (err) {
      console.error("Generate share link error:", err);
    } finally {
      setGeneratingShareLink(false);
    }
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="h-[calc(100vh-4rem)] flex flex-col md:flex-row">
          {/* Left Sidebar Skeleton */}
          <div className="w-full md:w-[450px] bg-white border-r overflow-y-auto">
            <TripDetailHeaderSkeleton />

            {/* Points List Skeleton */}
            <div className="p-4">
              <div className="h-6 bg-gray-300 rounded w-1/3 mb-3"></div>
              <div className="space-y-3">
                <PointCardSkeleton />
                <PointCardSkeleton />
                <PointCardSkeleton />
              </div>
            </div>
          </div>

          {/* Map Skeleton */}
          <div className="flex-1 relative h-64 md:h-auto">
            <MapSkeleton />
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (!trip) {
    return null;
  }

  return (
    <AuthGuard>
      <div className="h-[calc(100vh-4rem)] flex flex-col md:flex-row">
        {/* Left Sidebar - Trip Info & Points List */}
        <div className="w-full md:w-[450px] bg-white md:border-r overflow-y-auto order-2 md:order-1">
          {/* Header */}
          <div className="p-4 border-b bg-gray-50 sticky top-0 z-10">
            <button
              onClick={() => router.push("/trips")}
              className="text-blue-600 hover:text-blue-700 font-medium text-sm mb-2"
            >
              ← Back to Trips
            </button>

            {/* Shared badge */}
            {!trip.isOwner && trip.owner && (
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                  👤 Shared by {trip.owner.email}
                </span>
                <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full" title="You cannot edit this trip">
                  🔒 Read-only
                </span>
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
                {trip.visibility === "PRIVATE" && "🔒 Private"}
                {trip.visibility === "FRIENDS" && "👥 Friends"}
                {trip.visibility === "UNLISTED" && "🔗 Anyone with link"}
              </span>
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

            {pointsLoading ? (
              <div className="space-y-3">
                <PointCardSkeleton />
                <PointCardSkeleton />
              </div>
            ) : tripPoints.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-2">
                  {trip.isOwner
                    ? "No points in this trip yet."
                    : "This trip has no points yet."}
                </p>
                {trip.isOwner ? (
                  <p className="text-sm text-gray-400">
                    Go to{" "}
                    <a href="/map" className="text-blue-600 hover:underline">
                      /map
                    </a>{" "}
                    and create points with this trip selected.
                  </p>
                ) : (
                  <p className="text-sm text-gray-400">
                    The owner hasn't added places yet.
                  </p>
                )}
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

                    {/* Remove button - only show if owner */}
                    {trip.isOwner && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFromTrip(tp.pointId);
                        }}
                        disabled={removingPointId === tp.pointId}
                        className="mt-2 w-full px-3 py-2 min-h-[44px] text-sm bg-red-50 text-red-600 rounded hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {removingPointId === tp.pointId
                          ? "Removing..."
                          : "Remove from this trip"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Share Section - only show if owner */}
          {trip.isOwner && (
            <div className="p-4 border-t mt-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Share Trip
              </h2>
              {trip.visibility === "UNLISTED" ? (
                <div>
                  <p className="text-sm text-gray-600 mb-2">
                    Anyone with the share link can view this trip (no login required).
                  </p>
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-md mb-3">
                    <p className="text-xs text-amber-800">
                      ⚠️ Use the share link below, not the browser URL. Friends without
                      the link cannot access this trip.
                    </p>
                  </div>
                  <button
                    onClick={handleCopyShareLink}
                    disabled={generatingShareLink}
                    className="w-full px-4 py-2 min-h-[44px] bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed font-medium"
                  >
                    {generatingShareLink ? "Generating..." : "Copy share link"}
                  </button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Share link format: /share/trips/&lt;token&gt;
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-gray-700">
                    💡 Set visibility to{" "}
                    <span className="font-semibold">Anyone with link</span> in the edit
                    section below to enable link sharing.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Edit Section (Collapsible) - only show if owner */}
          {trip.isOwner && (
            <div className="p-4 border-t mt-4">
              <details className="group">
                <summary className="cursor-pointer text-lg font-semibold text-gray-900 mb-3">
                  Edit Trip Info
                </summary>

                <form onSubmit={handleUpdate} className="space-y-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    maxLength={120}
                    disabled={editing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {title.length}/120 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={1000}
                    rows={3}
                    disabled={editing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {description.length}/1000 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Visibility
                  </label>
                  <select
                    value={visibility}
                    onChange={(e) =>
                      setVisibility(e.target.value as "PRIVATE" | "FRIENDS" | "UNLISTED")
                    }
                    disabled={editing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PRIVATE">Private (Only me)</option>
                    <option value="FRIENDS">Friends (Visible to friends)</option>
                    <option value="UNLISTED">Unlisted (Anyone with link)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={editing || !title.trim()}
                  className="w-full px-4 py-2 min-h-[44px] bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed font-medium"
                >
                  {editing ? "Saving..." : "Save Changes"}
                </button>

                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full px-4 py-2 min-h-[44px] bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed font-medium"
                >
                  {deleting ? "Deleting..." : "Delete Trip"}
                </button>
              </form>
            </details>
          </div>
          )}
        </div>

        {/* Right Side - Map */}
        <div className="flex-1 relative h-64 md:h-auto order-1 md:order-2">
          {!mapboxToken ? (
            <div className="h-full flex items-center justify-center bg-gray-100">
              <p className="text-gray-500">Mapbox token not configured</p>
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
      </div>

      {/* Point Details Modal */}
      <PointDetailsModal
        point={selectedPointForModal?.point || null}
        note={selectedPointForModal?.note}
        onClose={() => setSelectedPointForModal(null)}
      />
    </AuthGuard>
  );
}
