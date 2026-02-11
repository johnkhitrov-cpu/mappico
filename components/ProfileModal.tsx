'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthHeaders } from '@/lib/clientAuth';
import { useGlobalToast } from './ClientLayout';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const router = useRouter();
  const { success, error: showError } = useGlobalToast();

  const [email, setEmail] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Edit state
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Try localStorage first for instant display
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const user = JSON.parse(stored);
        if (user.email) setEmail(user.email);
        if (user.firstName !== undefined) setFirstName(user.firstName || '');
        if (user.lastName !== undefined) setLastName(user.lastName || '');
        if (user.avatarUrl !== undefined) setAvatarUrl(user.avatarUrl);
      }
    } catch {}

    // Then verify from API
    setLoading(true);
    fetch('/api/me', { headers: getAuthHeaders() })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.user) {
          setEmail(data.user.email);
          setFirstName(data.user.firstName || '');
          setLastName(data.user.lastName || '');
          setAvatarUrl(data.user.avatarUrl);
          // Update localStorage
          try {
            localStorage.setItem('user', JSON.stringify(data.user));
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  // Reset edit state when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarFile(null);
      setAvatarPreview(null);
      setRemoveAvatar(false);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('authStateChanged'));
    success('Logged out successfully');
    router.push('/login');
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_FILE_SIZE = 20 * 1024 * 1024;
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    if (file.size > MAX_FILE_SIZE) {
      showError('File size exceeds 20MB limit');
      e.target.value = '';
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      showError('Only JPG, PNG, and WEBP images are allowed');
      e.target.value = '';
      return;
    }

    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setRemoveAvatar(false);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      let newAvatarUrl: string | undefined;

      // Upload new avatar if selected
      if (avatarFile) {
        const formData = new FormData();
        formData.append('file', avatarFile);
        formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);
        formData.append('folder', 'mappico');

        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
        const uploadResponse = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          { method: 'POST', body: formData }
        );

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload avatar');
        }

        const uploadData = await uploadResponse.json();
        newAvatarUrl = uploadData.secure_url;
      }

      const body: Record<string, unknown> = {
        firstName: firstName || null,
        lastName: lastName || null,
      };

      if (removeAvatar) {
        body.removeAvatar = true;
      } else if (newAvatarUrl) {
        body.avatarUrl = newAvatarUrl;
      }

      const response = await fetch('/api/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        showError(data.error || 'Failed to update profile');
        return;
      }

      // Update local state
      setAvatarUrl(data.user.avatarUrl);
      setFirstName(data.user.firstName || '');
      setLastName(data.user.lastName || '');

      // Cleanup preview
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarFile(null);
      setAvatarPreview(null);
      setRemoveAvatar(false);

      // Update localStorage
      try {
        localStorage.setItem('user', JSON.stringify(data.user));
      } catch {}

      success('Profile updated!');
    } catch (err) {
      console.error('Update profile error:', err);
      showError('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  // Determine which avatar to show
  const displayAvatar = avatarPreview || (!removeAvatar ? avatarUrl : null);
  const initials = firstName
    ? firstName[0].toUpperCase()
    : email ? email[0].toUpperCase() : '?';

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Profile</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              &times;
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSave} className="px-6 pb-6 space-y-5">
            {/* Avatar section */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                {displayAvatar ? (
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-100">
                    <img src={displayAvatar} alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-2xl font-bold">
                    {initials}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarChange}
                    disabled={saving}
                    className="hidden"
                  />
                  <span className="text-sm text-blue-600 hover:text-blue-700 cursor-pointer font-medium">
                    Change photo
                  </span>
                </label>
                {(avatarUrl && !removeAvatar && !avatarFile) && (
                  <button
                    type="button"
                    onClick={() => setRemoveAvatar(true)}
                    disabled={saving}
                    className="text-sm text-red-500 hover:text-red-600 font-medium"
                  >
                    Remove
                  </button>
                )}
                {removeAvatar && (
                  <button
                    type="button"
                    onClick={() => setRemoveAvatar(false)}
                    disabled={saving}
                    className="text-sm text-gray-500 hover:text-gray-600 font-medium"
                  >
                    Undo
                  </button>
                )}
              </div>
              {removeAvatar && (
                <p className="text-xs text-red-500">Photo will be removed on save.</p>
              )}
            </div>

            {/* Name fields */}
            <div className="space-y-3">
              <div>
                <label htmlFor="profile-firstName" className="block text-sm font-medium text-gray-700 mb-1">
                  First name
                </label>
                <input
                  id="profile-firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={saving}
                  placeholder="First name"
                  maxLength={50}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                />
              </div>
              <div>
                <label htmlFor="profile-lastName" className="block text-sm font-medium text-gray-700 mb-1">
                  Last name
                </label>
                <input
                  id="profile-lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={saving}
                  placeholder="Last name"
                  maxLength={50}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                />
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <p className="px-3 py-2 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg">
                  {loading ? 'Loading...' : email || 'Unknown'}
                </p>
              </div>
            </div>

            {/* Save button */}
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium text-sm hover:bg-gray-800 transition-colors disabled:bg-gray-400"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>

            {/* Log out */}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              Log out
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
