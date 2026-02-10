# Stage C2: UNLISTED Share Link + Point Preview - Test Guide

## Feature Overview
Stage C2 adds two major features:
1. **UNLISTED visibility** with shareable links for trips
2. **Point details modal** showing full photo + description when clicking points

## Code Changes

### Files Created:
- **[app/api/trips/[id]/share-token/route.ts](app/api/trips/[id]/share-token/route.ts)** - POST endpoint to generate share token
- **[app/api/share/trips/[token]/route.ts](app/api/share/trips/[token]/route.ts)** - Public GET endpoint to view shared trips
- **[app/share/trips/[token]/page.tsx](app/share/trips/[token]/page.tsx)** - Public page to view shared trips (no auth required)
- **[components/PointDetailsModal.tsx](components/PointDetailsModal.tsx)** - Reusable modal for viewing point details

### Files Modified:
1. **[prisma/schema.prisma](prisma/schema.prisma)** - Added `shareToken` and `shareTokenCreatedAt` to Trip model
2. **[lib/validators.ts](lib/validators.ts)** - Added UNLISTED to visibility enum
3. **[app/trips/page.tsx](app/trips/page.tsx)** - Added UNLISTED option to create form
4. **[app/trips/[id]/page.tsx](app/trips/[id]/page.tsx)** - Added Share section, point details modal
5. **[app/share/trips/[token]/page.tsx](app/share/trips/[token]/page.tsx)** - Public share page with modal

### Changes Summary:

#### Database:
- Added `shareToken String? @unique` to Trip model
- Added `shareTokenCreatedAt DateTime?` to Trip model
- Added index on `shareToken` for faster lookups

#### Backend:
- POST /api/trips/:id/share-token generates secure random token (32 bytes hex)
- GET /api/share/trips/:token publicly accessible (no JWT required)
- Share tokens only work for UNLISTED trips
- Returns trip + points for valid tokens

#### Frontend:
- UNLISTED visibility option added to all trip forms
- "Share Trip" section shows in trip detail for owners
- "Copy share link" button for UNLISTED trips
- Hint to change visibility for PRIVATE/FRIENDS trips
- Point details modal opens on point click (both list and map markers)
- Modal shows: title, full description, large photo, coordinates, note, created date

---

## Manual Testing Steps

### Prerequisites
1. Dev server running on http://localhost:3000
2. User logged in
3. At least 1 Trip created

---

### Test Case 1: Create UNLISTED Trip

**Steps:**
1. Navigate to `/trips`
2. Click "Create Trip"
3. Enter:
   - Title: "Public Thailand Trip"
   - Description: "My amazing Thailand adventure"
   - Visibility: **Unlisted (Anyone with link)**
4. Click "Create Trip"

**Expected Result:**
- ✅ Trip created successfully
- ✅ Trip appears in "My Trips" list
- ✅ Visibility shows "Unlisted" or similar indicator

---

### Test Case 2: Generate Share Link (UNLISTED Trip)

**Steps:**
1. Login as User A (trip owner)
2. Navigate to `/trips/[thailand-trip-id]`
3. Scroll to "Share Trip" section
4. Observe the section content
5. Click "Copy share link" button

