# Talent Hub API

The API is served under `/api`. Set the variables in `.env.example` in a local
`.env` file before starting the server. MongoDB must be available; SMTP settings
are required to send password-recovery messages.

## Responses

Successful requests return `{ "success": true, "data": ... }`. Errors return
`{ "success": false, "error": { "code": "...", "message": "...", "fields": {} } }`.
Protected routes use `Authorization: Bearer <accessToken>`.

## Routes

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/register` | Public | Create a talent, host/scout, or PE Teacher account |
| POST | `/api/login` | Public | Authenticate and return an access token |
| POST | `/api/password/forgot` | Public | Send a time-limited password reset token by email |
| POST | `/api/password/reset` | Public | Set a new password with the reset token |
| GET | `/api/admin/hosts` | Admin | List hosts filtered by verification status |
| PUT | `/api/admin/hosts/:id/verification` | Admin | Approve or reject a host/scout account |
| PUT | `/api/admin/athletes/:id/tier` | Admin | Assign `standard` or `pro`; Pro profiles are prioritized |
| GET | `/api/athletes` | Public | Search and filter profiles (`search`, `sport`, `district`, `region`, `status`, `page`, `limit`) |
| POST | `/api/athletes` | Talent | Create the signed-in talent's profile |
| GET | `/api/athletes/:id` | Public | Get an athlete profile |
| GET | `/api/athletes/:id/analytics` | Profile owner on Pro, or admin | View total profile requests |
| PATCH | `/api/athletes/:id` | Owner or admin | Edit profile details; edits return verification to pending |
| PUT | `/api/athletes/:id/verification` | Verified host or admin | Set verification to `verified` or `rejected` |
| POST | `/api/athletes/:id/photo` | Owner or admin | Upload a PNG/JPG photo up to 2 MB as multipart field `photo` |
| GET | `/api/athletes/:id/photo` | Public | Retrieve the profile photo |
| GET/POST | `/api/athletes/shortlist` | Verified host or admin | List or add a profile to the signed-in user's shortlist |
| DELETE | `/api/athletes/shortlist/:athleteId` | Verified host or admin | Remove a profile from the shortlist |
| POST | `/api/connections/:athleteId` | Verified host | Send a connection request to a verified athlete (`message`) |
| GET | `/api/connections` | Signed-in user | List received talent requests or sent host requests |
| PATCH | `/api/connections/:id` | Receiving talent | Accept or reject a pending request |

Scouts can register directly. Organization domains ending in `.gov.in` or
`.org.in` are automatically verified; other scouts receive read-only access to
public athlete discovery until an administrator verifies their organization.
Players are verified immediately. PE Teachers using `.edu.in`, `.ac.in`,
`.gov.in`, or `.nic.in` addresses are verified automatically; other accounts
remain pending review.

Use `npm run dev` for development, `npm run build` to compile, `npm test` to run
the API integration tests, and `npm run seed` to create the configured admin
account. The seed command requires `SEED_ADMIN_USERNAME`, `SEED_ADMIN_EMAIL`,
and `SEED_ADMIN_PASSWORD`.

To reset the password for the existing admin identified by `SEED_ADMIN_EMAIL`,
set a new `SEED_ADMIN_PASSWORD` in `.env` and run `npm run reset-admin-password`.

Profile views count successful profile-detail requests. Pro entitlements are
assigned by an admin; subscription checkout and billing are not part of this API.
