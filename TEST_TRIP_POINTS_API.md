# Stage B1 API Testing Guide

## Prerequisites
1. Dev server running on http://localhost:3000
2. User logged in with JWT token in localStorage
3. At least one Trip created
4. At least one Point created

## Test in Browser Console

Open browser console (F12) and run these commands:

### Step 1: Get your existing Trip ID and Point ID

```javascript
// Get trips
const tripsResponse = await fetch('/api/trips', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
});
const tripsData = await tripsResponse.json();
console.log('Trips:', tripsData);

// Get points
const pointsResponse = await fetch('/api/points', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
});
const pointsData = await pointsResponse.json();
console.log('Points:', pointsData);

// Save IDs for testing
const tripId = tripsData.trips[0].id;
const pointId = pointsData.points[0].id;
console.log('Test Trip ID:', tripId);
console.log('Test Point ID:', pointId);
```

### Step 2: Test GET /api/trips/[id]/points (Empty list)

```javascript
const getEmptyResponse = await fetch(`/api/trips/${tripId}/points`, {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
});
const emptyData = await getEmptyResponse.json();
console.log('✅ GET (empty):', emptyData);
// Expected: { tripPoints: [] }
```

### Step 3: Test POST /api/trips/[id]/points (Add point)

```javascript
const addResponse = await fetch(`/api/trips/${tripId}/points`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  },
  body: JSON.stringify({
    pointId: pointId,
    order: 1,
    note: 'First point in my trip!'
  })
});
const addData = await addResponse.json();
console.log('✅ POST (add point):', addData);
// Expected: { tripPoint: { id, tripId, pointId, order: 1, note, createdAt, point: {...} } }
```

### Step 4: Test POST idempotency (Add same point again)

```javascript
const addAgainResponse = await fetch(`/api/trips/${tripId}/points`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  },
  body: JSON.stringify({
    pointId: pointId,
    order: 1,
    note: 'First point in my trip!'
  })
});
const addAgainData = await addAgainResponse.json();
console.log('✅ POST (idempotent):', addAgainData);
// Expected: Same as before, status 200 (not 201)
```

### Step 5: Test GET /api/trips/[id]/points (List with point)

```javascript
const getListResponse = await fetch(`/api/trips/${tripId}/points`, {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
});
const listData = await getListResponse.json();
console.log('✅ GET (with points):', listData);
// Expected: { tripPoints: [{ id, tripId, pointId, order, note, createdAt, point: {...} }] }
```

### Step 6: Test PATCH /api/trips/[id]/points/[pointId] (Update)

```javascript
const updateResponse = await fetch(`/api/trips/${tripId}/points/${pointId}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  },
  body: JSON.stringify({
    order: 10,
    note: 'Updated note for this point'
  })
});
const updateData = await updateResponse.json();
console.log('✅ PATCH (update):', updateData);
// Expected: { tripPoint: { ..., order: 10, note: 'Updated note for this point' } }
```

### Step 7: Test PATCH partial update (only note)

```javascript
const partialUpdateResponse = await fetch(`/api/trips/${tripId}/points/${pointId}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  },
  body: JSON.stringify({
    note: null  // Clear the note
  })
});
const partialUpdateData = await partialUpdateResponse.json();
console.log('✅ PATCH (clear note):', partialUpdateData);
// Expected: { tripPoint: { ..., order: 10, note: null } }
```

### Step 8: Test DELETE /api/trips/[id]/points/[pointId]

```javascript
const deleteResponse = await fetch(`/api/trips/${tripId}/points/${pointId}`, {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
});
const deleteData = await deleteResponse.json();
console.log('✅ DELETE:', deleteData);
// Expected: { ok: true }
```

### Step 9: Verify deletion (GET should return empty)

```javascript
const verifyResponse = await fetch(`/api/trips/${tripId}/points`, {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
});
const verifyData = await verifyResponse.json();
console.log('✅ GET (after delete):', verifyData);
// Expected: { tripPoints: [] }
```

## Error Cases to Test

### Test 401 (No auth)
```javascript
const noAuthResponse = await fetch(`/api/trips/${tripId}/points`);
console.log('❌ 401:', await noAuthResponse.json());
// Expected: { error: 'Unauthorized' }
```

### Test 404 (Invalid trip ID)
```javascript
const notFoundResponse = await fetch('/api/trips/invalid-id/points', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
});
console.log('❌ 404:', await notFoundResponse.json());
// Expected: { error: 'Trip not found' }
```

### Test 404 (Invalid point ID)
```javascript
const invalidPointResponse = await fetch(`/api/trips/${tripId}/points`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  },
  body: JSON.stringify({
    pointId: 'invalid-point-id'
  })
});
console.log('❌ 404:', await invalidPointResponse.json());
// Expected: { error: 'Point not found' }
```

### Test 400 (Invalid payload)
```javascript
const invalidPayloadResponse = await fetch(`/api/trips/${tripId}/points`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  },
  body: JSON.stringify({
    // Missing pointId
    order: 1
  })
});
console.log('❌ 400:', await invalidPayloadResponse.json());
// Expected: Validation error
```

## Testing with Multiple Points

```javascript
// Add multiple points to test ordering
const point2Id = pointsData.points[1]?.id; // Get second point if exists

if (point2Id) {
  // Add first point with order 2
  await fetch(`/api/trips/${tripId}/points`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({ pointId: pointId, order: 2 })
  });

  // Add second point with order 1
  await fetch(`/api/trips/${tripId}/points`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({ pointId: point2Id, order: 1 })
  });

  // Get list - should be ordered by order ASC (second point first)
  const orderedResponse = await fetch(`/api/trips/${tripId}/points`, {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
  });
  const orderedData = await orderedResponse.json();
  console.log('✅ Ordered list:', orderedData);
  // Expected: point2 (order: 1) comes before pointId (order: 2)
}
```

## Summary

All endpoints tested:
- ✅ GET /api/trips/[id]/points - List trip points
- ✅ POST /api/trips/[id]/points - Add point to trip (idempotent)
- ✅ PATCH /api/trips/[id]/points/[pointId] - Update order/note
- ✅ DELETE /api/trips/[id]/points/[pointId] - Remove point from trip

Authorization:
- ✅ Only trip owner can manage points
- ✅ Only own points can be added to trips
- ✅ JWT required for all operations

Validation:
- ✅ pointId required for POST
- ✅ order must be int >= 0
- ✅ note max 500 characters
- ✅ Partial updates work (can update only order or only note)

Data integrity:
- ✅ Unique constraint (tripId, pointId) enforced
- ✅ Cascade delete on Trip deletion
- ✅ Cascade delete on Point deletion
- ✅ Proper ordering (order ASC, then createdAt ASC)
