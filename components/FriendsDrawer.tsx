'use client';

import { useState, FormEvent } from 'react';
import { getAuthHeaders } from '@/lib/clientAuth';
import { useGlobalToast } from './ClientLayout';

interface Friend {
  id: string;
  email: string;
}

interface IncomingRequest {
  id: string;
  fromUserId: string;
  fromUserEmail: string;
  createdAt: string;
}

interface FriendsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  friends: Friend[];
  incomingRequests: IncomingRequest[];
  onFriendClick: (friendId: string) => void;
  onRefreshFriends: () => void;
}

export default function FriendsDrawer({
  isOpen,
  onClose,
  friends,
  incomingRequests,
  onFriendClick,
  onRefreshFriends
}: FriendsDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [acceptingIds, setAcceptingIds] = useState<string[]>([]);
  const { success, error: showError } = useGlobalToast();

  // Filter friends by search
  const filteredFriends = friends.filter(f =>
    f.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle add friend
  const handleSendRequest = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);

    try {
      const response = await fetch("/api/friends/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ toEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send request");
      }

      success("Friend request sent!");
      setToEmail("");
      onRefreshFriends();
    } catch (err: any) {
      showError(err.message);
    } finally {
      setSending(false);
    }
  };

  // Handle accept request
  const handleAcceptRequest = async (requestId: string) => {
    setAcceptingIds(prev => [...prev, requestId]);

    try {
      const response = await fetch("/api/friends/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ requestId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to accept request");
      }

      success("Friend request accepted!");
      onRefreshFriends();
    } catch (err: any) {
      showError(err.message);
    } finally {
      setAcceptingIds(prev => prev.filter(id => id !== requestId));
    }
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div className={`fixed top-0 right-0 h-full w-full md:w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } overflow-y-auto`}>

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-gray-900">Friends</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search friends..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Friends List */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Your Friends ({filteredFriends.length})
          </h3>
          {filteredFriends.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              {searchQuery ? 'No friends found' : 'No friends yet'}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredFriends.map(friend => (
                <button
                  key={friend.id}
                  onClick={() => {
                    onFriendClick(friend.id);
                    onClose(); // Close drawer after selection
                  }}
                  className="w-full text-left p-3 bg-gray-50 hover:bg-blue-50 rounded-md transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900">
                    {friend.email}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Incoming Requests */}
        {incomingRequests.length > 0 && (
          <div className="p-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Incoming Requests ({incomingRequests.length})
            </h3>
            <div className="space-y-2">
              {incomingRequests.map(request => (
                <div
                  key={request.id}
                  className="p-3 bg-yellow-50 border border-yellow-200 rounded-md"
                >
                  <p className="text-sm text-gray-900 mb-2">
                    {request.fromUserEmail}
                  </p>
                  <button
                    onClick={() => handleAcceptRequest(request.id)}
                    disabled={acceptingIds.includes(request.id)}
                    className="w-full bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 disabled:bg-green-400 font-medium"
                  >
                    {acceptingIds.includes(request.id) ? 'Accepting...' : 'Accept'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Friend Form */}
        <div className="p-4 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Add Friend
          </h3>
          <form onSubmit={handleSendRequest} className="space-y-2">
            <input
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="Enter email..."
              required
              disabled={sending}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={sending}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-400 font-medium text-sm"
            >
              {sending ? 'Sending...' : 'Send Request'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
