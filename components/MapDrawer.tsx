'use client';

import { useEffect } from 'react';

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

interface Friend {
  id: string;
  email: string;
}

interface MapDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  // Filters
  showMyPoints: boolean;
  setShowMyPoints: (v: boolean) => void;
  showFriendsPoints: boolean;
  setShowFriendsPoints: (v: boolean) => void;
  selectedFriendId: string;
  setSelectedFriendId: (v: string) => void;
  friends: Friend[];
  myPointsCount: number;
  friendPointsCount: number;
  // Points list
  myPoints: Point[];
  onPointClick: (point: Point) => void;
}

function getCategoryEmoji(category: string | undefined): string {
  switch (category) {
    case 'PLACE': return '📍';
    case 'FOOD': return '🍜';
    case 'STAY': return '🏨';
    case 'ACTIVITY': return '🎟️';
    case 'OTHER': return '✨';
    default: return '📍';
  }
}

export default function MapDrawer({
  isOpen,
  onClose,
  showMyPoints,
  setShowMyPoints,
  showFriendsPoints,
  setShowFriendsPoints,
  selectedFriendId,
  setSelectedFriendId,
  friends,
  myPointsCount,
  friendPointsCount,
  myPoints,
  onPointClick,
}: MapDrawerProps) {
  // Close on ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

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
          <h2 className="text-lg font-bold text-gray-900">My map</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Filters section */}
        <div className="p-4 border-b border-gray-200 space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filters</h3>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showMyPoints}
              onChange={(e) => setShowMyPoints(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Show my points</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showFriendsPoints}
              onChange={(e) => setShowFriendsPoints(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Show friends points</span>
          </label>

          {showFriendsPoints && friends.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Friend</label>
              <select
                value={selectedFriendId}
                onChange={(e) => setSelectedFriendId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All friends</option>
                {friends.map((friend) => (
                  <option key={friend.id} value={friend.id}>{friend.email}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-4 text-xs text-gray-500">
            <span>My: <span className="font-medium">{myPointsCount}</span></span>
            <span>Friends: <span className="font-medium">{friendPointsCount}</span></span>
          </div>
        </div>

        {/* My Points list */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              My Points ({myPoints.length})
            </h3>

            {myPoints.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                No points yet. Tap the map to add one!
              </p>
            ) : (
              <div className="space-y-1">
                {myPoints.map((point) => (
                  <button
                    key={point.id}
                    onClick={() => {
                      onPointClick(point);
                      onClose();
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3"
                  >
                    <span className="text-base flex-shrink-0">{getCategoryEmoji(point.category)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{point.title}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(point.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
