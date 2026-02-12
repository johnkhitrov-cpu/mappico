'use client';

import { useState } from 'react';
import { getAuthHeaders } from '@/lib/clientAuth';

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

type SelectedPoint = (Point & { isMine: true }) | (FriendPoint & { isMine: false });

interface PointInfoPopupCardProps {
  point: SelectedPoint;
  onClose: () => void;
  onPointDeleted: (pointId: string) => void;
  onPointUpdated: (point: Point) => void;
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

function getCategoryLabel(category: string): string {
  switch (category) {
    case 'PLACE': return '📍 Interesting place';
    case 'FOOD': return '🍜 Food';
    case 'STAY': return '🏨 Stay';
    case 'ACTIVITY': return '🎟️ Activity';
    case 'OTHER': return '✨ Other';
    default: return '📍 Place';
  }
}

export default function PointInfoPopupCard({
  point,
  onClose,
  onPointDeleted,
  onPointUpdated,
  showSuccess,
  showError,
}: PointInfoPopupCardProps) {
  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState<'PLACE' | 'FOOD' | 'STAY' | 'ACTIVITY' | 'OTHER'>('PLACE');
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [editRemovePhoto, setEditRemovePhoto] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');

  // Delete state
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleEditClick = () => {
    setEditTitle(point.title);
    setEditDescription(point.description || '');
    setEditCategory(point.category);
    setEditPhotoFile(null);
    setEditPhotoPreview(null);
    setEditRemovePhoto(false);
    setIsEditing(true);
    setUpdateError('');
  };

  const handleCancelEdit = () => {
    if (editPhotoPreview) URL.revokeObjectURL(editPhotoPreview);
    setEditPhotoFile(null);
    setEditPhotoPreview(null);
    setEditRemovePhoto(false);
    setIsEditing(false);
    setUpdateError('');
  };

  const handleEditPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_FILE_SIZE = 20 * 1024 * 1024;
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    if (file.size > MAX_FILE_SIZE) {
      setUpdateError('File size exceeds 20MB limit');
      e.target.value = '';
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setUpdateError('Only JPG, PNG, and WEBP images are allowed');
      e.target.value = '';
      return;
    }

    if (editPhotoPreview) URL.revokeObjectURL(editPhotoPreview);
    setEditPhotoFile(file);
    setEditPhotoPreview(URL.createObjectURL(file));
    setEditRemovePhoto(false);
    setUpdateError('');
  };

  const handleSaveEdit = async () => {
    if (!point.isMine) return;

    if (!editTitle.trim()) {
      setUpdateError('Title is required');
      return;
    }

    setUpdating(true);
    setUpdateError('');

    try {
      let newPhotoUrl: string | undefined;

      if (editPhotoFile) {
        const formData = new FormData();
        formData.append('file', editPhotoFile);
        formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);
        formData.append('folder', 'mappico');

        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
        const uploadResponse = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          { method: 'POST', body: formData }
        );

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload image');
        }