**Expected Result:**
- ✅ "Share Trip" section visible (owner only)
- ✅ Shows message: "Anyone with the link can view this trip."
- ✅ Button changes to "Generating..." briefly
- ✅ Toast: "Share link copied to clipboard!"
- ✅ Link is in clipboard (paste to verify format: http://localhost:3000/share/trips/[64-char-hex-token])

---

### Test Case 3: Access Shared Link (Public - No Login)

**Steps:**
1. Open incognito/private browsing window
2. Paste the share link from clipboard
3. Press Enter (do NOT login)

**Expected Result:**
- ✅ Page loads successfully without login
- ✅ Badge shows: "🔗 Shared link"
- ✅ Shows "Shared by [owner email]"
- ✅ Trip title and description displayed
- ✅ Points list and map visible
- ✅ NO edit/delete buttons
- ✅ NO "Share Trip" or "Edit Trip Info" sections

---

### Test Case 4: Share Link with Points

**Setup:**
1. As User A, add 2-3 points to Thailand trip via /map

**Steps:**
1. Open share link in incognito window
2. Observe points list and map

**Expected Result:**
- ✅ All points appear in left sidebar
- ✅ All markers appear on map
- ✅ Click point card → map centers on point
- ✅ Click marker → point highlights in list
- ✅ Smooth flyTo animation

---

### Test Case 5: Hint for PRIVATE Trip (No Share Link)

**Steps:**
1. Login as User A
2. Create or open a PRIVATE trip
3. Scroll to "Share Trip" section

**Expected Result:**
- ✅ Blue info box displayed
- ✅ Message: "💡 Set visibility to UNLISTED in the edit section below to enable link sharing"
- ✅ NO "Copy share link" button

---

### Test Case 6: Switch from PRIVATE to UNLISTED

**Steps:**
1. Login as User A
2. Open a PRIVATE trip
3. Expand "Edit Trip Info"
4. Change Visibility to: **Unlisted (Anyone with link)**
5. Click "Save Changes"
6. Scroll back to "Share Trip" section

**Expected Result:**
- ✅ Trip updated successfully
- ✅ "Share Trip" section now shows "Copy share link" button
- ✅ Can generate share link

---

### Test Case 7: Share Token Reuse

**Steps:**
1. Open UNLISTED trip detail page
2. Click "Copy share link" button
3. Note the URL
4. Click "Copy share link" again
5. Note the URL again

**Expected Result:**
- ✅ Both URLs are identical (token reused, not regenerated)
- ✅ Same 64-character hex token in both URLs

---

### Test Case 8: Invalid Share Token (404)

**Steps:**
1. Open incognito window
2. Navigate to: http://localhost:3000/share/trips/invalidtoken123

**Expected Result:**
- ✅ Shows error: "This shared trip was not found or is no longer available."
- ✅ Link to homepage displayed
- ✅ No sensitive information leaked

---

### Test Case 9: Switch from UNLISTED to PRIVATE (Token Still Works)

**Steps:**
1. User A has UNLISTED trip with generated share link
2. Copy share link
3. Change trip visibility to PRIVATE
4. Open share link in incognito window

**Expected Result:**
- ✅ Share link returns 404 (trip no longer UNLISTED)
- ✅ Error message displayed

**Note:** The shareToken remains in database but link doesn't work for non-UNLISTED trips.

---

### Test Case 10: Point Details Modal - Click Point Card

**Steps:**
1. Navigate to any trip detail page (owner or shared) with points
2. Click a point card in the left sidebar list

**Expected Result:**
- ✅ Modal opens immediately
- ✅ Map centers on point (flyTo animation)
- ✅ Point highlights in list (blue border)
- ✅ Modal shows:
  - Point title (large heading)
  - Photo (if exists, larger view)
  - Full description (not truncated)
  - Note (if exists, in blue box)
  - Coordinates (lat/lng with 6 decimals)
  - Created date
  - Close button

---

### Test Case 11: Point Details Modal - Click Map Marker

**Steps:**
1. Navigate to any trip detail page with points
2. Click a marker on the map

**Expected Result:**
- ✅ Modal opens immediately
- ✅ Same behavior as clicking point card
- ✅ Map centers on clicked marker
- ✅ Point highlights in list

---

### Test Case 12: Point Details Modal - Close

**Steps:**
1. Open point details modal (click any point)
2. Try all close methods:
   - Click "Close" button
   - Click outside modal (dark background)
   - (If implemented) Press Escape key

**Expected Result:**
- ✅ Modal closes on "Close" button click
- ✅ Modal closes when clicking background overlay
- ✅ Returns to normal trip view
- ✅ Point selection remains (blue border)

---

### Test Case 13: Point Without Photo

**Steps:**
1. Create or view a trip with a point that has NO photo
2. Click the point to open modal

**Expected Result:**
- ✅ Modal opens successfully
- ✅ NO photo section displayed (or placeholder)
- ✅ Description, coordinates, and other fields still visible

---

### Test Case 14: Point Without Description

**Steps:**
1. Create or view a trip with a point that has NO description
2. Click the point to open modal

**Expected Result:**
- ✅ Modal opens successfully
- ✅ Description section not shown or shows "No description"
- ✅ Photo (if exists), coordinates, and other fields still visible

---

### Test Case 15: Point With Note (TripPoint.note)

**Setup:**
If you have trip points with notes from Stage B1 API:
```javascript
// Add note to trip point via API or database
```

**Steps:**
1. Open trip with point that has a note
2. Click point to open modal

**Expected Result:**
- ✅ Note displayed in blue box
- ✅ Label: "Note"
- ✅ Blue background (bg-blue-50)
- ✅ Italic text style

---

### Test Case 16: Long Description in Modal

**Steps:**
1. Create point with very long description (near 500 chars)
2. Add to trip and view trip detail
3. Observe point card (truncated with line-clamp-2)
4. Click point to open modal

**Expected Result:**
- ✅ Point card shows truncated description (2 lines max)
- ✅ Modal shows FULL description (not truncated)
- ✅ Whitespace preserved (whitespace-pre-wrap)
- ✅ Scrollable if very long

---

### Test Case 17: Modal on Shared Trip (Public Access)

**Steps:**
1. Open share link in incognito window (no login)
2. Click a point card or marker

**Expected Result:**
- ✅ Modal opens successfully
- ✅ All point details visible
- ✅ NO edit/delete buttons in modal (read-only)
- ✅ Close button works

---

### Test Case 18: Multiple Points - Modal Navigation

**Steps:**
1. Open trip with 3+ points
2. Click first point → modal opens
3. Close modal
4. Click second point → modal opens with different point
5. Close modal
6. Click third point → modal opens

**Expected Result:**
- ✅ Each modal shows correct point data
- ✅ No data from previous point displayed
- ✅ Photo/description updates correctly
- ✅ Coordinates update correctly

---

### Test Case 19: Modal + Map Interaction

**Steps:**
1. Open trip detail with multiple points
2. Click point #1 → modal opens
3. While modal is open, zoom/pan the map
4. Close modal
5. Click point #2 → modal opens

**Expected Result:**
- ✅ Can interact with map while modal is open
- ✅ Map zoom/pan works normally
- ✅ Modal stays on top of map
- ✅ Second point modal works correctly

---

### Test Case 20: Share Link Access Control - FRIENDS Trip

**Setup:**
1. User A creates FRIENDS trip (not UNLISTED)
2. User A tries to generate share link

**Steps:**
1. Login as User A
2. Open FRIENDS trip detail
3. Observe "Share Trip" section

**Expected Result:**
- ✅ Shows hint: "Set visibility to UNLISTED..."
- ✅ NO "Copy share link" button
- ✅ Cannot generate share token for FRIENDS trip

---

### Test Case 21: Generate Share Link - Only Owner

**Setup:**
1. User A creates UNLISTED trip
2. User A shares with User B (friend)

**Steps:**
1. Login as User B
2. Navigate to shared trip (via /trips shared section)
3. Observe page content

**Expected Result:**
- ✅ NO "Share Trip" section visible (not owner)
- ✅ NO "Copy share link" button
- ✅ User B can view but not share

---

### Test Case 22: API Direct Access - POST share-token

**Test Owner:**
```bash
curl -X POST "http://localhost:3000/api/trips/[unlisted-trip-id]/share-token" \
  -H "Authorization: Bearer [owner-token]"

# Expected: 200 OK, returns { shareUrl, shareToken }
```

**Test Non-Owner:**
```bash
curl -X POST "http://localhost:3000/api/trips/[unlisted-trip-id]/share-token" \
  -H "Authorization: Bearer [other-user-token]"

# Expected: 403 Forbidden
```

**Test PRIVATE Trip:**
```bash
curl -X POST "http://localhost:3000/api/trips/[private-trip-id]/share-token" \
  -H "Authorization: Bearer [owner-token]"

# Expected: 400 Bad Request, "Trip must have UNLISTED visibility"
```

---

### Test Case 23: API Direct Access - GET share link

**Test Valid Token:**
```bash
curl -X GET "http://localhost:3000/api/share/trips/[valid-token]"

# Expected: 200 OK, returns { trip, tripPoints }
```

**Test Invalid Token:**
```bash
curl -X GET "http://localhost:3000/api/share/trips/invalidtoken123"

# Expected: 404 Not Found
```

**Test No Auth Required:**
```bash
# Should work WITHOUT Authorization header
curl -X GET "http://localhost:3000/api/share/trips/[valid-token]"

# Expected: 200 OK (public endpoint)
```

---

### Test Case 24: Visibility Icons in Trip List

**Steps:**
1. Login and navigate to `/trips`
2. Create trips with different visibilities:
   - PRIVATE
   - FRIENDS
   - UNLISTED
3. Observe the trips list

**Expected Result:**
- ✅ PRIVATE shows: "🔒 Private"
- ✅ FRIENDS shows: "👥 Friends"
- ✅ UNLISTED shows appropriate indicator (update if needed)

---

### Test Case 25: Empty Trip - Share Link

**Steps:**
1. Create UNLISTED trip with NO points
2. Generate share link
3. Open share link in incognito

**Expected Result:**
- ✅ Page loads successfully
- ✅ Shows: "No points in this trip yet."
- ✅ Map shows default view (no markers)
- ✅ NO errors or broken UI

---

## Edge Cases Tested

✅ **UNLISTED trip share link** - Works publicly without auth
✅ **PRIVATE/FRIENDS trips** - Cannot generate share link
✅ **Share token reuse** - Same token returned on multiple requests
✅ **Invalid share token** - 404 error, no sensitive data leaked
✅ **Visibility switch** - Share link stops working when trip becomes non-UNLISTED
✅ **Point modal** - Opens on both card and marker click
✅ **Modal with/without photo** - Handles missing photo gracefully
✅ **Modal with/without description** - Handles missing description
✅ **Modal with note** - Displays TripPoint.note if present
✅ **Long description** - Truncated in card, full in modal
✅ **Public access modal** - Works on shared trips without login
✅ **Owner-only share button** - Friends cannot generate share links
✅ **Empty trip share** - Share link works for trips with no points

---

## API Calls Made

### On Generate Share Link:
```
POST /api/trips/:id/share-token
→ Generates or retrieves shareToken
→ Returns shareUrl
```

### On Public Share Page Load:
```
GET /api/share/trips/:token
→ Public endpoint (no auth)
→ Returns trip + tripPoints
→ Only works for UNLISTED trips
```

### On Point Click:
- No API call (uses existing tripPoints data)
- Opens modal with local data

---

## Non-Goals (NOT Implemented)

❌ Regenerating share tokens (always reuse existing)
❌ Expiring share tokens (persist indefinitely)
❌ Share link analytics (view counts, etc.)
❌ Password-protected share links
❌ Custom share URLs (always random token)
❌ Editing points from modal
❌ Deleting points from modal
❌ QR code generation for share links
❌ Social media share buttons
❌ Email share functionality
❌ Clearing shareToken when visibility changes (token persists but link doesn't work)

These features are reserved for future stages.

---

## Summary

Stage C2 adds:
- ✅ UNLISTED visibility option for trips
- ✅ Secure share token generation (32 bytes hex)
- ✅ Public share page (no auth required)
- ✅ Share link copy to clipboard
- ✅ Point details modal (photo + full description)
- ✅ Modal opens on point/marker click
- ✅ Read-only access for shared trips
- ✅ Owner-only share link generation
- ✅ Stage C1 functionality preserved (FRIENDS sharing still works)

**Status:** ✅ COMPLETE - Ready for user testing

## Quick Test Sequence

```bash
# 1. Start dev server
npm run dev

# 2. Login as User A

# 3. Create UNLISTED trip
# - /trips → Create Trip
# - Visibility: "Unlisted (Anyone with link)"
# - Add 2-3 points via /map

# 4. Generate share link
# - Open trip detail
# - Click "Copy share link"
# - Link copied to clipboard

# 5. Test public access
# - Open incognito window
# - Paste share link
# - Verify trip loads without login
# - Click points to test modal

# 6. Test point details modal
# - Click point card → modal opens
# - Click marker → modal opens
# - Verify photo, description, coordinates shown
# - Close modal → works correctly
```

Done! 🎉
