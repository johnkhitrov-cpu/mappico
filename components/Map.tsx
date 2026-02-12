"use client";

import { useState, useEffect, useRef } from "react";
import Map, { NavigationControl, Marker, MapRef } from "react-map-gl/mapbox";
import mapboxgl from "mapbox-gl";
import { createRoot } from "react-dom/client";
import "mapbox-gl/dist/mapbox-gl.css";
import { getAuthHeaders } from "@/lib/clientAuth";
import { useGlobalToast } from "./ClientLayout";
import { useOnboarding } from "@/lib/useOnboarding";
import { useAnalytics } from "@/lib/analytics";
import FriendsDrawer from './FriendsDrawer';
import MapDrawer from './MapDrawer';
import TripsDrawer from './TripsDrawer';
import ProfileModal from './ProfileModal';
import AddPointPopupForm from './AddPointPopupForm';
import PointInfoPopupCard from './PointInfoPopupCard';

interface Point {
  id: string;
  lat: number;
  lng: number;
  title: string;
  description: string | null;
  photoUrl: string | null;
  address: string | null;
  category: 'PLACE' | 'FOOD' | 'STAY' | 'ACTIVITY' | 'OTHER';
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
  address: string | null;
  category: 'PLACE' | 'FOOD' | 'STAY' | 'ACTIVITY' | 'OTHER';
  createdAt: string;
}

interface Friend {
  id: string;
  email: string;
}

interface Trip {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  visibility: string;
  createdAt: string;
  updatedAt: string;
}

interface ClickedCoords {
  lat: number;
  lng: number;
}

interface IncomingRequest {
  id: string;
  fromUserId: string;
  fromUserEmail: string;
  createdAt: string;
}

// Helper: Get marker color based on category
function getCategoryColor(category: 'PLACE' | 'FOOD' | 'STAY' | 'ACTIVITY' | 'OTHER' | undefined): string {
  if (!category) return 'bg-emerald-500';  // Legacy points

  switch (category) {
    case 'PLACE':
      return 'bg-emerald-500';
    case 'FOOD':
      return 'bg-orange-500';
    case 'STAY':
      return 'bg-indigo-500';
    case 'ACTIVITY':
      return 'bg-purple-500';
    case 'OTHER':
      return 'bg-slate-500';
    default:
      return 'bg-emerald-500';
  }
}

// Helper: Get emoji based on category
function getCategoryEmoji(category: 'PLACE' | 'FOOD' | 'STAY' | 'ACTIVITY' | 'OTHER' | undefined): string {
  if (!category) return '📍';

  switch (category) {
    case 'PLACE':
      return '📍';
    case 'FOOD':
      return '🍜';
    case 'STAY':
      return '🏨';
    case 'ACTIVITY':
      return '🎟️';
    case 'OTHER':
      return '✨';
    default:
      return '📍';
  }
}

