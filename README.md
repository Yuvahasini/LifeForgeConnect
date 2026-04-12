<div align="center">

```
██╗     ██╗███████╗███████╗███████╗ ██████╗ ██████╗  ██████╗ ███████╗
██║     ██║██╔════╝██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔════╝ ██╔════╝
██║     ██║█████╗  █████╗  █████╗  ██║   ██║██████╔╝██║  ███╗█████╗
██║     ██║██╔══╝  ██╔══╝  ██╔══╝  ██║   ██║██╔══██╗██║   ██║██╔══╝
███████╗██║██║     ███████╗██║     ╚██████╔╝██║  ██║╚██████╔╝███████╗
╚══════╝╚═╝╚═╝     ╚══════╝╚═╝      ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝
                        C O N N E C T
```

### *Every second counts. Every match saves a life.*

[![MIT License](https://img.shields.io/badge/License-MIT-red.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python-green)](https://fastapi.tiangolo.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-darkgreen)](https://supabase.com)

</div>

---

## The Problem

India faces critical healthcare coordination failures:

| Crisis | Scale |
|--------|-------|
| Blood units needed annually | **5 crore** (50 million) |
| Premature babies needing donor milk | **27 million/year** |
| Thalassemia patients requiring transfusions | **1 lakh+** |
| Organ transplant waitlist | **5 lakh+** patients |

**Donors exist. Patients exist. The bridge doesn't.**

LifeForge Connect is built to end this.

---

## What is LifeForge Connect?

A unified donor-patient matching platform with **5 specialized modules**:

| Module | Purpose | Status |
|--------|---------|--------|
| **BloodBridge** | Blood donation matching with urgency tiers | Active |
| **PlateletAlert** | Platelet donation for cancer/dengue patients | Active |
| **MilkBridge** | Breast milk donation for NICU babies | Active |
| **ThalCare** | Thalassemia transfusion support network | Active |
| **LifeForge AI** | AI assistant for donor guidance | Active |

---

## Tech Stack

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND                                │
│  React 18 · TypeScript · Vite · Tailwind CSS · Framer Motion│
│  shadcn/ui · React Router · Sonner (toasts)                 │
├─────────────────────────────────────────────────────────────┤
│                       BACKEND                                │
│  FastAPI (Python) · Pydantic · Uvicorn                      │
├─────────────────────────────────────────────────────────────┤
│                      DATABASE                                │
│  Supabase (PostgreSQL) · Row Level Security                 │
├─────────────────────────────────────────────────────────────┤
│                     INTEGRATIONS                             │
│  Twilio SMS · Google Gemini AI · Supabase Auth              │
└─────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
LifeForgeConnect/
├── FRONTEND/                    # React + TypeScript frontend
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── milk/            # MilkBridge module components (7 files)
│   │   │   ├── ui/              # shadcn/ui components
│   │   │   ├── Navbar.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── ...
│   │   ├── pages/               # Route pages
│   │   │   ├── BloodBridge.tsx  # Blood donation module
│   │   │   ├── PlateletAlert.tsx# Platelet donation module
│   │   │   ├── MilkBridge.tsx   # Breast milk donation module
│   │   │   ├── ThalCare.tsx     # Thalassemia support module
│   │   │   ├── LifeForgeAI.tsx  # AI chat assistant
│   │   │   ├── Dashboard.tsx    # User dashboard
│   │   │   ├── Register.tsx     # Donor/Hospital registration
│   │   │   ├── Login.tsx        # Authentication
│   │   │   └── Index.tsx        # Landing page
│   │   ├── lib/
│   │   │   └── api.ts           # API client with all endpoints
│   │   └── hooks/
│   │       └── AuthContext.tsx  # Authentication context
│   └── .env                     # VITE_API_URL
│
├── backend/                     # FastAPI Python backend
│   ├── routes/                  # API route handlers
│   │   ├── auth.py              # Authentication & registration
│   │   ├── blood.py             # BloodBridge endpoints
│   │   ├── platelet.py          # PlateletAlert endpoints
│   │   ├── milk.py              # MilkBridge endpoints (largest)
│   │   ├── thal.py              # ThalCare endpoints
│   │   ├── ai_chat.py           # LifeForge AI endpoints
│   │   ├── dashboard.py         # Dashboard data endpoints
│   │   └── notifications.py     # Notification endpoints
│   ├── utils/
│   │   ├── db.py                # Supabase client
│   │   ├── matching.py          # Haversine distance, scoring
│   │   └── sms.py               # Twilio SMS integration
│   ├── migrations/              # SQL migration files
│   ├── main.py                  # FastAPI app entry point
│   ├── schema.sql               # Database schema
│   └── .env                     # Supabase & Twilio credentials
│
└── README.md
```

---

## Module Details

### BloodBridge
- Donor registration with blood group, location
- Hospital blood requests with urgency levels (CRITICAL/URGENT/NORMAL)
- Smart matching based on blood type compatibility and distance
- Real-time shortage alerts with countdown timers
- SMS notifications to nearby donors

### PlateletAlert
- Dedicated platelet donor registry
- Apheresis appointment scheduling
- Cancer/dengue patient matching
- Recurring donation tracking

### MilkBridge (Most Complete)
- **Donor Flow**: Register → Get matched → Accept/Decline → Pickup → Donate
- **Hospital Flow**: Post shortage → Find matches → Schedule pickup → Log donation
- **Features**:
  - Milk Passport tracking system (unique IDs for each donation)
  - Cold-chain status tracking (Collected → Pasteurized → In Transit → Delivered)
  - Screening status verification
  - Anonymous donation option
  - Expiry alerts for milk bank inventory
- **Components**: 7 modular React components for maintainability

### ThalCare
- Thalassemia patient profiles
- Regular transfusion scheduling
- Compatible donor matching
- Iron chelation reminders

### LifeForge AI
- AI-powered chat assistant
- Donor eligibility guidance
- Health screening questions
- Powered by Google Gemini

---

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- Supabase account (free tier works)
- Twilio account (optional, for SMS)

### 1. Clone the repository
```bash
git clone https://github.com/your-org/LifeForgeConnect.git
cd LifeForgeConnect
```

### 2. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials:
# SUPABASE_URL=https://xxx.supabase.co
# SUPABASE_KEY=your-anon-key
# TWILIO_SID=xxx (optional)
# TWILIO_AUTH_TOKEN=xxx (optional)
# TWILIO_PHONE=+1xxx (optional)
```

### 3. Database Setup
1. Go to your Supabase project → SQL Editor
2. Run `backend/schema.sql` to create tables
3. Run any migrations in `backend/migrations/`

### 4. Frontend Setup
```bash
cd FRONTEND

# Install dependencies
npm install

# Configure environment
echo "VITE_API_URL=http://localhost:8001" > .env
```

### 5. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
uvicorn main:app --reload --port 8001
```

**Terminal 2 - Frontend:**
```bash
cd FRONTEND
npm run dev
```

Visit `http://localhost:5173` to see the app.

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register/donor` | Register new donor |
| POST | `/auth/register/hospital` | Register hospital/org |
| POST | `/auth/login` | Login |
| POST | `/auth/otp/send` | Send OTP |
| POST | `/auth/otp/verify` | Verify OTP |

### BloodBridge
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/blood/donors` | List blood donors |
| GET | `/blood/requests/open` | Open blood requests |
| POST | `/blood/register-donor` | Register blood donor |
| POST | `/blood/requests` | Post blood request |
| POST | `/blood/match` | Find matching donors |

### MilkBridge
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/milk/donors` | List milk donors |
| GET | `/milk/bank` | Milk bank inventory |
| GET | `/milk/shortage-alerts` | NICU shortage alerts |
| GET | `/milk/requests/for-donor` | Requests for a donor |
| GET | `/milk/matches/donor/{id}` | Donor's pending matches |
| GET | `/milk/dashboard/hospital/{id}` | Hospital dashboard |
| POST | `/milk/register-donor` | Register milk donor |
| POST | `/milk/requests` | Post milk shortage |
| POST | `/milk/match` | Find matching donors |
| POST | `/milk/matches` | Create donor-request match |
| POST | `/milk/matches/{id}/respond` | Accept/decline match |
| POST | `/milk/donations` | Log donation (Milk Passport) |
| GET | `/milk/donations/{passport_id}` | Get donation details |
| PATCH | `/milk/matches/{id}` | Update match status |
| PATCH | `/milk/donors/{id}` | Update donor profile |

### Other Modules
Similar patterns for `/platelet/*`, `/thal/*`

---

## Database Schema

Key tables:
- `donors` - Donor profiles with blood group, location, verification
- `hospitals` - Hospital/org profiles
- `milk_donors` - Milk-specific donor data
- `milk_requests` - NICU milk requests
- `milk_matches` - Donor-request matches with workflow status
- `milk_donations` - Logged donations with Milk Passport IDs
- `milk_bank` - Pasteurized milk inventory
- `blood_requests` - Blood shortage requests
- `notifications` - In-app notifications
- `matches` - Cross-module match tracking

See `backend/schema.sql` for complete schema.

---

## Environment Variables

### Backend (.env)
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your-anon-key
TWILIO_SID=ACxxx           # Optional
TWILIO_AUTH_TOKEN=xxx      # Optional
TWILIO_PHONE=+1234567890   # Optional
GEMINI_API_KEY=xxx         # For AI chat
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:8001
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m "feat: add your feature"`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

### Module Ownership
- Each module (BloodBridge, MilkBridge, etc.) can be developed independently
- MilkBridge components are in `FRONTEND/src/components/milk/`
- Keep module-specific code in module-owned files to avoid conflicts

---

## Testing

### Register Test Accounts
1. Go to `/register` and create a donor account
2. Go to `/register?type=hospital` and create a hospital account
3. Test flows:
   - Donor: Register for module → See nearby requests → Respond
   - Hospital: Post request → Find matches → Coordinate pickup

### API Testing
```bash
# Health check
curl http://localhost:8001/

# Get donors
curl http://localhost:8001/milk/donors
```

---

## License

MIT License - see [LICENSE](./LICENSE)

---

## Acknowledgements

Built with purpose for every donor who said yes, and every patient still waiting.

---

<div align="center">

**LifeForge Connect** · *Because the right match shouldn't be a miracle. It should be a system.*

</div>
