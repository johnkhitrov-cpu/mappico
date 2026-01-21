'use client';

import MapComponent from "@/components/Map";
import AuthGuard from "@/components/AuthGuard";

export default function MapPage() {
  return (
    <AuthGuard>
      <div className="h-[calc(100vh-4rem)]">
        <MapComponent />
      </div>
    </AuthGuard>
  );
}
