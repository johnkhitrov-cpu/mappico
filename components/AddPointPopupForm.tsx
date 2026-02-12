'use client';

import { useState, useEffect, FormEvent, useRef } from 'react';
import { getAuthHeaders } from '@/lib/clientAuth';

interface Trip {
  id: string;
  title: string;
}

interface AddPointPopupFormProps {
  lat: number;
  lng: number;
  trips: Trip[];
  tripsLoading: boolean;
  onSuccess: (point: any) => void;
  onCancel: () => void;
  onError: (message: string) => void;
  trackEvent: (name: any, properties: any) => void;
  markOnboardingComplete: () => void;
  onCoordsChange?: (lng: number, lat: number) => void;
}

interface AddressSuggestion {
  name: string;
  coordinates: [number, number]; // [lng, lat]
}

export default function AddPointPopupForm({
  lat,
  lng,
  trips,
  tripsLoading,
  onSuccess,
  onCancel,
  onError,
  trackEvent,
  markOnboardingComplete,
  onCoordsChange,
}: AddPointPopupFormProps) {
  const [coords, setCoords] = useState({ lat, lng });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [category, setCategory] = useState<'PLACE' | 'FOOD' | 'STAY' | 'ACTIVITY' | 'OTHER'>('PLACE');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileValidationError, setFileValidationError] = useState('');

  // Address autocomplete state
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const addressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const userEditedAddressRef = useRef(false);
  const suppressSuggestionsRef = useRef(false);

  // Reverse geocode on mount to prefill address
  useEffect(() => {
    const reverseGeocode = async () => {
      setLoadingAddress(true);
      try {
        const response = await fetch(`/api/reverse-geocode?lng=${lng}&lat=${lat}`);
        if (response.ok) {
          const data = await response.json();
          if (data.address && !userEditedAddressRef.current) {
            setAddress(data.address);
          }
        }
      } catch (err) {
        console.error('Reverse geocode error:', err);
      } finally {
        setLoadingAddress(false);
      }
    };

    reverseGeocode();
  }, [lat, lng]);

  // Debounced address autocomplete — only when user is actively typing
  useEffect(() => {
    if (addressTimeoutRef.current) {
      clearTimeout(addressTimeoutRef.current);
    }

    // Skip if suggestions are suppressed (after a selection)
    if (suppressSuggestionsRef.current) {
      return;
    }

    if (address.trim().length < 3) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    addressTimeoutRef.current = setTimeout(async () => {
      if (suppressSuggestionsRef.current) return;
      try {
        const response = await fetch(`/api/geocode?query=${encodeURIComponent(address)}`);
        if (response.ok) {
          const data = await response.json();
          if (!suppressSuggestionsRef.current) {
            setAddressSuggestions(data.suggestions || []);
            setShowSuggestions(true);
          }
        }
      } catch (err) {
        console.error('Geocode error:', err);
      }
    }, 400);

    return () => {
      if (addressTimeoutRef.current) {
        clearTimeout(addressTimeoutRef.current);
      }
    };
  }, [address]);

  const handleAddressSelect = (suggestion: AddressSuggestion) => {
    suppressSuggestionsRef.current = true;
    setAddress(suggestion.name);
    setCoords({ lng: suggestion.coordinates[0], lat: suggestion.coordinates[1] });
    setShowSuggestions(false);
    setAddressSuggestions([]);
    userEditedAddressRef.current = true;
    addressInputRef.current?.blur();
    onCoordsChange?.(suggestion.coordinates[0], suggestion.coordinates[1]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_FILE_SIZE = 20 * 1024 * 1024;
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    setFileValidationError('');

    if (file.size > MAX_FILE_SIZE) {
      setFileValidationError('File size exceeds 20MB limit');
      e.target.value = '';
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setFileValidationError('Only JPG, PNG, and WEBP images are allowed');
      e.target.value = '';
      return;
    }

    const fileName = file.name.toLowerCase();
    const hasValidExtension = ['jpg', 'jpeg', 'png', 'webp'].some(ext =>
      fileName.endsWith(`.${ext}`)
    );

    if (!hasValidExtension) {
      setFileValidationError('Only JPG, PNG, and WEBP images are allowed');
      e.target.value = '';
      return;
    }

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
    setFileValidationError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      onError('Title is required');
      return;
    }

    setSaving(true);

    try {
      let photoUrl: string | undefined;

      // Upload photo if selected
      if (selectedFile) {
        setUploading(true);
        try {
          const formData = new FormData();
          formData.append('file', selectedFile);
          formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);
          formData.append('folder', 'mappico');

          const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
          const uploadResponse = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
            {
              method: 'POST',
              body: formData,
            }
          );

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(errorData.error?.message || 'Failed to upload image');
          }

          const uploadData = await uploadResponse.json();
          photoUrl = uploadData.secure_url;
        } catch (uploadErr) {
          const errorMsg = uploadErr instanceof Error
            ? `Upload failed: ${uploadErr.message}`
            : 'Failed to upload image';
          onError(errorMsg);
          throw new Error(errorMsg);
        } finally {
          setUploading(false);
        }
      }

      // Create point
      const response = await fetch('/api/points', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          lat: coords.lat,
          lng: coords.lng,
          title,
          description: description || undefined,
          address: address || undefined,
          photoUrl,
          category,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          onError('Too many requests. Please try again later.');
        } else {
          onError(data.error || 'Failed to save point');
        }
        throw new Error(data.error || 'Failed to save point');
      }

      // Track point creation
      trackEvent('create_point', {
        has_photo: !!photoUrl,
        has_trip: !!selectedTripId,
      });

      // If trip selected, attach point to trip
      if (selectedTripId) {
        try {
          const tripResponse = await fetch(`/api/trips/${selectedTripId}/points`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
            body: JSON.stringify({
              pointId: data.point.id,
            }),
          });

          if (tripResponse.ok) {
            const tripData = await tripResponse.json();
            trackEvent('attach_point_to_trip', {
              trip_visibility: tripData.trip?.visibility || 'unknown',
            });
          }
        } catch (tripErr) {
          console.error('Failed to attach to trip:', tripErr);
        }
      }

      // Mark onboarding complete
      markOnboardingComplete();

      // Call success callback
      onSuccess(data.point);
    } catch (err) {
      console.error('Save point error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col w-[360px] max-w-[calc(100vw-24px)] max-h-[70vh]"
    >
      {/* Header */}
      <div className="shrink-0 pb-2 border-b border-gray-100">
        <h3 className="text-base font-bold text-gray-900">Add Point</h3>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto py-2 pr-1 space-y-2.5">
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
            disabled={saving || uploading}
            className="w-full px-3 py-2 h-10 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
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
            disabled={saving || uploading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>

        {/* Address field with autocomplete */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address {loadingAddress && <span className="text-xs text-gray-400">(loading...)</span>}
          </label>
          <input
            ref={addressInputRef}
            type="text"
            value={address}
            onChange={(e) => {
              suppressSuggestionsRef.current = false;
              userEditedAddressRef.current = true;
              setAddress(e.target.value);
            }}
            onFocus={() => {
              if (!suppressSuggestionsRef.current && addressSuggestions.length > 0 && address.trim().length >= 3) {
                setShowSuggestions(true);
              }
            }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="Address (optional)"
            maxLength={500}
            disabled={saving || uploading}
            className="w-full px-3 py-2 h-10 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />

          {/* Autocomplete suggestions dropdown */}
          {showSuggestions && addressSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {addressSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleAddressSelect(suggestion)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700 border-b border-gray-100 last:border-b-0"
                >
                  {suggestion.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Trip (optional)
          </label>
          {tripsLoading ? (
            <p className="text-sm text-gray-500">Loading trips...</p>
          ) : trips.length === 0 ? (
            <p className="text-sm text-gray-500">No trips available</p>
          ) : (
            <select
              value={selectedTripId || ''}
              onChange={(e) => setSelectedTripId(e.target.value || null)}
              disabled={saving || uploading}
              className="w-full px-3 py-2 h-10 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
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
            onChange={(e) => setCategory(e.target.value as any)}
            disabled={saving || uploading}
            className="w-full px-3 py-2 h-10 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
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
            <div className="w-full px-3 py-2 h-10 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50 cursor-pointer flex items-center justify-center font-medium transition-colors shadow-sm">
              {selectedFile ? selectedFile.name : '📷 Upload photo'}
            </div>
          </label>

          <p className="mt-1 text-xs text-gray-500">
            Only JPG, PNG, WEBP up to 20MB
          </p>

          {fileValidationError && (
            <div className="mt-2 bg-red-50 p-2 rounded-lg">
              <p className="text-sm text-red-600">{fileValidationError}</p>
            </div>
          )}

          {previewUrl && (
            <div className="mt-3 relative">
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-28 object-cover rounded-lg shadow-sm"
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
      </div>

      {/* Footer */}
      <div className="shrink-0 pt-2 border-t border-gray-100">
        <div className="flex gap-2.5">
          <button
            type="submit"
            disabled={saving || uploading || !title.trim()}
            className="flex-1 min-w-0 bg-slate-900 text-white px-3 py-2 h-10 rounded-lg text-sm hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed font-medium shadow-sm transition-colors"
          >
            {uploading ? 'Uploading...' : saving ? 'Saving...' : 'Save Point'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving || uploading}
            className="flex-1 min-w-0 bg-white text-gray-700 px-3 py-2 h-10 rounded-lg text-sm border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed font-medium shadow-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
