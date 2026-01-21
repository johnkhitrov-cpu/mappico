# Authentication Testing Guide

## Overview
This guide provides step-by-step instructions to manually test the email+password authentication system with JWT in the Mappico application.

## Prerequisites
- Server running on http://localhost:3000
- Browser with developer tools (for inspecting localStorage)

## Test Scenarios

### 1. Test User Registration

#### Steps:
1. Open browser and navigate to http://localhost:3000/register
2. You should see a registration form with:
   - Email input field
   - Password input field (minimum 6 characters)
   - "Create account" button
   - Link to login page

3. **Test Case 1: Successful Registration**
   - Enter email: `test@example.com`
   - Enter password: `password123`
   - Click "Create account"
   - **Expected Result**:
     - Success message appears: "Registration successful! Redirecting to login..."
     - After 2 seconds, automatically redirected to `/login`

4. **Test Case 2: Invalid Email**
   - Enter email: `invalid-email`
   - Enter password: `password123`
   - Click "Create account"
   - **Expected Result**: Error message "Invalid email format"

5. **Test Case 3: Short Password**
   - Enter email: `test2@example.com`
   - Enter password: `12345` (less than 6 characters)
   - Click "Create account"
   - **Expected Result**: Error message "Password must be at least 6 characters long"

6. **Test Case 4: Duplicate Email**
   - Enter email: `test@example.com` (already registered)
   - Enter password: `password123`
   - Click "Create account"
   - **Expected Result**: Error message "User with this email already exists"

### 2. Test User Login

#### Steps:
1. Navigate to http://localhost:3000/login
2. You should see a login form with:
   - Email input field
   - Password input field
   - "Sign in" button
   - Link to register page

3. **Test Case 1: Successful Login**
   - Enter email: `test@example.com`
   - Enter password: `password123`
   - Click "Sign in"
   - **Expected Result**:
     - No error message
     - Redirected to `/map` page
     - Mapbox map loads successfully

4. **Verify Token Storage**
   - Open browser Developer Tools (F12)
   - Go to "Application" tab → "Local Storage" → http://localhost:3000
   - **Expected Result**: You should see:
     - `token`: JWT token string (long encrypted string)
     - `user`: JSON object with `{ id, email }`

5. **Test Case 2: Invalid Credentials**
   - Enter email: `test@example.com`
   - Enter password: `wrongpassword`
   - Click "Sign in"
   - **Expected Result**: Error message "Invalid email or password"

6. **Test Case 3: Non-existent User**
   - Enter email: `nonexistent@example.com`
   - Enter password: `password123`
   - Click "Sign in"
   - **Expected Result**: Error message "Invalid email or password"

### 3. Test Navigation Changes

#### Steps:
1. **When NOT Logged In**:
   - Navigate to http://localhost:3000
   - **Expected Result**: Navigation shows:
     - Home
     - Login
     - Register

2. **When Logged In**:
   - Log in successfully
   - **Expected Result**: Navigation shows:
     - Home
     - Map
     - Friends
     - Logout button (red on hover)

### 4. Test Logout Functionality

#### Steps:
1. Ensure you are logged in (complete login test first)
2. Click "Logout" button in navigation
3. **Expected Result**:
   - Redirected to `/login` page
   - Navigation changes back to show Login/Register

4. **Verify Token Removal**:
   - Open Developer Tools → Application → Local Storage
   - **Expected Result**: Both `token` and `user` should be removed

5. **Verify Session Ended**:
   - Try to navigate to `/map` manually
   - **Expected Result**: Page loads but you're not authenticated (can implement route protection later)

### 5. Test JWT Token Structure

#### Steps:
1. Log in successfully
2. Open Developer Tools → Application → Local Storage
3. Copy the `token` value
4. Go to https://jwt.io
5. Paste the token in the "Encoded" field
6. **Expected Result** in "Decoded" section:
   ```json
   {
     "userId": "<user_id>",
     "email": "test@example.com",
     "iat": <timestamp>,
     "exp": <timestamp> // 7 days from iat
   }
   ```

### 6. Test API Endpoints Directly (Optional)

#### Using Browser Console or Postman:

**Register Endpoint:**
```javascript
fetch('http://localhost:3000/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'api-test@example.com',
    password: 'testpass123'
  })
})
.then(r => r.json())
.then(console.log)
```
Expected response: `{ ok: true }`

**Login Endpoint:**
```javascript
fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'api-test@example.com',
    password: 'testpass123'
  })
})
.then(r => r.json())
.then(console.log)
```
Expected response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clxxxxx",
    "email": "api-test@example.com"
  }
}
```

## Database Verification

### Using Prisma Studio:
1. Run `npx prisma studio` in terminal
2. Navigate to http://localhost:5555 (or the port shown)
3. Click on "User" model
4. **Expected Result**:
   - See all registered users
   - `email` field should be unique
   - `passwordHash` should be bcrypt-hashed (starts with `$2a$` or `$2b$`)
   - `createdAt` timestamp should be set

## Common Issues and Solutions

### Issue 1: "JWT_SECRET is not defined"
- **Solution**: Ensure `.env.local` has `JWT_SECRET` defined
- Restart the Next.js dev server after adding it

### Issue 2: "Module not found: Can't resolve '@/lib/prisma'"
- **Solution**: Run `npx prisma generate` to regenerate Prisma Client

### Issue 3: Navigation doesn't update after login
- **Solution**: Hard refresh the page (Ctrl+Shift+R) or check browser console for errors

### Issue 4: CORS errors when testing API
- **Solution**: Ensure you're testing from the same origin (localhost:3000)

## Security Checklist

- ✅ Passwords are hashed with bcrypt (not stored in plain text)
- ✅ JWT tokens expire after 7 days
- ✅ Email validation prevents invalid formats
- ✅ Password minimum length enforced (6 characters)
- ✅ Duplicate email registration prevented
- ✅ Token stored in localStorage (client-side only)
- ✅ Generic error messages for login (doesn't reveal if email exists)

## Next Steps

After testing is complete, consider implementing:
1. Protected routes (middleware to check token)
2. Token refresh mechanism
3. Password reset functionality
4. Email verification
5. Remember me functionality
6. Session timeout warnings
