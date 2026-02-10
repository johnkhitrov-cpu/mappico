'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { getAuthHeaders } from "@/lib/clientAuth";
import { useGlobalToast } from "@/components/ClientLayout";

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

export default function TripsPage() {
  const router = useRouter();
  const { success, error: showError } = useGlobalToast();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [sharedTrips, setSharedTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharedLoading, setSharedLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "FRIENDS" | "UNLISTED">("PRIVATE");

  useEffect(() => {
    fetchTrips();
    fetchSharedTrips();
  }, []);

  const fetchTrips = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/trips", {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch trips");
      }

      const data = await response.json();
      setTrips(data.trips);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to load trips");
    } finally {
      setLoading(false);
    }
  };

  const fetchSharedTrips = async () => {
    setSharedLoading(true);
    try {
      const response = await fetch("/api/trips?shared=true", {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch shared trips");
      }

      const data = await response.json();
      setSharedTrips(data.trips);
    } catch (err) {
      console.error("Failed to load shared trips:", err);
      // Don't show error toast for shared trips, just log it
    } finally {
      setSharedLoading(false);
    }
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          title,
          description: description || undefined,
          visibility,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          showError("Too many requests. Please try again later.");
        } else {
          showError(data.error || "Failed to create trip");
        }
        throw new Error(data.error);
      }

      success("Trip created successfully!");
      setTitle("");
      setDescription("");
      setVisibility("PRIVATE");
      setShowCreateForm(false);
      fetchTrips();
    } catch (err) {
      console.error("Create trip error:", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">My Trips</h1>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
            >
              {showCreateForm ? "Cancel" : "Create Trip"}
            </button>
          </div>

          {/* Create form */}
          {showCreateForm && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Create New Trip
              </h2>
              <form onSubmit={handleCreateTrip} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter trip title"
                    required
                    maxLength={120}
                    disabled={creating}
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
                    placeholder="Enter trip description (optional)"
                    maxLength={1000}
                    rows={4}
                    disabled={creating}
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
                    onChange={(e) => setVisibility(e.target.value as "PRIVATE" | "FRIENDS" | "UNLISTED")}
                    disabled={creating}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PRIVATE">Private (Only me)</option>
                    <option value="FRIENDS">Friends (Visible to friends)</option>
                    <option value="UNLISTED">Unlisted (Anyone with link)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={creating || !title.trim()}
                  className="w-full px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed font-medium"
                >
                  {creating ? "Creating..." : "Create Trip"}
                </button>
              </form>
            </div>
          )}

          {/* My Trips list */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              My Trips
            </h2>
            {loading ? (
              <p className="text-gray-600 text-center py-4">Loading...</p>
            ) : trips.length === 0 ? (
              <p className="text-gray-600 text-center py-4">
                No trips yet. Create your first trip above!
              </p>
            ) : (
              <div className="space-y-3">
                {trips.map((trip) => (
                  <div
                    key={trip.id}
                    onClick={() => router.push(`/trips/${trip.id}`)}
                    className="p-4 bg-gray-50 rounded-md hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900">
                          {trip.title}
                        </h3>
                        {trip.description && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {trip.description}
                          </p>
                        )}
                        <div className="flex gap-3 mt-2">
                          <span className="text-xs text-gray-500">
                            {trip.visibility === "PRIVATE" && "🔒 Private"}
                            {trip.visibility === "FRIENDS" && "👥 Friends"}
                            {trip.visibility === "UNLISTED" && "🔗 Anyone with link"}
                          </span>
                          <span className="text-xs text-gray-500">
                            Updated {new Date(trip.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Shared Trips list */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Trips Shared with Me
            </h2>
            {sharedLoading ? (
              <p className="text-gray-600 text-center py-4">Loading...</p>
            ) : sharedTrips.length === 0 ? (
              <p className="text-gray-600 text-center py-4">
                No friends have shared trips with you yet.
              </p>
            ) : (
              <div className="space-y-3">
                {sharedTrips.map((trip) => (
                  <div
                    key={trip.id}
                    onClick={() => router.push(`/trips/${trip.id}`)}
                    className="p-4 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 cursor-pointer transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-medium text-gray-900">
                            {trip.title}
                          </h3>
                          <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                            Shared
                          </span>
                        </div>
                        {trip.description && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {trip.description}
                          </p>
                        )}
                        <div className="flex gap-3 mt-2">
                          <span className="text-xs text-gray-500">
                            👤 Shared by {trip.owner?.email}
                          </span>
                          <span className="text-xs text-gray-500">
                            Updated {new Date(trip.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
