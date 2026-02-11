// Type-safe event definitions
export type AnalyticsEvent =
  | { name: 'sign_up'; properties: { method: 'email' } }
  | { name: 'create_trip'; properties: { visibility: 'PRIVATE' | 'FRIENDS' | 'UNLISTED' } }
  | { name: 'create_point'; properties: { has_photo: boolean; has_trip: boolean } }
  | { name: 'attach_point_to_trip'; properties: { trip_visibility: string } }
  | { name: 'copy_share_link'; properties: { trip_visibility: string } }
  | { name: 'open_shared_trip'; properties: { has_points: boolean } };

export type EventName = AnalyticsEvent['name'];
