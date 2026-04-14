# First-Time Admin Setup Guide

After deploying Firebase Functions and Firestore, follow these steps once to grant
yourself admin access to the Dress Shop admin panel.

---

## Step 1 — Register your account in the app

Open the app, go to the Login page and sign in (or sign up) with the email you want
to make admin. This creates the Firebase Auth user record.

---

## Step 2 — Download the Firebase service account key

1. Go to [Firebase Console](https://console.firebase.google.com) → select project **halleycomet-7cd48**
2. Click the ⚙️ gear icon → **Project Settings**
3. Open the **Service accounts** tab
4. Click **Generate new private key** → confirm → a JSON file downloads
5. Rename it to `serviceAccountKey.json` and move it into the `scripts/` folder:

```
dress-shop/
  scripts/
    serviceAccountKey.json   ← place it here
    setAdmin.js
```

> ⚠️ This file contains a private key. It is already listed in `.gitignore` and must
> NEVER be committed to source control or shared with anyone.

---

## Step 3 — Install firebase-admin (one time)

Open a terminal in the `scripts/` folder:

```bash
cd c:\Users\001A5G744\Desktop\Ashok\project-work\dress-shop\scripts
npm init -y
npm install firebase-admin
```

---

## Step 4 — Run the setAdmin script

```bash
node setAdmin.js your-email@example.com
```

Expected output:
```
✅ Admin claim granted to: your-email@example.com (uid: abc123...)
   The user must sign out and sign back in for the claim to take effect.
```

---

## Step 5 — Sign out and sign back in

The `isAdmin: true` custom claim is embedded in the Firebase ID token.
The new token is only issued on the **next login**, so:

1. Open the app
2. Click your avatar → **Logout**
3. Log back in with the same email

You will now see the **Admin** link in the side menu and have full access to:
- Add / delete products
- View all orders
- Update order status

---

## Granting Admin to Additional Users

Once you are an admin, you can grant admin to other users without running the script again.
Call the Cloud Function directly using a REST client (e.g. Postman):

```
POST https://asia-south1-halleycomet-7cd48.cloudfunctions.net/apiSetAdminClaim
Authorization: Bearer <your-id-token>
Content-Type: application/json

{
  "targetUid": "<uid-of-user-to-promote>",
  "isAdmin": true
}
```

To get a user's UID: Firebase Console → Authentication → find the user → copy UID.  
To get your own ID token temporarily: open browser DevTools on the app → Application →
Session Storage → or add `console.log(await authService.getIdToken())` temporarily.

To **revoke** admin, send the same request with `"isAdmin": false`.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `Cannot find module './serviceAccountKey.json'` | File is missing from `scripts/` — repeat Step 2 |
| `There is no user record corresponding to the provided email` | User hasn't signed up in the app yet — repeat Step 1 |
| Admin link still not visible after login | Sign out and sign in again — token needs to refresh |
| `Admin access required` error in app | Token is stale — sign out and sign in |
