# Stage C1: Friends Visibility for Trips (Read-Only Access) - Test Guide

## Feature Overview
Friends can now view trips shared with them when the trip visibility is set to FRIENDS.
Friends have **read-only access** - they can view trip details, points, and map, but cannot edit or remove anything.

## Code Changes

### Files Created:
- **[lib/friendsHelper.ts](lib/friendsHelper.ts)** - Helper function `areFriends()` to check if two users are confirmed friends

### Files Modified:
1. **[app/api/trips/route.ts](app/api/trips/route.ts)** - Added `?shared=true` query param to fetch trips shared by friends
2. **[app/api/trips/[id]/route.ts](app/api/trips/[id]/route.ts)** - Updated GET to allow friends access for FRIENDS-visible trips
3. **[app/api/trips/[id]/points/route.ts](app/api/trips/[id]/points/route.ts)** - Updated GET to allow friends access for FRIENDS-visible trips
4. **[app/trips/page.tsx](app/trips/page.tsx)** - Added "Trips Shared with Me" section
5. **[app/trips/[id]/page.tsx](app/trips/[id]/page.tsx)** - Added read-only mode detection and UI changes

### Changes Summary:

#### Backend Access Control:
1. Created `areFriends()` helper to check friend relationship via FriendRequest table
2. Updated GET /api/trips/:id to allow friends access when visibility = FRIENDS
3. Updated GET /api/trips/:id/points to allow friends access when visibility = FRIENDS
4. Added GET /api/trips?shared=true to fetch trips shared by friends
5. Return 404 (not 403) when non-friend tries to access FRIENDS trip (don't leak existence)

#### Frontend Changes:
1. Added "Trips Shared with Me" section on /trips page
2. Fetch shared trips via GET /api/trips?shared=true
3. Display owner email for shared trips
4. Detect read-only mode via `trip.isOwner` flag from API
5. Hide "Remove from trip" buttons when not owner
6. Hide entire "Edit Trip Info" section when not owner
7. Show badge "Shared by <friend email>" on trip detail page when not owner
8. Update empty state message to not suggest creating points when viewing shared trip

---

## Manual Testing Steps

### Prerequisites
1. Dev server running on http://localhost:3000
2. Two user accounts created (User A and User B)
3. Users A and B are confirmed friends (friend request accepted)

---

### Test Case 1: Create Trip with FRIENDS Visibility (User A)

**Steps:**
1. Login as User A
2. Navigate to `/trips`
3. Click "Create Trip"
4. Enter:
   - Title: "Vietnam Adventure"
   - Description: "Exploring Vietnam with friends"
   - Visibility: **Friends (Visible to friends)**
5. Click "Create Trip"

**Expected Result:**
- ✅ Trip created successfully
- ✅ Visibility shows "👥 Friends"
- ✅ Trip appears in User A's "My Trips" section

---

### Test Case 2: View Shared Trip in List (User B)

**Steps:**
1. Login as User B (friend of User A)
2. Navigate to `/trips`
3. Scroll down to "Trips Shared with Me" section

**Expected Result:**
- ✅ "Trips Shared with Me" section appears
- ✅ "Vietnam Adventure" trip appears with:
  - Blue border/background
  - "Shared" badge
  - "👤 Shared by [User A's email]"
  - Updated date

---

### Test Case 3: View Shared Trip Details (User B - Read-Only Mode)

**Steps:**
1. Still as User B
2. Click on "Vietnam Adventure" in shared trips section
3. Observe the trip detail page

**Expected Result:**
- ✅ Trip detail page loads successfully
- ✅ Badge at top: "👤 Shared by [User A's email]"
- ✅ Trip title, description, and visibility displayed
- ✅ Points list visible (if any points exist)
- ✅ Map visible with markers (if any points exist)
- ✅ **NO** "Remove from trip" buttons on point cards
- ✅ **NO** "Edit Trip Info" section visible
- ✅ Map and point list are fully interactive (can click markers/points)

---

### Test Case 4: Shared Trip with Points (User A adds points)

**Setup:**
1. Login as User A
2. Go to `/map`
3. Create 2-3 points and assign them to "Vietnam Adventure" trip

**Steps (User B):**
1. Login as User B
2. Navigate to `/trips`
3. Click "Vietnam Adventure" in shared trips
4. Observe points list and map

**Expected Result:**
- ✅ All points appear in left sidebar list
- ✅ All markers appear on map
- ✅ Clicking point in list centers map
- ✅ Clicking marker highlights point in list
- ✅ NO "Remove from trip" buttons visible
- ✅ Point thumbnails, descriptions, and notes visible

---

### Test Case 5: Non-Friend Cannot Access FRIENDS Trip

**Setup:**
Create User C who is NOT a friend of User A

**Steps:**
1. Login as User C
2. Get the trip ID of "Vietnam Adventure" (from URL when User A views it)
3. Try to access `/trips/[tripId]` directly

**Expected Result:**
- ✅ API returns 404 (not 403)
- ✅ Toast: "Trip not found"
- ✅ Redirects to `/trips`
- ✅ Trip does NOT appear in User C's shared trips list

**Verification:**
```bash
# Try API call as User C
curl -X GET "http://localhost:3000/api/trips/[tripId]" \
  -H "Authorization: Bearer [User C's token]"

# Should return 404, not 403 (to avoid leaking trip existence)
```

---

### Test Case 6: PRIVATE Trip Not Shared with Friends

**Steps:**
1. Login as User A
2. Create trip "Private Notes" with visibility: **Private (Only me)**
3. Login as User B
4. Navigate to `/trips`
5. Check "Trips Shared with Me" section

**Expected Result:**
- ✅ "Private Notes" trip does NOT appear in shared trips
- ✅ Only FRIENDS-visible trips appear in shared section

---

### Test Case 7: Switch Trip from FRIENDS to PRIVATE

**Steps:**
1. Login as User A
2. Go to `/trips/[Vietnam Adventure ID]`
3. Expand "Edit Trip Info"
4. Change Visibility to: **Private (Only me)**
5. Click "Save Changes"
6. Login as User B
7. Navigate to `/trips`
8. Check "Trips Shared with Me" section

**Expected Result:**
- ✅ "Vietnam Adventure" disappears from User B's shared trips
- ✅ If User B tries to access trip URL directly → 404

---

### Test Case 8: Switch Trip from PRIVATE to FRIENDS

**Steps:**
1. Login as User A (owner of "Private Notes")
2. Go to trip detail page
3. Change Visibility to: **Friends (Visible to friends)**
4. Save
5. Login as User B
6. Navigate to `/trips`

**Expected Result:**
- ✅ "Private Notes" now appears in User B's "Trips Shared with Me" section

---

### Test Case 9: Unfriend User Removes Access

**Steps:**
1. User A and User B are friends, User B can see User A's FRIENDS trips
2. Login as User A
3. Go to `/friends`
4. Remove User B as friend (if your app supports this)
5. Login as User B
6. Navigate to `/trips`

**Expected Result:**
- ✅ User A's trips disappear from User B's shared trips section
- ✅ If User B tries to access trip URL → 404

**Note:** If you don't have unfriend functionality yet, skip this test.

---

### Test Case 10: Empty Shared Trips State

**Setup:**
Create User D who has friends but none of them have created FRIENDS-visible trips

**Steps:**
1. Login as User D
2. Navigate to `/trips`
3. Check "Trips Shared with Me" section

**Expected Result:**
- ✅ Shows: "No friends have shared trips with you yet."
- ✅ Section is not hidden, just shows empty state

---

### Test Case 11: User with No Friends

**Setup:**
Create User E who has NO friends

**Steps:**
1. Login as User E
2. Navigate to `/trips`
3. Check "Trips Shared with Me" section

**Expected Result:**
- ✅ Shows: "No friends have shared trips with you yet."
- ✅ API call GET /api/trips?shared=true returns empty array

---

### Test Case 12: Friend Adds New Point to Shared Trip

**Steps:**
1. User B is viewing User A's shared trip
2. User A (owner) goes to /map and adds a new point to the trip
3. User B refreshes the trip detail page

**Expected Result:**
- ✅ New point appears in list and map (no SSE in this stage)
- ✅ User B still in read-only mode (no edit buttons)

---

### Test Case 13: Read-Only Mode Interaction Testing

**Steps:**
1. Login as User B (viewing User A's shared trip)
2. Try to interact with the page:
   - Click markers on map
   - Click points in list
   - Try to scroll/zoom map
   - Check for any edit buttons

**Expected Result:**
- ✅ All view interactions work (map zoom, pan, marker click, list click)
- ✅ Map centers on clicked point
- ✅ Point highlights in list when marker clicked
- ✅ NO way to modify trip or points via UI
- ✅ No errors in console

---

### Test Case 14: Badge Display on Shared Trip

**Steps:**
1. Login as User B
2. Navigate to User A's shared trip detail page
3. Observe header section

**Expected Result:**
- ✅ Badge displays: "👤 Shared by [User A's email]"
- ✅ Badge appears ABOVE the trip title
- ✅ Badge has blue background (bg-blue-100 text-blue-800)

---

### Test Case 15: Empty Trip Shared (No Points)

**Steps:**
1. User A creates trip "Empty Trip" with FRIENDS visibility, no points
2. User B views this shared trip

**Expected Result:**
- ✅ Shows: "No points in this trip yet."
- ✅ Does NOT show link to /map (since User B is not owner)
- ✅ Map shows default view (no markers)
- ✅ No errors or broken UI

---

### Test Case 16: API Direct Access Testing

**Test Friend Access:**
```bash
# User B (friend) accessing User A's FRIENDS trip
curl -X GET "http://localhost:3000/api/trips/[tripId]" \
  -H "Authorization: Bearer [User B's token]"

# Expected: 200 OK, returns trip with owner info and isOwner: false
```

**Test Non-Friend Access:**
```bash
# User C (not friend) accessing User A's FRIENDS trip
curl -X GET "http://localhost:3000/api/trips/[tripId]" \
  -H "Authorization: Bearer [User C's token]"

# Expected: 404 (not 403, to avoid leaking trip existence)
```

**Test PRIVATE Trip Access:**
```bash
# User B (friend) trying to access User A's PRIVATE trip
curl -X GET "http://localhost:3000/api/trips/[private-trip-id]" \
  -H "Authorization: Bearer [User B's token]"

# Expected: 404 (not accessible even to friends)
```

---

## Edge Cases Tested

✅ **FRIENDS trip shared with friends** - Read-only access granted
✅ **PRIVATE trip** - Not visible to friends
✅ **Non-friend access** - Returns 404 (doesn't leak existence)
✅ **Switching visibility** - Dynamically grants/revokes access
✅ **Empty shared trips** - Shows empty state
✅ **No friends** - Shows empty state
✅ **Read-only UI** - No edit/delete buttons visible
✅ **Shared badge** - Shows owner email
✅ **Points interaction** - View-only, fully interactive map
✅ **Empty trip shared** - No errors, no /map suggestion

---

## API Calls Made

### On Trips List Page Load (User B):
```
GET /api/trips
→ Loads User B's own trips

GET /api/trips?shared=true
→ Loads trips shared with User B by friends
```

### On Trip Detail Page Load (User B viewing shared trip):
```
GET /api/trips/:id
→ Checks if User B has access (friend + FRIENDS visibility)
→ Returns trip with owner info and isOwner: false

GET /api/trips/:id/points
→ Loads trip points (same access check)
```

---

## Non-Goals (NOT Implemented)

❌ Editing by friends (read-only access only)
❌ Adding points to shared trips by friends
❌ UNLISTED trip links (public URL sharing)
❌ Notifications when friend shares trip
❌ Comments on shared trips
❌ Real-time SSE updates for shared trips
❌ Unfriend functionality (if not already implemented)
❌ Filtering/searching shared trips

These features are reserved for future stages.

---

## Summary

Stage C1 adds friend-based trip sharing:
- ✅ Backend access control via friend relationship check
- ✅ GET /api/trips/:id allows friends access for FRIENDS trips
- ✅ GET /api/trips/:id/points allows friends access
- ✅ GET /api/trips?shared=true fetches trips shared by friends
- ✅ "Trips Shared with Me" section on /trips page
- ✅ Read-only mode detection via isOwner flag
- ✅ Hide edit/delete operations for non-owners
- ✅ Show "Shared by <email>" badge
- ✅ Return 404 (not 403) for unauthorized access
- ✅ No breaking changes to Stage A/B1/B2/B3

**Status:** ✅ COMPLETE - Ready for user testing

## Quick Test Sequence

```bash
# 1. Start dev server
npm run dev

# 2. Setup (use browser + two different accounts)
# - Create User A and User B
# - Make them friends (send + accept friend request)

# 3. User A creates trip with FRIENDS visibility
# - Login as User A
# - /trips → Create Trip → Set visibility to Friends
# - Add 2-3 points via /map

# 4. User B views shared trip
# - Login as User B
# - /trips → Check "Trips Shared with Me" section
# - Click shared trip
# - Verify read-only mode (no edit buttons)
# - Test map interaction (click markers/points)

# 5. Test access control
# - Create User C (not friends with A)
# - Try to access User A's trip URL directly
# - Verify 404 response

# 6. Test visibility switch
# - User A changes trip to PRIVATE
# - User B: trip disappears from shared list
```

Done! 🎉