        const uploadData = await uploadResponse.json();
        newPhotoUrl = uploadData.secure_url;
      }

      const body: Record<string, unknown> = {
        title: editTitle,
        description: editDescription || undefined,
        category: editCategory,
      };

      if (editRemovePhoto) {
        body.removePhoto = true;
      } else if (newPhotoUrl) {
        body.photoUrl = newPhotoUrl;
      }

      const response = await fetch(`/api/points/${point.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update point');
      }

      if (editPhotoPreview) URL.revokeObjectURL(editPhotoPreview);
      setEditPhotoFile(null);
      setEditPhotoPreview(null);
      setEditRemovePhoto(false);
      setIsEditing(false);

      onPointUpdated(data.point);
      showSuccess('Point updated successfully!');
    } catch (err: any) {
      setUpdateError(err.message);
      showError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeletePoint = async () => {
    if (!point.isMine) return;

    setDeleting(true);

    try {
      const response = await fetch(`/api/points/${point.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        showError(data.error || 'Failed to delete point');
        throw new Error(data.error || 'Failed to delete point');
      }

      showSuccess('Point deleted successfully');
      onPointDeleted(point.id);
    } catch (err) {
      console.error('Delete point error:', err);
    } finally {
      setDeleting(false);
    }
  };

  // Edit mode
  if (isEditing && point.isMine) {
    return (
      <div className="w-[320px] max-w-[calc(100vw-24px)] max-h-[60vh] flex flex-col">
        {/* Header */}
        <div className="shrink-0 p-3.5 pb-2 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">Edit Point</h3>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 pt-2 space-y-2.5">
          {updateError && (
            <div className="bg-red-50 p-2 rounded-lg">
              <p className="text-sm text-red-600">{updateError}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              maxLength={80}
              disabled={updating}
              className="w-full px-3 py-2 h-10 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              maxLength={500}
              rows={3}
              disabled={updating}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value as any)}
              disabled={updating}
              className="w-full px-3 py-2 h-10 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            >
              <option value="PLACE">📍 Interesting place</option>
              <option value="FOOD">🍜 Food</option>
              <option value="STAY">🏨 Stay</option>
              <option value="ACTIVITY">🎟️ Activity</option>
              <option value="OTHER">✨ Other</option>
            </select>
          </div>

          {/* Photo section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Photo
            </label>

            {editPhotoPreview ? (
              <div className="relative mb-2 w-full max-h-[140px] overflow-hidden rounded-lg bg-slate-100">
                <img src={editPhotoPreview} alt="New photo" className="h-full w-full object-cover block" />
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(editPhotoPreview);
                    setEditPhotoFile(null);
                    setEditPhotoPreview(null);
                  }}
                  disabled={updating}
                  className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-red-700 shadow-lg text-sm"
                >
                  ×
                </button>
              </div>
            ) : !editRemovePhoto && point.photoUrl ? (
              <div className="relative mb-2 w-full max-h-[140px] overflow-hidden rounded-lg bg-slate-100">
                <img src={point.photoUrl} alt="Current" className="h-full w-full object-cover block" />
              </div>
            ) : null}

            <div className="flex gap-2">
              <label className="flex-1">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleEditPhotoChange}
                  disabled={updating}
                  className="hidden"
                />
                <div className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 cursor-pointer flex items-center justify-center font-medium text-sm transition-colors">
                  {editPhotoFile ? editPhotoFile.name : 'Upload photo'}
                </div>
              </label>
              {(point.photoUrl && !editRemovePhoto && !editPhotoFile) && (
                <button
                  type="button"
                  onClick={() => setEditRemovePhoto(true)}
                  disabled={updating}
                  className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200 font-medium transition-colors"
                >
                  Remove
                </button>
              )}
              {editRemovePhoto && (
                <button
                  type="button"
                  onClick={() => setEditRemovePhoto(false)}
                  disabled={updating}
                  className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-300 font-medium transition-colors"
                >
                  Undo
                </button>
              )}
            </div>
            {editRemovePhoto && (
              <p className="text-xs text-red-500 mt-1">Photo will be removed on save.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 p-3.5 pt-2 border-t border-gray-100">
          <div className="flex gap-2">
            <button
              onClick={handleSaveEdit}
              disabled={updating || !editTitle.trim()}
              className="flex-1 min-w-0 bg-slate-900 text-white px-3 py-2 h-10 rounded-lg text-sm hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed font-medium shadow-sm transition-colors"
            >
              {updating ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={handleCancelEdit}
              disabled={updating}
              className="flex-1 min-w-0 bg-white text-gray-700 px-3 py-2 h-10 rounded-lg text-sm border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed font-medium shadow-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // View mode
  return (
    <div className="w-[320px] max-w-[calc(100vw-24px)] max-h-[60vh] flex flex-col">
      {/* Photo — full-bleed at top */}
      {point.photoUrl && (
        <img
          src={point.photoUrl}
          alt={point.title}
          className="w-full h-40 object-cover shrink-0"
        />
      )}

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-2">
        <h3 className="text-base font-bold text-gray-900">{point.title}</h3>

        {/* Category badge */}
        <p className="text-xs text-gray-500">{getCategoryLabel(point.category)}</p>

        {/* Address */}
        {point.address && (
          <p className="text-sm text-gray-600">{point.address}</p>
        )}

        {/* Description */}
        {point.description && (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{point.description}</p>
        )}

        {/* Date */}
        <p className="text-xs text-gray-400">
          {new Date(point.createdAt).toLocaleDateString()}
        </p>

        {/* Author for friend points */}
        {!point.isMine && (
          <p className="text-xs text-gray-500">
            by: <span className="font-medium text-gray-700">{point.userEmail}</span>
          </p>
        )}

        {/* Delete confirmation */}
        {point.isMine && showDeleteConfirm && (
          <div className="border-t pt-2 mt-2">
            <p className="text-sm text-gray-700 mb-2">
              Are you sure you want to delete this point?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDeletePoint}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed font-medium"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer — edit/delete buttons (own points only) */}
      {point.isMine && !showDeleteConfirm && (
        <div className="shrink-0 p-3.5 pt-0 space-y-1.5">
          <button
            onClick={handleEditClick}
            className="w-full bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 font-medium transition-colors"
          >
            Edit Point
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
            className="w-full bg-red-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Delete Point
          </button>
        </div>
      )}
    </div>
  );
}
