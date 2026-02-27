# File Drive

File Drive is a web application for authenticated file upload and sharing.

## Current Features

- Authentication and user session management with Clerk
- File upload to Firebase Storage with unique per-user/per-file storage paths
- Client-side AES-GCM encryption before upload
- Upload metadata saved in Firestore
- File list dashboard with preview, download, and share-link actions
- Share settings per file: permission mode (`view`, `download`, `view + download`)
- Share settings per file: expiry (`24h`, `7d`, `never`) and link revoke/restore
- Public share route (`/share/[id]`) that enforces revoke, expiry, and permission checks
- Decryption flow on shared file page using key from URL hash (`#k=...`) or manual input
- Protected routes for upload and files pages

## Thesis Alignment

This repository currently demonstrates the core workflow:

- sign in
- upload file
- view uploaded files
- share file URL

The following advanced feature is still planned for a subsequent phase:

- richer access/audit notifications

## Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- Clerk
- Firebase Firestore
- Firebase Storage
- React Toastify

## Local Development

```bash
npm install
npm run dev
```

Validation:

```bash
npm run lint
npm run build
```

## Links

- Repository: <https://github.com/emmanueldonkor/file-drive>
- Live Site: <https://file-drive-gray.vercel.app/>
