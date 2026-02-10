export function TripCardSkeleton() {
  return (
    <div className="p-4 bg-gray-50 rounded-md animate-pulse">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          {/* Title */}
          <div className="h-6 bg-gray-300 rounded w-3/4 mb-2"></div>

          {/* Description */}
          <div className="space-y-1 mt-1">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>

          {/* Metadata */}
          <div className="flex gap-3 mt-2">
            <div className="h-3 bg-gray-200 rounded w-20"></div>
            <div className="h-3 bg-gray-200 rounded w-24"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TripDetailHeaderSkeleton() {
  return (
    <div className="p-4 border-b bg-gray-50">
      <div className="animate-pulse">
        {/* Back button */}
        <div className="h-4 bg-gray-300 rounded w-32 mb-2"></div>

        {/* Title */}
        <div className="h-8 bg-gray-300 rounded w-2/3 mb-1"></div>

        {/* Description */}
        <div className="h-4 bg-gray-200 rounded w-4/5"></div>

        {/* Metadata */}
        <div className="flex gap-4 mt-2">
          <div className="h-3 bg-gray-200 rounded w-20"></div>
          <div className="h-3 bg-gray-200 rounded w-16"></div>
        </div>
      </div>
    </div>
  );
}

export function PointCardSkeleton() {
  return (
    <div className="border rounded-lg p-3 animate-pulse">
      <div className="flex gap-3">
        {/* Thumbnail */}
        <div className="w-16 h-16 bg-gray-300 rounded flex-shrink-0"></div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-5 bg-gray-300 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    </div>
  );
}

export function MapSkeleton() {
  return (
    <div className="h-full w-full bg-gray-200 animate-pulse flex items-center justify-center">
      <div className="text-gray-400">Loading map...</div>
    </div>
  );
}
