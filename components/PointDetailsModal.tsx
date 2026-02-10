'use client';

interface Point {
  id: string;
  lat: number;
  lng: number;
  title: string;
  description: string | null;
  photoUrl: string | null;
  createdAt: string;
}

interface PointDetailsModalProps {
  point: Point | null;
  note?: string | null;
  onClose: () => void;
}

export default function PointDetailsModal({ point, note, onClose }: PointDetailsModalProps) {
  if (!point) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">{point.title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Photo */}
          {point.photoUrl && (
            <div className="mb-4">
              <img
                src={point.photoUrl}
                alt={point.title}
                className="w-full h-auto max-h-96 object-contain rounded-lg"
              />
            </div>
          )}

          {/* Description */}
          {point.description && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Description</h3>
              <p className="text-gray-900 whitespace-pre-wrap">{point.description}</p>
            </div>
          )}

          {/* Note */}
          {note && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <h3 className="text-sm font-semibold text-blue-700 mb-1">Note</h3>
              <p className="text-blue-900 text-sm italic">{note}</p>
            </div>
          )}

          {/* Coordinates */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Location</h3>
            <div className="flex gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">Latitude:</span> {point.lat.toFixed(6)}
              </div>
              <div>
                <span className="font-medium">Longitude:</span> {point.lng.toFixed(6)}
              </div>
            </div>
          </div>

          {/* Created Date */}
          <div className="text-xs text-gray-500">
            Created: {new Date(point.createdAt).toLocaleString()}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
