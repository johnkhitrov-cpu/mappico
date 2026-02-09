'use client';

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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
  const [visibility, setVisibility] = useState<"PRIVATE" | "FRIENDS">("PRIVATE");

  useEffect(() => {
    fetchTrip();
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

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-gray-600 text-center py-4">Loading...</p>
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
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => router.push("/trips")}
            className="mb-4 text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Trips
          </button>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-6">
              <h1 className="text-3xl font-bold text-gray-900">
                {trip.title}
              </h1>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed font-medium"
              >
                {deleting ? "Deleting..." : "Delete Trip"}
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <p className="text-sm text-gray-500">Description</p>
                <p className="text-gray-900 mt-1">
                  {trip.description || "(No description)"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Visibility</p>
                <p className="text-gray-900 mt-1">
                  {trip.visibility === "PRIVATE" ? "🔒 Private" : "👥 Friends"}
                </p>
              </div>

              <div className="flex gap-6">
                <div>
                  <p className="text-sm text-gray-500">Created</p>
                  <p className="text-gray-900 mt-1">
                    {new Date(trip.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Last Updated</p>
                  <p className="text-gray-900 mt-1">
                    {new Date(trip.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <hr className="my-6" />

            {/* Edit form */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Edit Trip
              </h2>
              <form onSubmit={handleUpdate} className="space-y-4">
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
                    rows={4}
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
                    onChange={(e) => setVisibility(e.target.value as "PRIVATE" | "FRIENDS")}
                    disabled={editing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PRIVATE">Private (Only me)</option>
                    <option value="FRIENDS">Friends (Visible to friends)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={editing || !title.trim()}
                  className="w-full px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed font-medium"
                >
                  {editing ? "Saving..." : "Save Changes"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
