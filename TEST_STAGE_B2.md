# Stage B2: Trip Selection in Point Creation - Test Guide

## Feature Overview
Users can now optionally select a Trip when creating a Point on the map. After the point is successfully created, it will be automatically attached to the selected trip.

## Code Changes

### Files Modified:
- **[components/Map.tsx](components/Map.tsx)** - Added trip selection dropdown to point creation form

### Changes Summary:
1. Added `Trip` interface
2. Added state: `trips`, `tripsLoading`, `selectedTripId`
3. Added `fetchTrips()` function to load user's trips
4. Added trip dropdown to create-point form (between Description and Photo fields)
5. Modified `handleSavePoint()` to attach point to trip after creation
6. Modified `handleMapClick()` and `handleCancelPoint()` to reset `selectedTripId`

## Manual Testing Steps

### Prerequisites
1. Dev server running on http://localhost:3000
2. User logged in
3. At least 1 Trip created in `/trips`
4. Map page accessible at `/map`

---

### Test Case 1: Create Point WITHOUT Trip Selection

**Steps:**
1. Navigate to `/map`
2. Click anywhere on the map to open "Add Point" modal
3. Verify dropdown shows "Trip (optional)" with options:
   - "None" (selected by default)
   - Your trip titles listed
4. Enter title: "Test Point - No Trip"
5. Leave Trip dropdown on "None"
6. Click "Save Point"

**Expected Result:**
- ✅ Success toast: "Point created successfully!"
- ✅ Point appears on map as blue marker
- ✅ Point is NOT attached to any trip

**Verification:**
```javascript
// In browser console
const tripId = "YOUR_TRIP_ID"; // Get from /trips page
const response = await fetch(`/api/trips/${tripId}/points`, {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
});
const data = await response.json();
console.log('Trip points:', data.tripPoints); // Should be empty []
```

---

### Test Case 2: Create Point WITH Trip Selection

**Steps:**
1. Navigate to `/map`
2. Click anywhere on the map to open "Add Point" modal
3. Enter title: "Test Point - With Trip"
4. Select a trip from the "Trip (optional)" dropdown
5. Click "Save Point"

**Expected Result:**
- ✅ Success toast: "Point created and added to trip!"
- ✅ Point appears on map as blue marker
- ✅ Point IS attached to the selected trip

**Verification:**
```javascript
// In browser console
const tripId = "SELECTED_TRIP_ID"; // The trip you selected
const response = await fetch(`/api/trips/${tripId}/points`, {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
});
const data = await response.json();
console.log('Trip points:', data.tripPoints);
// Should contain your new point with matching pointId
```

---

### Test Case 3: Dropdown State with NO Trips

**Setup:**
Delete all your trips first in `/trips` page.

**Steps:**
1. Navigate to `/map`
2. Click anywhere on the map to open "Add Point" modal
3. Look at the "Trip (optional)" section

**Expected Result:**
- ✅ Shows message: "Create a trip first in /trips" (with clickable link)
- ✅ NO dropdown displayed
- ✅ Can still create point normally (without trip selection)

---

### Test Case 4: Trips Loading State

**Steps:**
1. Open browser DevTools → Network tab
2. Throttle network to "Slow 3G"
3. Navigate to `/map`
4. Quickly click on the map to open "Add Point" modal

**Expected Result:**
- ✅ Briefly shows: "Loading trips..."
- ✅ Then shows dropdown once trips loaded
- ✅ Form remains functional during loading

---

### Test Case 5: Dropdown Resets After Point Creation

**Steps:**
1. Navigate to `/map`
2. Click on map → Open "Add Point" modal
3. Enter title: "Reset Test"
4. Select a trip from dropdown
5. Click "Save Point"
6. Wait for success message
7. Click on map again to open modal

**Expected Result:**
- ✅ Trip dropdown resets to "None"
- ✅ All fields (Title, Description, Photo) are empty
- ✅ Ready for new point creation

---

### Test Case 6: Dropdown Resets on Cancel

**Steps:**
1. Navigate to `/map`
2. Click on map → Open "Add Point" modal
3. Enter title: "Cancel Test"
4. Select a trip from dropdown
5. Click "Cancel" button
6. Click on map again to open modal

**Expected Result:**
- ✅ Trip dropdown resets to "None"
- ✅ All fields are empty
- ✅ Previously selected trip is NOT remembered

---

### Test Case 7: Partial Failure - Point Created but Trip Attach Fails

**Setup:**
To simulate this, temporarily modify trip ID to invalid value in browser console:

