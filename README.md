# ShopSense — Milestone 1: Authentication, Role-Based Onboarding & Public Product Catalog

ShopSense is a multi-vendor retail analytics and hardware catalog platform. Milestone 1 establishes the core security, authentication, role-based onboarding workflows, and public product browsing foundations.

---

## Architecture & Technology Stack

### Backend
- **Framework**: FastAPI (Python 3.10+)
- **Validation & Settings**: Pydantic v2 & `pydantic-settings`
- **ORM & Migrations**: SQLAlchemy 2.x & Alembic
- **Database**: PostgreSQL (with connection pooling and strict relational integrity)
- **Security**: Argon2 password hashing (`argon2-cffi`), signed JWT access tokens (`pyjwt`), cryptographically random refresh tokens (SHA-256 hashed in database, rotated upon use, and stored in `HttpOnly`, `SameSite=Lax` cookies)
- **Testing**: `pytest` & FastAPI `TestClient` (isolated test database)

### Frontend
- **Framework**: React 19 with TypeScript
- **Bundler & Dev Server**: Vite
- **Styling**: Tailwind CSS (clean retail analytics dashboard design)
- **Routing & Client Guards**: React Router v7 (`react-router-dom`)
- **HTTP Client**: Centralized Axios client with automatic Bearer token injection and transparent 401 token refresh interceptor
- **State Management**: Idiomatic React `useState` & `useEffect` via custom `AuthContext`

---

## User Roles & Permission Model

| Role | Registration / Creation | Access Scope | Protected Operations |
| :--- | :--- | :--- | :--- |
| **`ADMIN`** | Controlled bootstrap script (`bootstrap_admin.py`) from environment variables. Public registration disabled. | Administrative Console (`/admin`) | Review pending vendor applications (`GET /admin/vendors/pending`), Approve/Reject applications (`PATCH /admin/vendors/{id}/status`). |
| **`VENDOR`** | Public registration (`POST /api/v1/auth/register/vendor`) creating a `PENDING` store profile. | Onboarding Status (`/vendor/onboarding-status`), Dashboard (`/vendor/dashboard`) once `APPROVED`. | Pending/rejected vendors are strictly barred from vendor operations. Approved vendors can manage store profile and publish products (`POST /vendors/me/products`). |
| **`CUSTOMER`** | Public registration (`POST /api/v1/auth/register/customer`). Auto-assigned `CUSTOMER` role. | Public Catalog (`/products`), Product Details (`/products/:id`), Customer Profile. | Direct access without administrative approval. Isolated to own customer resources. |

---

## Database Design & Models

```
┌───────────────────────────┐         1:1           ┌───────────────────────────┐
│           User            │───────────────────────│       VendorProfile       │
├───────────────────────────┤                       ├───────────────────────────┤
│ id (UUID, PK)             │                       │ id (UUID, PK)             │
│ email (Unique, Indexed)   │                       │ user_id (FK, Unique, 1:1) │
│ hashed_password (Argon2)  │                       │ store_name (Indexed)      │
│ full_name                 │                       │ business_email            │
│ role (ADMIN/VENDOR/CUST)  │                       │ business_phone            │
│ account_status (ACT/DIS)  │                       │ business_address          │
│ created_at / updated_at   │                       │ status (PEND/APPR/REJ)    │
└─────────────┬─────────────┘                       └─────────────┬─────────────┘
              │                                                   │ 1:N
     1:1      │       1:N                                         ▼
┌─────────────┴─────────────┐  ┌───────────────────────────┐ ┌───────────────────┐
│      CustomerProfile      │  │   RefreshTokenSession     │ │      Product      │
├───────────────────────────┤  ├───────────────────────────┤ ├───────────────────┤
│ id (UUID, PK)             │  │ id (UUID, PK)             │ │ id (UUID, PK)     │
│ user_id (FK, Unique, 1:1) │  │ user_id (FK, Indexed)     │ │ vendor_id (FK)    │
│ phone_number              │  │ token_hash (SHA-256, Uniq)│ │ title (Indexed)   │
│ shipping_address          │  │ expires_at (Indexed)      │ │ description       │
│ created_at / updated_at   │  │ revoked (Boolean)         │ │ price (Numeric)   │
└───────────────────────────┘  │ replaced_by (Hash)        │ │ category (Indexed)│
                               │ created_at                │ │ is_published (Idx)│
                               └───────────────────────────┘ └───────────────────┘
```

