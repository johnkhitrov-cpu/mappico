"use client";

import { useState, useEffect } from "react";
import Map, { NavigationControl, Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { getAuthHeaders } from "@/lib/clientAuth";

interface Point {
  id: string;
  lat: number;
  lng: number;
  title: string;
  description: string | null;
  photoUrl: string | null;
  createdAt: string;
}

interface FriendPoint {
  id: string;
  userId: string;
  userEmail: string;
  lat: number;
  lng: number;
  title: string;
  description: string | null;
  photoUrl: string | null;
  createdAt: string;
}

interface Friend {
  id: string;
  email: string;
}

interface ClickedCoords {
  lat: number;
  lng: number;
}

type SelectedPoint = (Point & { isMine: true }) | (FriendPoint & { isMine: false });

export default function MapComponent() {
  const [viewState, setViewState] = useState({
    longitude: 15.0,
    latitude: 50.0,
    zoom: 4,
  });

  const [myPoints, setMyPoints] = useState<Point[]>([]);
  const [friendPoints, setFriendPoints] = useState<FriendPoint[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clickedCoords, setClickedCoords] = useState<ClickedCoords | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);

  // Filter state
  const [showMyPoints, setShowMyPoints] = useState(true);
  const [showFriendsPoints, setShowFriendsPoints] = useState(true);
  const [selectedFriendId, setSelectedFriendId] = useState<string>("all");

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Fetch all data on mount
  useEffect(() => {
    fetchAllData();
  }, []);

  // Subscribe to SSE for real-time updates
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;

    const connectSSE = () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          console.warn("No token found, skipping SSE connection");
          return;
        }

        // Note: EventSource doesn't support custom headers in browser
        // So we pass the token as a query parameter
        eventSource = new EventSource(`/api/realtime/points?token=${token}`);

        eventSource.addEventListener("connected", (event) => {
          console.log("SSE connected:", event.data);
        });

        eventSource.addEventListener("point_created", (event) => {
          try {
            const data = JSON.parse(event.data);
            const newPoint: FriendPoint = data.point;

            // Check if point already exists (avoid duplicates)
            setFriendPoints((prev) => {
              const exists = prev.some((p) => p.id === newPoint.id);
              if (exists) return prev;
              return [newPoint, ...prev];
            });

            console.log("New point received via SSE:", newPoint.title);
          } catch (parseError) {
            console.error("Failed to parse SSE point_created event:", parseError);
          }
        });

        eventSource.onerror = (error) => {
          console.error("SSE error:", error);
          eventSource?.close();

          // Retry connection after 2 seconds
          retryTimeout = setTimeout(() => {
            console.log("Retrying SSE connection...");
            connectSSE();
          }, 2000);
        };
      } catch (error) {
        console.error("Failed to create SSE connection:", error);
      }
    };

    // Connect after initial data load
    const initTimeout = setTimeout(connectSSE, 1000);

    // Cleanup on unmount
    return () => {
      if (initTimeout) clearTimeout(initTimeout);
      if (retryTimeout) clearTimeout(retryTimeout);
      if (eventSource) {
        console.log("Closing SSE connection");
        eventSource.close();
      }
    };
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    setError("");
    try {
      const [myPointsRes, friendPointsRes, friendsRes] = await Promise.all([
        fetch("/api/points", { headers: getAuthHeaders() }),
        fetch("/api/points/friends", { headers: getAuthHeaders() }),
        fetch("/api/friends/list", { headers: getAuthHeaders() }),
      ]);

      if (!myPointsRes.ok || !friendPointsRes.ok || !friendsRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const myPointsData = await myPointsRes.json();
      const friendPointsData = await friendPointsRes.json();
      const friendsData = await friendsRes.json();

      setMyPoints(myPointsData.points);
      setFriendPoints(friendPointsData.points);
      setFriends(friendsData.friends);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleMapClick = (event: any) => {
    const { lngLat } = event;
    setClickedCoords({ lat: lngLat.lat, lng: lngLat.lng });
    setTitle("");
    setDescription("");
    setSaveError("");
    setSelectedFile(null);
    setPreviewUrl(null);
    setSelectedPoint(null);
  };

  const handleSavePoint = async () => {
    if (!clickedCoords) return;

    setSaving(true);
    setSaveError("");

    try {
      let photoUrl: string | undefined;

      // Upload photo if selected
      if (selectedFile) {
        setUploading(true);
        try {
          // Get signed upload parameters
          const signResponse = await fetch("/api/upload/sign", {
            method: "POST",
            headers: getAuthHeaders(),
          });

          if (!signResponse.ok) {
            throw new Error("Failed to get upload signature");
          }

          const signData = await signResponse.json();

          // Upload to Cloudinary
          const formData = new FormData();
          formData.append("file", selectedFile);
          formData.append("api_key", signData.apiKey);
          formData.append("timestamp", signData.timestamp.toString());
          formData.append("signature", signData.signature);
          formData.append("folder", signData.folder);

          const uploadResponse = await fetch(
            `https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`,
            {
              method: "POST",
              body: formData,
            }
          );

          if (!uploadResponse.ok) {
            throw new Error("Failed to upload image");
          }

          const uploadData = await uploadResponse.json();
          photoUrl = uploadData.secure_url;
        } catch (uploadErr) {
          throw new Error(
            uploadErr instanceof Error
              ? `Upload failed: ${uploadErr.message}`
              : "Failed to upload image"
          );
        } finally {
          setUploading(false);
        }
      }

      // Create point with photo URL
      const response = await fetch("/api/points", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          lat: clickedCoords.lat,
          lng: clickedCoords.lng,
          title,
          description: description || undefined,
          photoUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save point");
      }

      // Add new point to state
      setMyPoints([data.point, ...myPoints]);

      // Close modal
      setClickedCoords(null);
      setTitle("");
      setDescription("");
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save point");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelPoint = () => {
    setClickedCoords(null);
    setTitle("");
    setDescription("");
    setSaveError("");
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleRemoveFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  // Compute visible points based on filters
  const visibleMyPoints = showMyPoints ? myPoints : [];
  const visibleFriendPoints = showFriendsPoints
    ? selectedFriendId === "all"
      ? friendPoints
      : friendPoints.filter((p) => p.userId === selectedFriendId)
    : [];

  if (!mapboxToken) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-100">
        <p className="text-red-600">
          Mapbox token not found. Please check your environment variables.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      {loading && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-white px-4 py-2 rounded-lg shadow-md">
          <p className="text-sm text-gray-600">Loading points...</p>
        </div>
      )}

      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-red-50 px-4 py-2 rounded-lg shadow-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Filter Panel */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-xl p-4 w-64 z-20">
        <h3 className="text-sm font-bold text-gray-900 mb-3">Filters</h3>

        <div className="space-y-3">
          {/* Show my points checkbox */}
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={showMyPoints}
              onChange={(e) => setShowMyPoints(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Show my points</span>
          </label>

          {/* Show friends points checkbox */}
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={showFriendsPoints}
              onChange={(e) => setShowFriendsPoints(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Show friends points</span>
          </label>

          {/* Friend selector dropdown */}
          {showFriendsPoints && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Friend
              </label>
              <select
                value={selectedFriendId}
                onChange={(e) => setSelectedFriendId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All friends</option>
                {friends.map((friend) => (
                  <option key={friend.id} value={friend.id}>
                    {friend.email}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-500">
          <div>My points: {myPoints.length}</div>
          <div>Friends points: {friendPoints.length}</div>
        </div>
      </div>

      <Map
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onClick={handleMapClick}
        mapboxAccessToken={mapboxToken}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
      >
        <NavigationControl position="top-right" />

        {/* Render markers for my points */}
        {visibleMyPoints.map((point) => (
          <Marker
            key={`my-${point.id}`}
            longitude={point.lng}
            latitude={point.lat}
            anchor="bottom"
          >
            <div
              className="bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-white text-xs font-bold shadow-lg cursor-pointer hover:bg-blue-700"
              title={point.title}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPoint({ ...point, isMine: true });
              }}
            >
              📍
            </div>
          </Marker>
        ))}

        {/* Render markers for friends points (different color) */}
        {visibleFriendPoints.map((point) => (
          <Marker
            key={`friend-${point.id}`}
            longitude={point.lng}
            latitude={point.lat}
            anchor="bottom"
          >
            <div
              className="bg-green-600 rounded-full w-6 h-6 flex items-center justify-center text-white text-xs font-bold shadow-lg cursor-pointer hover:bg-green-700"
              title={`${point.title} (by ${point.userEmail})`}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPoint({ ...point, isMine: false });
              }}
            >
              📍
            </div>
          </Marker>
        ))}

        {/* Temporary marker for clicked location */}
        {clickedCoords && (
          <Marker
            longitude={clickedCoords.lng}
            latitude={clickedCoords.lat}
            anchor="bottom"
          >
            <div className="bg-red-600 rounded-full w-6 h-6 flex items-center justify-center text-white text-xs font-bold shadow-lg">
              📍
            </div>
          </Marker>
        )}
      </Map>

      {/* Add point modal */}
      {clickedCoords && (
        <div className="absolute top-20 left-4 bg-white rounded-lg shadow-xl p-4 w-80 z-30">
          <h3 className="text-lg font-bold text-gray-900 mb-3">Add Point</h3>

          {saveError && (
            <div className="mb-3 bg-red-50 p-2 rounded">
              <p className="text-sm text-red-600">{saveError}</p>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter title"
                maxLength={80}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                maxLength={500}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Photo (optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={saving || uploading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              {previewUrl && (
                <div className="mt-2 relative">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-32 object-cover rounded-md"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    disabled={saving || uploading}
                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-700 disabled:bg-red-400"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSavePoint}
                disabled={saving || uploading || !title.trim()}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed font-medium"
              >
                {uploading ? "Uploading..." : saving ? "Saving..." : "Save Point"}
              </button>
              <button
                onClick={handleCancelPoint}
                disabled={saving || uploading}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Point details popup */}
      {selectedPoint && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-xl p-4 w-80 z-20 max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-lg font-bold text-gray-900">{selectedPoint.title}</h3>
            <button
              onClick={() => setSelectedPoint(null)}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Show author for friend points */}
          {!selectedPoint.isMine && (
            <div className="mb-3">
              <p className="text-xs text-gray-500">
                by: <span className="font-medium text-gray-700">{selectedPoint.userEmail}</span>
              </p>
            </div>
          )}

          {selectedPoint.photoUrl && (
            <div className="mb-3">
              <img
                src={selectedPoint.photoUrl}
                alt={selectedPoint.title}
                className="w-full h-48 object-cover rounded-md"
              />
            </div>
          )}

          {selectedPoint.description && (
            <div className="mb-3">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {selectedPoint.description}
              </p>
            </div>
          )}

          <div className="text-xs text-gray-500">
            {new Date(selectedPoint.createdAt).toLocaleDateString()}
          </div>
        </div>
      )}
    </div>
  );
}
