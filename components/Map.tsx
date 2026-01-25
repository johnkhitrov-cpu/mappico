"use client";

import { useState, useEffect } from "react";
import Map, { NavigationControl, Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { getAuthHeaders } from "@/lib/clientAuth";
import { useGlobalToast } from "./ClientLayout";

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
  const { success, error: showError } = useGlobalToast();

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
  const [fileValidationError, setFileValidationError] = useState("");
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Filter state
  const [showMyPoints, setShowMyPoints] = useState(true);
  const [showFriendsPoints, setShowFriendsPoints] = useState(true);
  const [selectedFriendId, setSelectedFriendId] = useState<string>("all");

  // Geolocation state
  const [locatingUser, setLocatingUser] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

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

        eventSource.addEventListener("point_deleted", (event) => {
          try {
            const data = JSON.parse(event.data);
            const pointId = data.pointId;

            // Remove point from friend points
            setFriendPoints((prev) => prev.filter((p) => p.id !== pointId));

            console.log("Point deleted via SSE:", pointId);
          } catch (parseError) {
            console.error("Failed to parse SSE point_deleted event:", parseError);
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
    setFileValidationError("");
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
          // Upload to Cloudinary using unsigned preset
          const formData = new FormData();
          formData.append("file", selectedFile);
          formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);
          formData.append("folder", "mappico");

          const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
          const uploadResponse = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
            {
              method: "POST",
              body: formData,
            }
          );

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(errorData.error?.message || "Failed to upload image");
          }

          const uploadData = await uploadResponse.json();
          photoUrl = uploadData.secure_url;
        } catch (uploadErr) {
          const errorMsg = uploadErr instanceof Error
            ? `Upload failed: ${uploadErr.message}`
            : "Failed to upload image";
          showError(errorMsg);
          throw new Error(errorMsg);
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
        // Handle rate limiting
        if (response.status === 429) {
          showError("Too many requests. Please try again later.");
        } else {
          showError(data.error || "Failed to save point");
        }
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

      // Show success toast
      success("Point created successfully!");
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
    setFileValidationError("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    // Clear previous errors
    setFileValidationError("");

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setFileValidationError("File size exceeds 5MB limit");
      e.target.value = ""; // Clear input
      return;
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setFileValidationError("Only JPG, PNG, and WEBP images are allowed");
      e.target.value = ""; // Clear input
      return;
    }

    // Validate file extension (extra security)
    const fileName = file.name.toLowerCase();
    const hasValidExtension = ['jpg', 'jpeg', 'png', 'webp'].some(ext =>
      fileName.endsWith(`.${ext}`)
    );

    if (!hasValidExtension) {
      setFileValidationError("Only JPG, PNG, and WEBP images are allowed");
      e.target.value = ""; // Clear input
      return;
    }

    // File is valid
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleRemoveFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setFileValidationError("");
  };

  const handleDeletePoint = async () => {
    if (!selectedPoint || !selectedPoint.isMine) return;

    setDeleting(true);
    setDeleteError("");

    try {
      const response = await fetch(`/api/points/${selectedPoint.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        showError(data.error || "Failed to delete point");
        throw new Error(data.error || "Failed to delete point");
      }

      // Remove point from state
      setMyPoints((prev) => prev.filter((p) => p.id !== selectedPoint.id));

      // Close popup and confirmation dialog
      setSelectedPoint(null);
      setShowDeleteConfirm(false);

      // Show success toast
      success("Point deleted successfully");
      console.log("Point deleted successfully:", selectedPoint.id);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete point");
    } finally {
      setDeleting(false);
    }
  };

  const handleMyLocation = () => {
    if (!navigator.geolocation) {
      showError("Geolocation is not supported by your browser");
      return;
    }

    setLocatingUser(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        // Center map on user location
        setViewState({
          longitude,
          latitude,
          zoom: 13,
        });

        // Set temporary user location marker
        setUserLocation({ lat: latitude, lng: longitude });

        // Clear the marker after 5 seconds
        setTimeout(() => {
          setUserLocation(null);
        }, 5000);

        setLocatingUser(false);
      },
      (error) => {
        setLocatingUser(false);

        if (error.code === error.PERMISSION_DENIED) {
          showError("Location access denied. Please enable location permissions.");
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          showError("Location information unavailable.");
        } else if (error.code === error.TIMEOUT) {
          showError("Location request timed out.");
        } else {
          showError("Failed to get your location.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Compute visible points based on filters
  const visibleMyPoints = showMyPoints ? myPoints : [];
  const visibleFriendPoints = showFriendsPoints
    ? selectedFriendId === "all"
      ? friendPoints
      : friendPoints.filter((p) => p.userId === selectedFriendId)
    : [];

  // Check if there are any visible points
  const hasVisiblePoints = visibleMyPoints.length > 0 || visibleFriendPoints.length > 0;

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

      {/* Empty state overlay */}
      {!loading && !hasVisiblePoints && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 bg-white/90 backdrop-blur-sm px-8 py-6 rounded-lg shadow-lg text-center max-w-md">
          <p className="text-lg text-gray-700 mb-2">No points yet</p>
          <p className="text-sm text-gray-500">Click on the map to add your first point</p>
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

        {/* My Location button */}
        <div className="absolute bottom-4 right-4 z-10">
          <button
            onClick={handleMyLocation}
            disabled={locatingUser}
            className="bg-white hover:bg-gray-100 text-gray-700 rounded-full p-3 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Go to my location"
          >
            {locatingUser ? (
              <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        </div>

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

        {/* User location marker (temporary) */}
        {userLocation && (
          <Marker
            longitude={userLocation.lng}
            latitude={userLocation.lat}
            anchor="center"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 rounded-full w-4 h-4 animate-ping opacity-75"></div>
              <div className="bg-blue-500 rounded-full w-4 h-4 border-2 border-white shadow-lg"></div>
            </div>
          </Marker>
        )}
      </Map>

      {/* Add point modal */}
      {clickedCoords && (
        <div className="absolute top-4 left-4 right-4 md:top-20 md:left-4 md:right-auto bg-white rounded-lg shadow-xl p-4 md:w-80 z-30 max-h-[calc(100vh-2rem)] overflow-y-auto">
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
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                disabled={saving || uploading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Only JPG, PNG, WEBP up to 5MB
              </p>
              {fileValidationError && (
                <div className="mt-2 bg-red-50 p-2 rounded">
                  <p className="text-sm text-red-600">{fileValidationError}</p>
                </div>
              )}
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
        <div className="absolute top-4 left-4 right-4 md:top-4 md:right-4 md:left-auto bg-white rounded-lg shadow-xl p-4 md:w-80 z-20 max-h-[calc(100vh-2rem)] overflow-y-auto">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-lg font-bold text-gray-900">{selectedPoint.title}</h3>
            <button
              onClick={() => {
                setSelectedPoint(null);
                setShowDeleteConfirm(false);
                setDeleteError("");
              }}
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

          <div className="text-xs text-gray-500 mb-3">
            {new Date(selectedPoint.createdAt).toLocaleDateString()}
          </div>

          {/* Delete button - only for owned points */}
          {selectedPoint.isMine && !showDeleteConfirm && (
            <div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting}
                className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed font-medium text-sm"
              >
                Delete Point
              </button>
            </div>
          )}

          {/* Delete confirmation */}
          {selectedPoint.isMine && showDeleteConfirm && (
            <div className="border-t pt-3">
              <p className="text-sm text-gray-700 mb-3">
                Are you sure you want to delete this point?
                {selectedPoint.photoUrl && " The photo will also be deleted from Cloudinary."}
              </p>

              {deleteError && (
                <div className="mb-3 bg-red-50 p-2 rounded">
                  <p className="text-sm text-red-600">{deleteError}</p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleDeletePoint}
                  disabled={deleting}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed font-medium text-sm"
                >
                  {deleting ? "Deleting..." : "Yes, Delete"}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteError("");
                  }}
                  disabled={deleting}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed font-medium text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
