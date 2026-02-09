# Stage B3: Trip Detail with Points List & Map - Test Guide

## Feature Overview
The trip detail page now shows:
- **Left sidebar**: Trip info + list of points in the trip
- **Right side**: Map showing ONLY points from this trip
- **Interactions**: Click markers to highlight list items, click list items to center map
- **Management**: Remove points from trip (does NOT delete the point itself)

## Code Changes

### Files Modified:
- **[app/trips/[id]/page.tsx](app/trips/[id]/page.tsx)** - Complete redesign with split layout

### Changes Summary:
1. Added `TripPoint` and `Point` interfaces
2. Added state: `tripPoints`, `pointsLoading`, `selectedPointId`, `removingPointId`, `viewState`, `mapRef`
3. Added `fetchTripPoints()` function to load trip's points via GET /api/trips/:id/points
4. Added `handleRemoveFromTrip()` function to call DELETE /api/trips/:id/points/:pointId
5. Added `handlePointClick()` function for marker/list interaction (centers map, highlights item)
6. Completely restructured layout: 450px left sidebar + flex-1 map on right
7. Map auto-centers on first point when trip loads
8. Edit form moved to collapsible `<details>` section at bottom

## Manual Testing Steps

### Prerequisites
1. Dev server running on http://localhost:3000
2. User logged in
3. At least 1 Trip created
4. At least 2-3 Points created and attached to the trip (via /map with trip dropdown)

---

### Test Case 1: View Trip with Points

**Steps:**
1. Navigate to `/trips`
2. Click on a trip that has points attached
3. Observe the trip detail page

**Expected Result:**
- ✅ Left sidebar shows:
  - Trip title and description
  - Visibility and point count
  - List of point cards with thumbnails
- ✅ Right side shows map with markers for each point
- ✅ Map auto-centers on first point (zoom level ~10)
- ✅ Overlay shows "Showing X points"
- ✅ "Back to Trips" button at top

---

### Test Case 2: View Trip with NO Points

**Steps:**
1. Create a new trip (or use existing empty trip)
2. Navigate to `/trips/[id]` for that trip

**Expected Result:**
- ✅ Left sidebar shows:
  - Trip info
  - "No points in this trip yet."
  - Link to `/map` to create points
- ✅ Map shows default view (Europe, zoom 4)
- ✅ No markers on map
- ✅ No "Showing X points" overlay

---

### Test Case 3: Click Marker to Highlight List Item

**Steps:**
1. Open trip detail page with multiple points
2. Click a marker on the map

**Expected Result:**
- ✅ Map flies to center on that marker (zoom 12, 1s animation)
- ✅ Corresponding point card in list gets blue border and blue background
- ✅ Marker scales up slightly (scale-125)
- ✅ Other points remain normal styling

---

### Test Case 4: Click List Item to Center Map

**Steps:**
1. Open trip detail page with multiple points
2. Click a point card in the left sidebar list

**Expected Result:**
- ✅ Map flies to center on that point's location (zoom 12, 1s animation)
- ✅ Clicked point card gets blue border and blue background
- ✅ Corresponding marker scales up
- ✅ Smooth animation (flyTo with 1000ms duration)

---

### Test Case 5: Remove Point from Trip

**Steps:**
1. Open trip detail page with at least 2 points
2. Note the number of points shown ("X points")
3. Click "Remove from trip" button on one point card
4. Confirm the dialog

**Expected Result:**
- ✅ Confirmation dialog: "Remove this point from the trip? The point itself will not be deleted."
- ✅ Button shows "Removing..." during API call
- ✅ Success toast: "Point removed from trip!"
- ✅ Point card disappears from list
- ✅ Marker disappears from map
- ✅ Point count updates ("X-1 points")
- ✅ If selected point was removed, selection clears

**Verification:**
```javascript
// Verify point still exists on /map
// 1. Navigate to /map
// 2. Point should still be visible (not deleted, just detached)
```

---

### Test Case 6: Remove Last Point from Trip

**Steps:**
1. Open trip detail page with exactly 1 point
2. Remove that point

**Expected Result:**
- ✅ Point removed successfully
- ✅ List shows empty state: "No points in this trip yet."
- ✅ Map shows no markers
- ✅ Overlay disappears
- ✅ Link to /map displayed

---

### Test Case 7: Point Card with Photo vs No Photo

**Setup:**
- Ensure trip has at least 2 points:
  - One with photo (uploaded via /map)
  - One without photo

**Expected Result:**
- ✅ Point with photo: Shows 64x64 thumbnail, object-cover rounded
- ✅ Point without photo: Shows gray placeholder with "No photo" text
- ✅ Both cards have same layout and spacing

---

### Test Case 8: Point Card with Long Title/Description

**Setup:**
- Create point with very long title (near 100 chars)
- Create point with very long description (near 500 chars)

**Expected Result:**
- ✅ Long title: Truncates with ellipsis (single line, `truncate`)
- ✅ Long description: Shows max 2 lines with ellipsis (`line-clamp-2`)
- ✅ Card height remains reasonable
- ✅ Hover to see full title (browser tooltip)

---

### Test Case 9: Point with Note (from Stage B1)

**Setup:**
If you have trip points with custom notes from Stage B1 API:
```javascript
// Add point with note via console
const response = await fetch(`/api/trips/${tripId}/points`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  },
  body: JSON.stringify({
    pointId: 'some-point-id',
    note: 'Remember to visit the cafe nearby!'
  })
});
```

**Expected Result:**
- ✅ Point card shows note in blue italic text: "Note: Remember to visit the cafe nearby!"
- ✅ Note appears below description

