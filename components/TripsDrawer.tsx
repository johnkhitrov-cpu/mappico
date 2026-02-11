'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { getAuthHeaders } from '@/lib/clientAuth';
import { useGlobalToast } from './ClientLayout';

interface Trip {
  id: string;
  title: string;
  description: string | null;
  visibility: string;
  createdAt: string;
  updatedAt: string;
}

interface TripsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  trips: Trip[];
  tripsLoading: boolean;
  activeTripId: string | null;
  onTripSelect: (tripId: string) => void;
  onClearFilter: () => void;
  onTripsChanged: () => void;
}

const AVATAR_COLORS = [
  'bg-emerald-600',
  'bg-indigo-600',
  'bg-orange-500',
  'bg-purple-600',
  'bg-slate-700',
  'bg-rose-600',
  'bg-cyan-600',
  'bg-amber-600',
];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function TripsDrawer({
  isOpen,
  onClose,
  trips,
  tripsLoading,
  activeTripId,
  onTripSelect,
  onClearFilter,
  onTripsChanged,
}: TripsDrawerProps) {
  const { success, error: showError } = useGlobalToast();

  // Create trip form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'PRIVATE' | 'FRIENDS' | 'UNLISTED'>('PRIVATE');
  const [creating, setCreating] = useState(false);

  // Menu state
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Edit state
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVisibility, setEditVisibility] = useState<'PRIVATE' | 'FRIENDS' | 'UNLISTED'>('PRIVATE');
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleting, setDeleting] = useState(false);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpenId) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpenId]);

  // Close on ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (menuOpenId) {
          setMenuOpenId(null);
        } else if (editingTripId) {
          setEditingTripId(null);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose, menuOpenId, editingTripId]);

  const handleCreateTrip = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const response = await fetch('/api/trips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
          showError('Too many requests. Please try again later.');
        } else {
          showError(data.error || 'Failed to create trip');
        }
        throw new Error(data.error);
      }

      success('Trip created!');
      setTitle('');
      setDescription('');
      setVisibility('PRIVATE');
      setShowCreateForm(false);
      onTripsChanged();
      onTripSelect(data.trip.id);
    } catch (err) {
      console.error('Create trip error:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleStartEdit = (trip: Trip) => {
    setMenuOpenId(null);
    setEditingTripId(trip.id);
    setEditTitle(trip.title);
    setEditDescription(trip.description || '');
    setEditVisibility(trip.visibility as 'PRIVATE' | 'FRIENDS' | 'UNLISTED');
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingTripId) return;
    setSaving(true);

    try {
      const response = await fetch(`/api/trips/${editingTripId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription || null,
          visibility: editVisibility,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        showError(data.error || 'Failed to update trip');
        throw new Error(data.error);
      }

      success('Trip updated!');
      setEditingTripId(null);
      onTripsChanged();
    } catch (err) {
      console.error('Update trip error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    setMenuOpenId(null);

    if (!confirm('Are you sure you want to delete this trip? This cannot be undone.')) {
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const data = await response.json();
        showError(data.error || 'Failed to delete trip');
        throw new Error(data.error);
      }

      success('Trip deleted!');

      if (activeTripId === tripId) {
        onClearFilter();
      }

      onTripsChanged();
    } catch (err) {
      console.error('Delete trip error:', err);
    } finally {
      setDeleting(false);
    }
  };

  function getVisibilityPill(v: string) {
    switch (v) {
      case 'FRIENDS':
        return { label: 'Friends', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'UNLISTED':
        return { label: 'Link', className: 'bg-amber-100 text-amber-800 border-amber-200' };
      default:
        return { label: 'Private', className: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  }

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      {/* Drawer — slides from LEFT */}
      <div className={`fixed top-0 left-0 h-full w-full md:w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } flex flex-col`}>

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-gray-900">Trips</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Clear filter */}
        {activeTripId && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
            <button
              onClick={onClearFilter}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Show all points
            </button>
          </div>
        )}

        {/* My Trips list */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              My Trips ({trips.length})
            </h3>

            {tripsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse p-3 bg-gray-100 rounded-lg">
                    <div className="h-4 bg-gray-300 rounded w-2/3 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                  </div>
                ))}
              </div>
            ) : trips.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                No trips yet. Create one below!
              </p>
            ) : (
              <div className="space-y-1">
                {trips.map((trip) => (
                  <div key={trip.id}>
                    {/* Inline edit form */}
                    {editingTripId === trip.id ? (
                      <form
                        onSubmit={handleSaveEdit}
                        className="p-3 rounded-lg border border-blue-200 bg-blue-50 space-y-2"
                      >
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          required
                          maxLength={120}
                          disabled={saving}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          maxLength={1000}
                          rows={2}
                          disabled={saving}
                          placeholder="Description (optional)"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <select
                          value={editVisibility}
                          onChange={(e) => setEditVisibility(e.target.value as 'PRIVATE' | 'FRIENDS' | 'UNLISTED')}
                          disabled={saving}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="PRIVATE">Private</option>
                          <option value="FRIENDS">Friends</option>
                          <option value="UNLISTED">Anyone with link</option>
                        </select>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={saving || !editTitle.trim()}
                            className="flex-1 bg-blue-600 text-white px-2 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400"
                          >
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTripId(null)}
                            disabled={saving}
                            className="flex-1 bg-white text-gray-700 px-2 py-1.5 rounded border border-gray-300 text-sm font-medium hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      /* Trip row with ⋯ menu */
                      <div className="relative">
                        <div
                          onClick={() => onTripSelect(trip.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors cursor-pointer flex items-center gap-3 ${
                            activeTripId === trip.id
                              ? 'bg-blue-50 border border-blue-200'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {/* Avatar */}
                          <div className={`h-10 w-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold text-sm ${getAvatarColor(trip.id)}`}>
                            {trip.title.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className={`text-sm font-medium truncate ${
                                activeTripId === trip.id ? 'text-blue-900' : 'text-gray-900'
                              }`}>
                                {trip.title}
                              </p>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ml-2 flex-shrink-0 ${getVisibilityPill(trip.visibility).className}`}>
                                {getVisibilityPill(trip.visibility).label}
                              </span>
                            </div>
                            {trip.description && (
                              <p className="text-xs text-gray-500 truncate mt-0.5">
                                {trip.description}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 mt-0.5">
                              Updated {new Date(trip.updatedAt).toLocaleDateString()}
                            </p>
                          </div>

                          {/* ⋯ button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(menuOpenId === trip.id ? null : trip.id);
                            }}
                            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <circle cx="4" cy="10" r="1.5" />
                              <circle cx="10" cy="10" r="1.5" />
                              <circle cx="16" cy="10" r="1.5" />
                            </svg>
                          </button>
                        </div>

                        {/* Dropdown menu */}
                        {menuOpenId === trip.id && (
                          <div
                            ref={menuRef}
                            className="absolute right-2 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[120px]"
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(trip);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              Edit trip
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTrip(trip.id);
                              }}
                              disabled={deleting}
                              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              Delete trip
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Create Trip section */}
        <div className="border-t border-gray-200 p-4">
          {showCreateForm ? (
            <form onSubmit={handleCreateTrip} className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                New Trip
              </h3>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Trip title *"
                required
                maxLength={120}
                disabled={creating}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                maxLength={1000}
                rows={2}
                disabled={creating}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as 'PRIVATE' | 'FRIENDS' | 'UNLISTED')}
                disabled={creating}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="PRIVATE">Private</option>
                <option value="FRIENDS">Friends</option>
                <option value="UNLISTED">Anyone with link</option>
              </select>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creating || !title.trim()}
                  className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-400 font-medium text-sm"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setTitle('');
                    setDescription('');
                    setVisibility('PRIVATE');
                  }}
                  disabled={creating}
                  className="flex-1 bg-white text-gray-700 px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-50 font-medium text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full bg-gray-900 text-white py-2.5 rounded-xl font-medium text-sm hover:bg-gray-800 transition-colors"
            >
              + Create Trip
            </button>
          )}
        </div>
      </div>
    </>
  );
}
