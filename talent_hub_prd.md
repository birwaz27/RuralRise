# Product Requirements Document (PRD) — Rural Talent Hub

**Version:** 2.0  
**Platform:** Full-Stack Web Application (React/Next.js, Node.js, Express, MongoDB)  
**Industry:** Sports Tech & Rural Talent Discovery  
**Color Theme:** #2563EB (Electric Blue / Primary Brand Accent)  
**Prepared for:** Internal Development & PBL Presentation Reference  

---

## 1. Product Overview

Rural Talent Hub is a web-based platform that enables rural athletes, coaches, and sports scouts to discover, showcase, verify, and connect with regional sports opportunities. The platform supports user registration and role-based access, athlete profile creation and discovery, profile verification workflows, and secure credential handling—all within a clean, modern dashboard experience.

**Tagline:** *Discover. Showcase. Connect.*

---

## 2. Tech Stack

| Layer | Choice |
| :--- | :--- |
| **Frontend Framework** | React / Next.js |
| **Styling** | Tailwind CSS |
| **Backend** | Node.js + Express |
| **Database** | MongoDB Atlas (Mongoose ODM) |
| **Auth** | Email-based only (No OAuth) |
| **Hosting (Frontend)** | Vercel |
| **Hosting (Backend)** | Render / Railway |
| **Hosting (DB)** | MongoDB Atlas |

---

## 3. Features Map

### 1. Authentication
* **Email & Password Signup:** New user registration with role selection (Talent vs. Host/Scout).
* **Email & Password Login:** Secure authentication returning session credentials.
* **Password Recovery:** Request flow for resetting forgotten credentials.
* **Session Management:** Token-based access control protecting dashboard routes.

### 2. Athlete & Talent Management
* **Profile Creation & Editing:**
  * Personal information (Full Name, Age, Sport Category, District/Region).
  * Sports background, tournament history, and personal bio.
  * Media & photo upload support (PNG/JPG, max 2MB).
* **Talent Directory & Discovery:**
  * Real-time search bar (filter by athlete name or sport).
  * Regional and category filter options.
  * Responsive card grid view with status badges.
* **Verification Workflow:**
  * Pending review status for newly submitted profiles.
  * Verified Talent badge granted and managed by authorized hosts/scouts.

### 3. Role-Based Dashboards
* **Talent Dashboard:** Space for athletes to manage their public profile, view verification status, and update their stats.
* **Host / Scout Dashboard:** Command center for scouts to review incoming talent registrations, verify authentic profiles, and manage shortlists.

### 4. Contact & Communication
* **Expression of Interest:** Connect button on athlete profiles allowing verified scouts to initiate contact or bookmark talent.

---

## 4. Plans & Limits (Platform Tiers)

* **Free / Standard Tier**
  * Basic athlete profile listing
  * Standard search and filter access
  * Email support
* **Verified / Pro Tier**
  * Priority profile placement in discovery grid
  * Direct messaging/connection with verified scouts
  * Advanced analytics on profile views

---

## 5. Public Pages — Detailed Spec

### 5.1 Home Page (`/`)
* **Navbar:**
  * Logo: Rural Talent Hub wordmark + icon (left)
  * Nav links: Home, Talent Pool, About, Contact
  * CTA buttons: Login (ghost) + Join Platform (filled, `#2563EB`)
  * Sticky on scroll with backdrop blur
* **Hero Section:**
  * Headline: *"Discover Hidden Rural Sports Talent"*
  * Subheadline: *"Empowering grassroots athletes by connecting them directly with verified scouts and sports hosts."*
  * Primary CTA: *Explore Athletes* -> `/athletes`
  * Secondary CTA: *Join Platform* -> `/register`
  * Hero visual: Mockup of the athlete directory / dashboard
* **Features Section:**
  * 3 feature cards, each with icon + title + short description
  * Features highlighted: Verified Profiles, Direct Scouting, Transparent Regional Networking
* **How It Works Section:**
  * 3-step visual flow: 1. Sign Up -> 2. Create Profile & Add Stats -> 3. Get Discovered & Verified
* **CTA Banner:**
  * Full-width section: *"Ready to showcase your talent?"*
  * Button: *Get Started Free*
* **Footer:**
  * Links: Home, Talent Pool, About, Contact, Privacy Policy
  * Copyright: © 2026 Rural Talent Hub

### 5.2 Auth Pages (`/login`, `/register`)
* **Login (`/login`):** Email & Password fields, Submit button, link to register.
* **Register (`/register`):** Username, Email, Password, Role selector (Talent / Host), Submit button.

### 5.3 Athlete Directory & Profiles (`/athletes`, `/athletes/:id`)
* **Directory Grid:** Responsive card layout displaying athlete photo, name, sport badge, district, and quick "View Profile" action.
* **Detail Page:** Comprehensive view of athlete bio, achievements, verification status, and connect button.

---

## 6. API Architecture

* **Base URL:** `/api`
* **Standard Response Shape:**
  * Success: `{ "success": true, "data": { ... } }`
  * Error: `{ "success": false, "error": { "code": "ERROR_CODE", "message": "Human readable", "fields": {} } }`

### 6.1 Core Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **POST** | `/api/register` | Create new user account (Email + Password + Role) |
| **POST** | `/api/login` | Authenticate user and return session info |
| **GET** | `/api/athletes` | Retrieve all registered athlete profiles |
| **POST** | `/api/athletes` | Submit a new athlete profile to the database |
| **GET** | `/api/athletes/:id` | Fetch specific athlete details by ID |

---

## 7. Data Models (Mongoose Schemas)

### **User Model**
```json
{
  "_id": "ObjectId",
  "email": "String, unique index",
  "passwordHash": "String, bcrypt hashed",
  "role": "String, enum: ['talent', 'host', 'admin']",
  "createdAt": "Date",
  "updatedAt": "Date"
}