```javascript
// Monkey-patch fetch to make trip attach fail
const originalFetch = window.fetch;
window.fetch = function(url, options) {
  if (url.includes('/api/trips/') && url.includes('/points') && options?.method === 'POST') {
    // Simulate 404 for trip attach
    return Promise.resolve(new Response(
      JSON.stringify({ error: 'Trip not found' }),
      { status: 404 }
    ));
  }
  return originalFetch.apply(this, arguments);
};
```

**Steps:**
1. Run the monkey-patch code above in console
2. Navigate to `/map`
3. Click on map → Open "Add Point" modal
4. Enter title: "Partial Failure Test"
5. Select a trip from dropdown
6. Click "Save Point"

**Expected Result:**
- ✅ Error toast: "Point created, but could not be added to trip"
- ✅ Point STILL appears on map (not rolled back)
- ✅ Modal closes normally
- ✅ Point exists in database but NOT in trip

**Cleanup:**
```javascript
// Restore original fetch
window.fetch = originalFetch;
```

---

### Test Case 8: Multiple Points to Same Trip

**Steps:**
1. Navigate to `/map`
2. Create first point:
   - Click on map → Enter title: "Point 1"
   - Select "My Test Trip"
   - Save
3. Create second point:
   - Click on different map location
   - Enter title: "Point 2"
   - Select same "My Test Trip"
   - Save
4. Create third point:
   - Click on another location
   - Enter title: "Point 3"
   - Select same "My Test Trip"
   - Save

**Expected Result:**
- ✅ All 3 points created successfully
- ✅ All 3 points attached to same trip
- ✅ Each point shows on map independently

**Verification:**
```javascript
const tripId = "YOUR_TRIP_ID";
const response = await fetch(`/api/trips/${tripId}/points`, {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
});
const data = await response.json();
console.log('Trip points count:', data.tripPoints.length); // Should be 3
```

---

### Test Case 9: Dropdown Disabled During Save

**Steps:**
1. Navigate to `/map`
2. Click on map → Open "Add Point" modal
3. Enter title: "Disable Test"
4. Select a trip
5. **While form is saving** (after clicking Save but before completion):
   - Try to change the trip dropdown

**Expected Result:**
- ✅ Dropdown is disabled during save operation
- ✅ Dropdown shows selected value (not "None")
- ✅ Re-enabled after save completes

---

### Test Case 10: Trip with Photo Upload

**Steps:**
1. Navigate to `/map`
2. Click on map → Open "Add Point" modal
3. Enter title: "Point with Photo and Trip"
4. Select a trip from dropdown
5. Upload a photo (JPG/PNG, < 5MB)
6. Click "Save Point"

**Expected Result:**
- ✅ Photo uploads successfully to Cloudinary
- ✅ Point created with photoUrl
- ✅ Point attached to selected trip
- ✅ Success toast: "Point created and added to trip!"
- ✅ Point shows photo in details popup

---

## Edge Cases Tested

✅ **Empty trips list** - Shows helpful message with link to `/trips`
✅ **Loading state** - Shows "Loading trips..." during fetch
✅ **Partial failure** - Point created but trip attach fails → Proper error message
✅ **Form reset** - Trip selection resets after save/cancel
✅ **Disabled state** - Dropdown disabled during save/upload
✅ **Idempotency** - Multiple points can be added to same trip

---

## API Calls Made

### On Component Mount:
```
GET /api/trips
→ Loads user's trips for dropdown
```

### On Point Creation (with trip selected):
```
POST /api/points
→ Creates the point
  ↓ Success
POST /api/trips/:tripId/points
→ Attaches point to trip
```

---

## Non-Goals (NOT Implemented)

❌ Trip detail view/map filtering by trip
❌ Reordering points within trip
❌ Editing point's trip assignment after creation
❌ Removing point from trip via point details popup
❌ Friends sharing/FRIENDS visibility access
❌ New rate limiting logic
❌ SSE updates for trip point changes

These features are reserved for future stages (Stage B3+).

---

## Summary

Stage B2 adds minimal, non-intrusive trip selection to the existing point creation flow:
- ✅ Optional dropdown (defaults to "None")
- ✅ Graceful handling when no trips exist
- ✅ Proper error handling for partial failures
- ✅ Clean UX with reset on save/cancel
- ✅ No changes to existing point creation logic
- ✅ No breaking changes to Stage B1 APIs

**Status:** ✅ COMPLETE - Ready for user testing
