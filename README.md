# NetPro MLM Platform — Decoupled Architecture

This repository has been fully decoupled into two standalone services: `frontend` and `backend`. All shared monorepo workspace package dependencies have been resolved and embedded locally within each service, making them production-ready and independent of the parent Replit structure.

## Summary of Architectural Changes

### 1. Standalone Frontend (`/frontend`)
* **Shared API Client Integration**: The legacy `@workspace/api-client-react` package was migrated and integrated directly into `frontend/src/api-client`.
* **TypeScript & Vite Aliases**: Configured the build system to resolve `@/api-client` to the local folder, stripping out the workspace paths in `tsconfig.json`.
* **API Route Resolution Fix (`apiFetch`)**: Manual endpoints inside pages like `dashboard.tsx` and `admin.tsx` that used relative `fetch("/api/...")` requests were failing in decoupled environments since they did not target the backend server. We introduced `apiFetch` in `frontend/src/lib/api-fetch.ts` to automatically:
  1. Prepend `VITE_API_URL` to route requests to the decoupled backend URL.
  2. Inject `credentials: "include"` for cross-origin cookie-based session management.

### 2. Standalone Backend (`/backend`)
* **Database & Schema Integration**: The `@workspace/db` schema definitions and connection configuration have been moved directly into `backend/src/db`.
* **API Schemas Integration**: Zod contracts from `@workspace/api-zod` have been moved to `backend/src/api-zod`.
* **Drizzle Sync Support**: Created a local `backend/drizzle.config.ts` configuration file so schema updates (`pnpm run db:push`) can be run directly inside the backend repository context.
* **Standalone TypeScript Build**: Replaced monorepo references in `tsconfig.json` and resolved all dependencies locally (including adding missing types and packages like `pg`, `drizzle-zod`, and `zod` directly to the backend).

---

## Service Setup & Execution

### Backend
1. **Environment Setup**:
   Create a `.env` file inside `backend/` with the following variables:
   ```env
   PORT=8080
   DATABASE_URL=your_supabase_postgresql_url
   SESSION_SECRET=your_express_session_secret
   PLATFORM_USDT_ADDRESS=your_platform_receiving_usdt_address
   STRIPE_SECRET_KEY=your_stripe_api_key
   FRONTEND_URL=http://localhost:5173
   ```
2. **Install & Run**:
   ```bash
   cd backend
   pnpm install
   pnpm run build
   pnpm run dev
   ```

### Frontend
1. **Environment Setup**:
   Create a `.env` file inside `frontend/` with the VITE endpoint targeting the backend:
   ```env
   VITE_API_URL=http://localhost:8080
   ```
2. **Install & Run**:
   ```bash
   cd frontend
   pnpm install
   pnpm run dev
   ```

---

## Manual USDT Deposit & Activation Flow
1. **Deposit Request**: A user submits a deposit form from the dashboard with their blockchain network, sender wallet address, and screenshot proof.
2. **Admin Approval**: Under the **USDT Deposits** tab in the Admin panel, the admin reviews pending deposits. Upon clicking **Approve**:
   * The backend generates 2x activation coupons associated with the member.
   * The member's wallet balance is credited.
   * Financial ledger and activity records are updated.
3. **Activation**: The user uses the generated coupons from their dashboard to activate their account, which triggers tree placement and commission distribution.