---

### Test Case 10: Edit Trip Info (Collapsible)

**Steps:**
1. Open trip detail page
2. Scroll down to "Edit Trip Info" section
3. Click to expand
4. Change title to "Updated Title"
5. Click "Save Changes"

**Expected Result:**
- ✅ Edit form is collapsed by default
- ✅ Clicking expands the form smoothly
- ✅ Update succeeds: "Trip updated successfully!"
- ✅ Trip title in header updates immediately
- ✅ Form remains expanded after save
- ✅ "Save Changes" button disabled during save

---

### Test Case 11: Delete Trip from Detail Page

**Steps:**
1. Open trip detail page
2. Scroll to "Edit Trip Info" and expand
3. Click "Delete Trip" button
4. Confirm dialog

**Expected Result:**
- ✅ Confirmation dialog: "Are you sure you want to delete this trip? This action cannot be undone."
- ✅ Button shows "Deleting..." during API call
- ✅ Success toast: "Trip deleted successfully!"
- ✅ Redirects to `/trips` list page
- ✅ Trip no longer appears in list

---

### Test Case 12: Multiple Point Selection/Highlighting

**Steps:**
1. Open trip with 3+ points
2. Click first point in list
3. Click second marker on map
4. Click third point in list

**Expected Result:**
- ✅ Only ONE point highlighted at a time (not multi-select)
- ✅ Previous selection clears when new selection made
- ✅ Map always centers on newly selected point
- ✅ Smooth flyTo animation each time

---

### Test Case 13: Map Zoom Controls

**Steps:**
1. Open trip detail page
2. Use mouse wheel to zoom in/out
3. Click and drag to pan map
4. Use +/- buttons (if visible) to zoom

**Expected Result:**
- ✅ All standard Mapbox controls work
- ✅ Zoom persists when clicking markers/points
- ✅ Pan persists when clicking markers/points
- ✅ Only flyTo animation overrides manual zoom (when clicking)

---

### Test Case 14: 404/403 Handling

**Steps:**
1. Try to access invalid trip ID: `/trips/invalid-trip-id`
2. Try to access another user's trip (if you can get the ID)

**Expected Result:**
- ✅ Invalid ID: Toast "Trip not found", redirect to `/trips`
- ✅ Other user's trip: Toast "You don't have permission to view this trip", redirect to `/trips`
- ✅ No error displayed on page (handled gracefully)

---

### Test Case 15: Responsive Behavior (Optional)

**Steps:**
1. Resize browser window to narrow width
2. Observe layout behavior

**Expected Result:**
- ⚠️ Note: This stage does NOT implement responsive design
- ✅ Layout is optimized for desktop (1280px+)
- ⚠️ Mobile view may show horizontal scroll (acceptable for now)
- ✅ No crashes or broken layouts

---

## Edge Cases Tested

✅ **Empty trip** - Shows empty state with link to /map
✅ **Point with no photo** - Shows placeholder
✅ **Point with note** - Displays note in blue italic
✅ **Long title/description** - Truncates properly
✅ **Remove last point** - Shows empty state
✅ **Selected point removed** - Clears selection
✅ **Map auto-center** - Centers on first point when loaded
✅ **Marker click** - Highlights list item and centers map
✅ **List click** - Centers map and highlights marker
✅ **Edit form** - Collapsible by default
✅ **Delete trip** - Confirmation dialog and redirect

---

## API Calls Made

### On Page Load:
```
GET /api/trips/:id
→ Loads trip metadata

GET /api/trips/:id/points
→ Loads trip points (ordered by order ASC, createdAt ASC)
```

### On Remove Point:
```
DELETE /api/trips/:id/points/:pointId
→ Detaches point from trip (point still exists)
```

### On Edit Trip:
```
PATCH /api/trips/:id
→ Updates trip metadata
```

### On Delete Trip:
```
DELETE /api/trips/:id
→ Deletes trip (cascade deletes all TripPoints)
```

---

## Non-Goals (NOT Implemented)

❌ Adding points from this page (use /map instead)
❌ Editing point details (use /map instead)
❌ Deleting points entirely (only detach from trip)
❌ Reordering points via drag-drop
❌ Updating TripPoint.note or order from UI (use Stage B1 API directly)
❌ Sharing trip with friends
❌ UNLISTED trip links
❌ SSE updates for real-time changes
❌ Mobile responsive design
❌ Filtering/searching points in list
❌ Map clustering for many points
❌ Route/path drawing between points

These features are reserved for future stages.

---

## Summary

Stage B3 adds a complete trip detail view with:
- ✅ Split layout: sidebar + map
- ✅ Points list with thumbnails and descriptions
- ✅ Map filtered to show only trip points
- ✅ Two-way click interaction (list ↔ map)
- ✅ Remove from trip functionality
- ✅ Auto-centering on first point
- ✅ Smooth flyTo animations
- ✅ Empty state handling
- ✅ Edit/delete trip in collapsible section
- ✅ No breaking changes to Stage A/B1/B2

**Status:** ✅ COMPLETE - Ready for user testing

## Quick Test Sequence

```bash
# 1. Start dev server
npm run dev

# 2. Open browser to http://localhost:3000

# 3. Test flow:
# - Login
# - Go to /map
# - Create trip "Vietnam Trip"
# - Create 2-3 points, select "Vietnam Trip" in dropdown
# - Go to /trips
# - Click "Vietnam Trip"
# - Observe split layout with points list + map
# - Click markers and list items
# - Remove one point
# - Verify point still exists on /map
```

Done! 🎉
