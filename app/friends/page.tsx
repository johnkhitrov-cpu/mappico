'use client';

import { useState, useEffect } from "react";
import AuthGuard from "@/components/AuthGuard";
import { getAuthHeaders } from "@/lib/clientAuth";
import { useGlobalToast } from "@/components/ClientLayout";

interface Friend {
  id: string;
  email: string;
}

interface IncomingRequest {
  id: string;
  fromUser: Friend;
  createdAt: string;
}

export default function FriendsPage() {
  const { success, error: showError } = useGlobalToast();
  const [toEmail, setToEmail] = useState("");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [friendsRes, incomingRes] = await Promise.all([
        fetch("/api/friends/list", { headers: getAuthHeaders() }),
        fetch("/api/friends/incoming", { headers: getAuthHeaders() }),
      ]);

      if (!friendsRes.ok || !incomingRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const friendsData = await friendsRes.json();
      const incomingData = await incomingRes.json();

      setFriends(friendsData.friends);
      setIncomingRequests(incomingData.requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");
    setSuccessMessage("");

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
        // Handle rate limiting
        if (response.status === 429) {
          showError("Too many friend requests. Please try again later.");
        } else {
          showError(data.error || "Failed to send request");
        }
        throw new Error(data.error || "Failed to send request");
      }

      setSuccessMessage("Friend request sent successfully!");
      success("Friend request sent successfully!");
      setToEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send request");
    } finally {
      setSending(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    setError("");
    setSuccessMessage("");

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
        showError(data.error || "Failed to accept request");
        throw new Error(data.error || "Failed to accept request");
      }

      setSuccessMessage("Friend request accepted!");
      success("Friend request accepted!");
      // Refresh data
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept request");
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Friends</h1>

          {/* Global messages */}
          {error && (
            <div className="mb-4 bg-red-50 p-4 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 bg-green-50 p-4 rounded-md">
              <p className="text-sm text-green-800">{successMessage}</p>
            </div>
          )}

          {/* Add friend form */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Add Friend by Email
            </h2>
            <form onSubmit={handleSendRequest} className="flex gap-3">
              <input
                type="email"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                placeholder="Enter friend's email"
                required
                disabled={sending}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={sending}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed font-medium"
              >
                {sending ? "Sending..." : "Send Request"}
              </button>
            </form>
          </div>

          {/* Incoming requests */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Incoming Requests
            </h2>
            {loading ? (
              <p className="text-gray-600 text-center py-4">Loading...</p>
            ) : incomingRequests.length === 0 ? (
              <p className="text-gray-600 text-center py-4">
                No pending requests
              </p>
            ) : (
              <div className="space-y-3">
                {incomingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {request.fromUser.email}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(request.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAcceptRequest(request.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                    >
                      Accept
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Friends list */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              My Friends
            </h2>
            {loading ? (
              <p className="text-gray-600 text-center py-4">Loading...</p>
            ) : friends.length === 0 ? (
              <p className="text-gray-600 text-center py-4">
                No friends yet. Add some friends above!
              </p>
            ) : (
              <div className="space-y-2">
                {friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="p-3 bg-gray-50 rounded-md"
                  >
                    <p className="text-sm font-medium text-gray-900">
                      {friend.email}
                    </p>
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