---

## Installation & Setup

### 1. Prerequisites
- **Python**: 3.10 or higher
- **Node.js**: 18 or higher (tested with Node v24 / npm 11)
- **PostgreSQL**: PostgreSQL 14+ instance running locally or remotely

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure your database credentials and secret key are set in `.env`:
```ini
ENVIRONMENT=development
DEBUG=True

DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5433/shopsense_dev
TEST_DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5433/shopsense_test

JWT_SECRET_KEY=replace-with-a-secure-secret-key-at-least-32-chars
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

INITIAL_ADMIN_EMAIL=admin@shopsense.internal
INITIAL_ADMIN_PASSWORD=AdminSecure123!
INITIAL_ADMIN_NAME=Platform Administrator
```

### 3. Backend Setup
Create and activate virtual environment:
```bash
python -m venv venv
# On Windows PowerShell:
.\venv\Scripts\Activate.ps1
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
```

### 4. Database Migrations
Apply Alembic migrations to create the schema:
```bash
alembic -c backend/alembic.ini upgrade head
```

### 5. Bootstrap Initial Administrator & Seed Catalog
Create the initial administrator account (controlled bootstrap) and seed demo products:
```bash
python -m backend.scripts.bootstrap_admin
python -m backend.scripts.seed_data
```

### 6. Frontend Setup
```bash
cd frontend
npm install
npm run build
```

---

## Running the Application

### Start the FastAPI Backend
From the repository root:
```bash
.\venv\Scripts\uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```
- API Documentation (Swagger UI): [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- API Health Check: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

### Start the React Frontend
In a separate terminal:
```bash
cd frontend
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Running Automated Tests

Run the complete test suite using pytest:
```bash
.\venv\Scripts\pytest -v
```

### Test Coverage Highlights (26/26 tests passing)
- ✅ Customer registration with profile creation and email normalization
- ✅ Vendor registration with store details and initial `PENDING` status
- ✅ Rejection of duplicate email registrations (409 Conflict)
- ✅ Input validation for passwords and malformed emails (422)
- ✅ Verification that passwords are Argon2 hashed and never plaintext
- ✅ Immunity against public role escalation (`role=ADMIN` ignored/rejected)
- ✅ Login authentication and HttpOnly refresh token cookie issuance
- ✅ Rejection of invalid credentials (401) and disabled accounts (403)
- ✅ Handling of expired and forged access tokens
- ✅ Secure refresh token rotation, revocation, and reuse detection
- ✅ Complete logout revoking refresh session
- ✅ Admin-only endpoint protection (`/admin/vendors/pending`)
- ✅ Strict barring of pending and rejected vendors from vendor operations
- ✅ Full authorization of approved vendors with active accounts
- ✅ Resource isolation between separate vendors (multi-tenant safety)
- ✅ Customer profile resource isolation
- ✅ Public product catalog browsing and details without login
- ✅ Strict exclusion of unpublished products from public catalog
- ✅ Strict rejection of invalid onboarding transitions (e.g. APPROVED -> REJECTED)

---

## API Endpoints Reference

### Authentication (`/api/v1/auth`)
- `POST /register/customer`: Register a customer account
- `POST /register/vendor`: Register a vendor account (`PENDING` status)
- `POST /login`: Authenticate and receive access token + HttpOnly cookie
- `POST /refresh`: Rotate refresh token and obtain new access token
- `POST /logout`: Invalidate refresh token session and clear cookie
- `GET /me`: Get authenticated user profile and roles

### Vendor Onboarding & Operations (`/api/v1/vendors`)
- `GET /me/onboarding-status`: Check current onboarding review status
- `GET /me/profile`: Retrieve approved store profile
- `PATCH /me/profile`: Update store profile details
- `GET /me/products`: List products owned by this vendor
- `POST /me/products`: Add new product to catalog

### Administrative Operations (`/api/v1/admin`)
- `GET /vendors/pending`: List all vendor applications awaiting review
- `PATCH /vendors/{vendor_id}/status`: Approve or reject vendor application

### Public Catalog Foundation (`/api/v1/products`)
- `GET /`: Search, filter, and paginate published catalog products
- `GET /{product_id}`: View published product specifications