export default function MapComponent() {
  const { success, error: showError } = useGlobalToast();
  const { shouldShowOnboarding, markOnboardingComplete } = useOnboarding();
  const { trackEvent } = useAnalytics();

  const [viewState, setViewState] = useState({
    longitude: 15.0,
    latitude: 50.0,
    zoom: 4,
  });

  const [myPoints, setMyPoints] = useState<Point[]>([]);
  const [friendPoints, setFriendPoints] = useState<FriendPoint[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clickedCoords, setClickedCoords] = useState<ClickedCoords | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileValidationError, setFileValidationError] = useState("");
  const [category, setCategory] = useState<'PLACE' | 'FOOD' | 'STAY' | 'ACTIVITY' | 'OTHER'>('PLACE');

  // Filter state
  const [showMyPoints, setShowMyPoints] = useState(true);
  const [showFriendsPoints, setShowFriendsPoints] = useState(true);
  const [selectedFriendId, setSelectedFriendId] = useState<string>("all");

  // Friends drawer state
  const [showFriendsDrawer, setShowFriendsDrawer] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);

  // Mode state (Map vs Trips)
  const [mode, setMode] = useState<'map' | 'trips'>('map');

  // Trips drawer state
  const [showTripsDrawer, setShowTripsDrawer] = useState(false);

  // Active trip filter
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [activeTripPointIds, setActiveTripPointIds] = useState<Set<string>>(new Set());

  // Left drawer state
  const [showMapDrawer, setShowMapDrawer] = useState(false);

  // Profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Geolocation state
  const [locatingUser, setLocatingUser] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Map and popup refs
  const mapRef = useRef<MapRef | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const popupRootRef = useRef<any>(null);
  const pointPopupRef = useRef<mapboxgl.Popup | null>(null);
  const pointPopupRootRef = useRef<any>(null);
  const pointPopupWrapperRef = useRef<HTMLDivElement | null>(null);
  const addPointPopupWrapperRef = useRef<HTMLDivElement | null>(null);
  const pointPopupCleanupRef = useRef<(() => void) | null>(null);
  const ghostMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const ghostTimerRef = useRef<NodeJS.Timeout | null>(null);
  const markerClickTimerRef = useRef<NodeJS.Timeout | null>(null);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Fetch all data on mount
  useEffect(() => {
    fetchAllData();
    fetchTrips();
    fetchIncomingRequests();
  }, []);

  // Fetch trips for dropdown
  const fetchTrips = async () => {
    setTripsLoading(true);
    try {
      const response = await fetch("/api/trips", { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setTrips(data.trips || []);
      }
    } catch (err) {
      console.error("Failed to fetch trips:", err);
    } finally {
      setTripsLoading(false);
    }
  };


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

        eventSource.addEventListener("point_updated", (event) => {
          try {
            const data = JSON.parse(event.data);
            const updatedPoint: FriendPoint = data.point;

            // Update point in friend points
            setFriendPoints((prev) =>
              prev.map((p) => p.id === updatedPoint.id ? updatedPoint : p)
            );

            console.log("Point updated via SSE:", updatedPoint.title);
          } catch (parseError) {
            console.error("Failed to parse SSE point_updated event:", parseError);
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

  const fetchIncomingRequests = async () => {
    try {
      const response = await fetch("/api/friends/incoming", {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setIncomingRequests(data.requests);
      }
    } catch (err) {
      console.error("Failed to fetch incoming requests:", err);
    }
  };

  // Fetch trip point IDs when activeTripId changes
  useEffect(() => {
    if (!activeTripId) {
      setActiveTripPointIds(new Set());
      return;
    }

    const fetchTripPointIds = async () => {
      try {
        const response = await fetch(`/api/trips/${activeTripId}/points`, {
          headers: getAuthHeaders(),
        });
        if (response.ok) {
          const data = await response.json();
          const ids = new Set<string>(
            (data.tripPoints || []).map((tp: { pointId: string }) => tp.pointId)
          );
          setActiveTripPointIds(ids);
        }
      } catch (err) {
        console.error('Failed to fetch trip points:', err);
      }
    };

    fetchTripPointIds();
  }, [activeTripId]);

  // Desktop detection using media query
  const isDesktop = () => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: fine)').matches;
  };

  // Get deep zoom level clamped by map maxZoom
  const getDeepZoom = (map: mapboxgl.Map) => {
    const desired = 18.5;
    const max = map.getMaxZoom?.() ?? 22;
    return Math.min(desired, max);
  };

  // Cleanup popups and ghost marker on unmount (immediate, no animation)
  useEffect(() => {
    return () => {
      if (popupRef.current) { try { popupRef.current.remove(); } catch {} popupRef.current = null; }
      if (popupRootRef.current) { try { popupRootRef.current.unmount(); } catch {} popupRootRef.current = null; }
      addPointPopupWrapperRef.current = null;
      if (pointPopupRef.current) { try { pointPopupRef.current.remove(); } catch {} pointPopupRef.current = null; }
      if (pointPopupRootRef.current) { try { pointPopupRootRef.current.unmount(); } catch {} pointPopupRootRef.current = null; }
      pointPopupWrapperRef.current = null;
      if (pointPopupCleanupRef.current) { pointPopupCleanupRef.current(); pointPopupCleanupRef.current = null; }
      if (ghostMarkerRef.current) { ghostMarkerRef.current.remove(); ghostMarkerRef.current = null; }
      if (ghostTimerRef.current) { clearTimeout(ghostTimerRef.current); ghostTimerRef.current = null; }
      if (markerClickTimerRef.current) { clearTimeout(markerClickTimerRef.current); markerClickTimerRef.current = null; }
    };
  }, []);

  // Pan map so popup stays fully visible inside viewport and marker remains uncovered
  const fitPopupAndKeepMarkerVisible = (
    targetMap: mapboxgl.Map,
    targetPopup: mapboxgl.Popup,
    markerLngLat: [number, number],
    padding = 16,
  ) => {
    const popupEl = targetPopup.getElement();
    if (!popupEl) return;
    const popupRect = popupEl.getBoundingClientRect();
    const containerRect = targetMap.getContainer().getBoundingClientRect();

    let dx = 0;
    let dy = 0;

    // 1) Viewport fit
    if (popupRect.left < containerRect.left + padding)
      dx = containerRect.left + padding - popupRect.left;
    if (popupRect.right > containerRect.right - padding)
      dx = -(popupRect.right - containerRect.right + padding);
    if (popupRect.top < containerRect.top + padding)
      dy = containerRect.top + padding - popupRect.top;
    if (popupRect.bottom > containerRect.bottom - padding)
      dy = -(popupRect.bottom - containerRect.bottom + padding);

    // 2) Keep marker visible (anti-overlap)
    const markerScreen = targetMap.project(markerLngLat);
    const markerR = 18; // marker visual radius in pixels
    const markerScreenRect = {
      left: containerRect.left + markerScreen.x - markerR,
      right: containerRect.left + markerScreen.x + markerR,
      top: containerRect.top + markerScreen.y - markerR,
      bottom: containerRect.top + markerScreen.y + markerR,
    };

    // After applying dx/dy, where would the popup be?
    const adjPopup = {
      left: popupRect.left + dx,
      right: popupRect.right + dx,
      top: popupRect.top + dy,
      bottom: popupRect.bottom + dy,
    };

    // Check if adjusted popup still overlaps marker
    const overlapsH = adjPopup.left < markerScreenRect.right && adjPopup.right > markerScreenRect.left;
    const overlapsV = adjPopup.top < markerScreenRect.bottom && adjPopup.bottom > markerScreenRect.top;

    if (overlapsH && overlapsV) {
      // Nudge vertically so marker peeks out (prefer pushing popup up)
      const nudge = 50;
      if (adjPopup.bottom > markerScreenRect.top && adjPopup.top < markerScreenRect.top) {
        // popup covers marker from above — shift map down (dy negative = map shifts up = popup shifts up)
        dy -= nudge;
      } else {
        dy += nudge;
      }
    }

    if (dx !== 0 || dy !== 0) {
      targetMap.panBy([-dx, -dy], { duration: 300 });
    }
  };

  // Animate popup close, then remove DOM
  const animatedClose = (
    popup: mapboxgl.Popup | null,
    root: any,
    wrapper: HTMLDivElement | null,
  ) => {
    if (!popup) return;

    if (!wrapper) {
      try { root?.unmount(); } catch {}
      try { popup.remove(); } catch {}
      return;
    }

    wrapper.classList.remove('mp-popup-anim--open');
    wrapper.classList.add('mp-popup-anim--closing');

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reducedMotion ? 0 : 150;

    setTimeout(() => {
      try { root?.unmount(); } catch {}
      try { popup.remove(); } catch {}
    }, duration);
  };

  // Close point info popup with animation
  const closePointPopup = () => {
    const popup = pointPopupRef.current;
    const root = pointPopupRootRef.current;
    const wrapper = pointPopupWrapperRef.current;

    // Clear refs immediately so a new popup can be created
    pointPopupRef.current = null;
    pointPopupRootRef.current = null;
    pointPopupWrapperRef.current = null;

    // Clean up map click listener
    if (pointPopupCleanupRef.current) {
      pointPopupCleanupRef.current();
      pointPopupCleanupRef.current = null;
    }

    animatedClose(popup, root, wrapper);
  };

  // Close add-point popup with animation
  const closeAddPointPopup = () => {
    const popup = popupRef.current;
    const root = popupRootRef.current;
    const wrapper = addPointPopupWrapperRef.current;

    popupRef.current = null;
    popupRootRef.current = null;
    addPointPopupWrapperRef.current = null;

    animatedClose(popup, root, wrapper);
  };

  // Open point info popup anchored to a marker
  const openPointPopup = (point: Point | FriendPoint, isMine: boolean) => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    // Close any existing popups
    closePointPopup();
    closeAddPointPopup();

    // Create wrapper with animation class
    const wrapper = document.createElement('div');
    wrapper.className = 'mp-popup-anim';

    // Custom close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'mp-popup-close-btn';
    closeBtn.innerHTML = '\u00d7';
    closeBtn.onclick = () => closePointPopup();
    wrapper.appendChild(closeBtn);

    // React mount target
    const container = document.createElement('div');
    wrapper.appendChild(container);

    const popup = new mapboxgl.Popup({
      closeOnClick: false,
      closeButton: false,
      offset: 14,
      className: 'point-info-popup',
      maxWidth: 'none',
    })
      .setLngLat([point.lng, point.lat])
      .setDOMContent(wrapper)
      .addTo(map);

    pointPopupRef.current = popup;
    pointPopupWrapperRef.current = wrapper;

    // Close on map background click
    const onMapClick = () => closePointPopup();
    map.on('click', onMapClick);
    pointPopupCleanupRef.current = () => map.off('click', onMapClick);

    const root = createRoot(container);
    pointPopupRootRef.current = root;

    const renderCard = (p: Point | FriendPoint, mine: boolean) => {
      const selectedPoint = mine
        ? { ...(p as Point), isMine: true as const }
        : { ...(p as FriendPoint), isMine: false as const };

      root.render(
        <PointInfoPopupCard
          point={selectedPoint}
          onClose={() => closePointPopup()}
          onPointDeleted={(id) => {
            setMyPoints(prev => prev.filter(pt => pt.id !== id));
            closePointPopup();
          }}
          onPointUpdated={(updated) => {
            setMyPoints(prev => prev.map(pt => pt.id === updated.id ? updated : pt));
            renderCard(updated, true);
          }}
          showSuccess={success}
          showError={showError}
        />
      );
    };

    renderCard(point, isMine);

    // Trigger open animation + auto-pan after layout
    requestAnimationFrame(() => {
      wrapper.classList.add('mp-popup-anim--open');
      requestAnimationFrame(() => {
        if (popup && map) {
          fitPopupAndKeepMarkerVisible(map, popup, [point.lng, point.lat]);
        }
      });
    });
  };

  // Debounced marker click: delays popup open to distinguish from double-click
  const handleMarkerClick = (point: Point | FriendPoint, isMine: boolean, e: React.MouseEvent) => {
    e.stopPropagation();

    if (markerClickTimerRef.current) {
      clearTimeout(markerClickTimerRef.current);
    }

    markerClickTimerRef.current = setTimeout(() => {
      markerClickTimerRef.current = null;
      openPointPopup(point, isMine);
    }, 250);
  };

  // Handle double-click on marker: deep zoom only (no popup)
  const handleMarkerDblClick = (point: Point | FriendPoint, _isMine: boolean, e: React.MouseEvent) => {
    e.stopPropagation();

    // Cancel any pending single-click popup
    if (markerClickTimerRef.current) {
      clearTimeout(markerClickTimerRef.current);
      markerClickTimerRef.current = null;
    }

    const map = mapRef.current?.getMap();
    if (!map) return;

    map.easeTo({
      center: [point.lng, point.lat],
      zoom: getDeepZoom(map),
      duration: 700,
      essential: true,
    });
  };

  const handleContextMenu = (event: mapboxgl.MapMouseEvent) => {
    // Only on desktop (pointer: fine) use right-click
    if (!isDesktop()) return;

    event.preventDefault();

    const { lngLat, point } = event;
    const map = mapRef.current?.getMap();
    if (!map) return;

    // Close existing popups
    closePointPopup();
    closeAddPointPopup();

    // Smart anchor: pick side with most free space
    const container = map.getContainer();
    const w = container.clientWidth;
    const h = container.clientHeight;
    const nearTop = point.y < h * 0.35;
    const nearBottom = point.y > h * 0.65;
    const nearLeft = point.x < w * 0.35;
    const nearRight = point.x > w * 0.65;

    let anchor: mapboxgl.Anchor = 'bottom';
    if (nearTop && nearLeft) anchor = 'top-left';
    else if (nearTop && nearRight) anchor = 'top-right';
    else if (nearTop) anchor = 'top';
    else if (nearBottom && nearLeft) anchor = 'bottom-left';
    else if (nearBottom && nearRight) anchor = 'bottom-right';
    else if (nearBottom) anchor = 'bottom';
    else if (nearLeft) anchor = 'left';
    else if (nearRight) anchor = 'right';

    // Create wrapper with animation class
    const wrapper = document.createElement('div');
    wrapper.className = 'mp-popup-anim';

    // Custom close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'mp-popup-close-btn';
    closeBtn.innerHTML = '\u00d7';
    closeBtn.onclick = () => closeAddPointPopup();
    wrapper.appendChild(closeBtn);

    // React mount target
    const popupContainer = document.createElement('div');
    wrapper.appendChild(popupContainer);

    // Create popup
    const popup = new mapboxgl.Popup({
      closeOnClick: false,
      closeButton: false,
      offset: 14,
      anchor,
      className: 'add-point-popup',
      maxWidth: 'none',
    })
      .setLngLat([lngLat.lng, lngLat.lat])
      .setDOMContent(wrapper)
      .addTo(map);

    popupRef.current = popup;
    addPointPopupWrapperRef.current = wrapper;

    // Trigger open animation + auto-pan after layout
    requestAnimationFrame(() => {
      wrapper.classList.add('mp-popup-anim--open');
      requestAnimationFrame(() => {
        fitPopupAndKeepMarkerVisible(map, popup, [lngLat.lng, lngLat.lat]);
      });
    });

    // Mount React component into popup
    const root = createRoot(popupContainer);
    popupRootRef.current = root;

    const handleSuccess = (point: Point) => {
      setMyPoints([point, ...myPoints]);
      success('Point created successfully!');
      closeAddPointPopup();
    };

    const handleCancel = () => {
      closeAddPointPopup();
    };

    // Track last flyTo target to prevent duplicate flights
    let lastFlyToKey = '';

    const handleCoordsChange = (newLng: number, newLat: number) => {
      const flyToKey = `${newLng.toFixed(6)},${newLat.toFixed(6)}`;
      if (flyToKey === lastFlyToKey) return;
      lastFlyToKey = flyToKey;

      const currentMap = mapRef.current?.getMap();
      const currentPopup = popupRef.current;

      if (currentPopup) {
        currentPopup.setLngLat([newLng, newLat]);
      }

      // Show ghost pin at the new location
      if (currentMap) {
        // Clean up previous ghost pin
        if (ghostMarkerRef.current) {
          ghostMarkerRef.current.remove();
          ghostMarkerRef.current = null;
        }
        if (ghostTimerRef.current) {
          clearTimeout(ghostTimerRef.current);
          ghostTimerRef.current = null;
        }

        const ghostEl = document.createElement('div');
        ghostEl.className = 'mp-ghost-pin';
        const ghostMarker = new mapboxgl.Marker({ element: ghostEl, anchor: 'center' })
          .setLngLat([newLng, newLat])
          .addTo(currentMap);
        ghostMarkerRef.current = ghostMarker;

        ghostTimerRef.current = setTimeout(() => {
          if (ghostMarkerRef.current === ghostMarker) {
            ghostMarker.remove();
            ghostMarkerRef.current = null;
          }
          ghostTimerRef.current = null;
        }, 600);

        currentMap.flyTo({
          center: [newLng, newLat],
          zoom: getDeepZoom(currentMap),
          duration: 700,
          essential: true,
        });

        // After flyTo completes, re-anchor popup and fit into viewport once
        const onMoveEnd = () => {
          currentMap.off('moveend', onMoveEnd);
          if (currentPopup) {
            currentPopup.setLngLat([newLng, newLat]);
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                if (currentPopup && currentMap) {
                  fitPopupAndKeepMarkerVisible(currentMap, currentPopup, [newLng, newLat]);
                }
              });
            });
          }
        };
        currentMap.on('moveend', onMoveEnd);
      }
    };

    root.render(
      <AddPointPopupForm
        lat={lngLat.lat}
        lng={lngLat.lng}
        trips={trips}
        tripsLoading={tripsLoading}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
        onError={showError}
        trackEvent={trackEvent}
        markOnboardingComplete={markOnboardingComplete}
        onCoordsChange={handleCoordsChange}
      />
    );

  };

  // Mobile fallback: left-click to show old-style modal
  const handleMapClick = (event: any) => {
    // Only on mobile (pointer: coarse) use left-click
    if (isDesktop()) return;

    const { lngLat } = event;
    setClickedCoords({ lat: lngLat.lat, lng: lngLat.lng });
    setTitle("");
    setDescription("");
    setSelectedTripId(null);
    setCategory('PLACE');
    setSaveError("");
    setSelectedFile(null);
    setPreviewUrl(null);
    setFileValidationError("");
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
          category,
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

      // Track point creation
      trackEvent('create_point', {
        has_photo: !!photoUrl,
        has_trip: !!selectedTripId
      });

      // If trip selected, attach point to trip
      if (selectedTripId) {
        try {
          const tripResponse = await fetch(`/api/trips/${selectedTripId}/points`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...getAuthHeaders(),
            },
            body: JSON.stringify({
              pointId: data.point.id,
            }),
          });

          if (!tripResponse.ok) {
            // Point created but trip attach failed
            showError("Point created, but could not be added to trip");
          } else {
            const tripData = await tripResponse.json();
            // Both succeeded
            success("Point created and added to trip!");

            // Track point attachment to trip
            trackEvent('attach_point_to_trip', {
              trip_visibility: tripData.trip?.visibility || 'unknown'
            });
          }
        } catch (tripErr) {
          // Point created but trip attach failed
          showError("Point created, but could not be added to trip");
        }
      } else {
        // No trip selected
        success("Point created successfully!");
      }

      // Mark onboarding complete
      markOnboardingComplete();

      // Close modal
      setClickedCoords(null);
      setTitle("");
      setDescription("");
      setSelectedTripId(null);
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
    setSelectedTripId(null);
    setSaveError("");
    setSelectedFile(null);
    setPreviewUrl(null);
    setFileValidationError("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    // Clear previous errors
    setFileValidationError("");

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setFileValidationError("File size exceeds 20MB limit");
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

  const handleFriendClick = (friendId: string) => {
    setSelectedFriendId(friendId);
    setShowFriendsPoints(true);
    setShowMyPoints(false);
  };

  const handleRefreshFriends = () => {
    fetchAllData();
    fetchIncomingRequests();
  };

  // Compute visible points based on filters + trip filter
  let visibleMyPoints = showMyPoints ? myPoints : [];
  let visibleFriendPoints = showFriendsPoints
    ? selectedFriendId === "all"
      ? friendPoints
      : friendPoints.filter((p) => p.userId === selectedFriendId)
    : [];

  // Apply trip filter on top of existing filters
  if (activeTripId) {
    visibleMyPoints = visibleMyPoints.filter((p) => activeTripPointIds.has(p.id));
    visibleFriendPoints = visibleFriendPoints.filter((p) => activeTripPointIds.has(p.id));
  }

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
    <div className="h-full w-full relative flex flex-col">
      {/* Mapstr-style top bar */}
      <div className="relative z-30 bg-white border-b border-gray-200 shadow-sm px-4 py-2 flex items-center justify-between">
        {/* Left: hamburger */}
        <button
          onClick={() => {
            setShowMapDrawer(true);
            setShowTripsDrawer(false);
            setShowFriendsDrawer(false);
            setMode('map');
          }}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Menu"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Center: segmented toggle */}
        <div className="flex bg-gray-100 rounded-full p-1">
          <button
            onClick={() => {
              setMode('map');
              setShowTripsDrawer(false);
            }}
            className={`px-5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              mode === 'map'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Map
          </button>
          <button
            onClick={() => {
              setMode('trips');
              setShowTripsDrawer(true);
              setShowFriendsDrawer(false);
              setShowMapDrawer(false);
            }}
            className={`px-5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              mode === 'trips'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Trips
          </button>
        </div>

        {/* Right: friends icon */}
        <button
          onClick={() => {
            setShowFriendsDrawer(true);
            setShowTripsDrawer(false);
            setShowMapDrawer(false);
            setMode('map');
          }}
          className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Friends"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          {incomingRequests.length > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {incomingRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* Map area */}
      <div className="flex-1 relative">
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
          <p className="text-lg text-gray-700 mb-2">
            {shouldShowOnboarding ? "Welcome to your map!" : "No points yet"}
          </p>
          <p className="text-sm text-gray-500">
            {shouldShowOnboarding
              ? "Click anywhere on the map to add a place. You can attach it to a trip while creating the point."
              : "Click on the map to add your first point"}
          </p>
        </div>
      )}

      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onClick={handleMapClick}
        onLoad={() => {
          const map = mapRef.current?.getMap();
          if (map) {
            map.on('contextmenu', handleContextMenu);
          }
        }}
        mapboxAccessToken={mapboxToken}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
      >
        <NavigationControl position="top-right" />

        {/* Gear / Profile button */}
        <div className="absolute bottom-4 left-4 z-10">
          <button
            onClick={() => setShowProfileModal(true)}
            className="bg-white hover:bg-gray-100 text-gray-700 rounded-full p-3 shadow-lg transition-colors"
            title="Profile & Settings"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

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
              className={`${getCategoryColor(point.category)} rounded-full w-9 h-9 flex items-center justify-center text-white text-lg shadow-lg cursor-pointer hover:scale-110 transition-transform ring-2 ring-white`}
              title={point.title}
              onClick={(e) => handleMarkerClick(point, true, e)}
              onDoubleClick={(e) => handleMarkerDblClick(point, true, e)}
            >
              {getCategoryEmoji(point.category)}
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
              className={`${getCategoryColor(point.category)} rounded-full w-9 h-9 flex items-center justify-center text-white text-lg shadow-lg cursor-pointer hover:scale-110 transition-transform ring-2 ring-white opacity-80`}
              title={`${point.title} (by ${point.userEmail})`}
              onClick={(e) => handleMarkerClick(point, false, e)}
              onDoubleClick={(e) => handleMarkerDblClick(point, false, e)}
            >
              {getCategoryEmoji(point.category)}
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
            <div className="bg-red-600 rounded-full w-9 h-9 flex items-center justify-center text-white text-lg shadow-lg ring-2 ring-white animate-pulse">
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
                className="w-full px-4 py-3 h-12 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Trip (optional)
              </label>
              {tripsLoading ? (
                <p className="text-sm text-gray-500">Loading trips...</p>
              ) : trips.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Create a trip first in <a href="/trips" className="text-blue-600 hover:underline">/trips</a>
                </p>
              ) : (
                <select
                  value={selectedTripId || ""}
                  onChange={(e) => setSelectedTripId(e.target.value || null)}
                  disabled={saving || uploading}
                  className="w-full px-4 py-3 h-12 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                >
                  <option value="">None</option>
                  {trips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as 'PLACE' | 'FOOD' | 'STAY' | 'ACTIVITY' | 'OTHER')}
                disabled={saving || uploading}
                className="w-full px-4 py-3 h-12 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              >
                <option value="PLACE">📍 Interesting place</option>
                <option value="FOOD">🍜 Food</option>
                <option value="STAY">🏨 Stay</option>
                <option value="ACTIVITY">🎟️ Activity</option>
                <option value="OTHER">✨ Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Photo (optional)
              </label>

              <label className="block">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  disabled={saving || uploading}
                  className="hidden"
                />
                <div className="w-full px-4 py-3 h-12 border border-gray-300 rounded-xl text-gray-700 bg-white hover:bg-gray-50 cursor-pointer flex items-center justify-center font-medium transition-colors shadow-sm">
                  {selectedFile ? selectedFile.name : '📷 Upload photo'}
                </div>
              </label>

              <p className="mt-1 text-xs text-gray-500">
                Only JPG, PNG, WEBP up to 20MB
              </p>

              {fileValidationError && (
                <div className="mt-2 bg-red-50 p-2 rounded-xl">
                  <p className="text-sm text-red-600">{fileValidationError}</p>
                </div>
              )}

              {previewUrl && (
                <div className="mt-3 relative">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-32 object-cover rounded-xl shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    disabled={saving || uploading}
                    className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-red-700 disabled:bg-red-400 shadow-lg"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSavePoint}
                disabled={saving || uploading || !title.trim()}
                className="flex-1 bg-slate-900 text-white px-4 py-3 h-12 rounded-xl hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed font-medium shadow-sm transition-colors"
              >
                {uploading ? "Uploading..." : saving ? "Saving..." : "Save Point"}
              </button>
              <button
                onClick={handleCancelPoint}
                disabled={saving || uploading}
                className="flex-1 bg-white text-gray-700 px-4 py-3 h-12 rounded-xl border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed font-medium shadow-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Friends Drawer */}
      <FriendsDrawer
        isOpen={showFriendsDrawer}
        onClose={() => setShowFriendsDrawer(false)}
        friends={friends}
        incomingRequests={incomingRequests}
        onFriendClick={handleFriendClick}
        onRefreshFriends={handleRefreshFriends}
      />

      {/* Left hamburger drawer (filters + points list) */}
      <MapDrawer
        isOpen={showMapDrawer}
        onClose={() => setShowMapDrawer(false)}
        showMyPoints={showMyPoints}
        setShowMyPoints={setShowMyPoints}
        showFriendsPoints={showFriendsPoints}
        setShowFriendsPoints={setShowFriendsPoints}
        selectedFriendId={selectedFriendId}
        setSelectedFriendId={setSelectedFriendId}
        friends={friends}
        myPointsCount={myPoints.length}
        friendPointsCount={friendPoints.length}
        myPoints={myPoints}
        onPointClick={(point) => {
          setViewState({ longitude: point.lng, latitude: point.lat, zoom: 14 });
          setTimeout(() => openPointPopup({ ...point, address: point.address || null }, true), 300);
        }}
      />

      {/* Trips drawer (left, opened by Trips mode) */}
      <TripsDrawer
        isOpen={showTripsDrawer}
        onClose={() => {
          setShowTripsDrawer(false);
          setMode('map');
        }}
        trips={trips}
        tripsLoading={tripsLoading}
        activeTripId={activeTripId}
        onTripSelect={(tripId) => {
          setActiveTripId(tripId);
        }}
        onClearFilter={() => {
          setActiveTripId(null);
        }}
        onTripsChanged={fetchTrips}
      />

      {/* Profile modal */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
      </div>{/* end flex-1 map area */}
    </div>
  );
}
