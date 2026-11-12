# MaatruCare

### Patient-Controlled Care Coordination for the Complete Motherhood Journey

**When responsibility moves, context shouldn't be lost.**

MaatruCare is a maternal care coordination platform designed to connect mothers, caregivers, and essential care information throughout the motherhood journey — from preconception and pregnancy to postnatal care and early motherhood.

The platform brings appointments, responsibilities, caregiver communication, health tracking, and AI-assisted planning into one coordinated experience.

Rather than replacing healthcare professionals, MaatruCare focuses on making everyday maternal care more organized, collaborative, and patient-controlled.

> **MaatruCare is an assistive care coordination platform, not a diagnostic or treatment system.**

---

## Live Application

**Try MaatruCare:** https://maatru-care.vercel.app/

**Source Code:** https://github.com/saishishirponnuru-stack/MaatruCare

Users can create an account, complete onboarding, and explore the available care coordination features.

---

## The Problem

Maternal care extends far beyond hospital visits.

Throughout pregnancy and early motherhood, patients often depend on family members, caregivers, and healthcare professionals for appointments, medications, transportation, daily routines, and other responsibilities.

However, this information is frequently scattered across conversations, messages, notes, and different individuals.

This creates challenges such as:

- Unclear responsibility for important tasks
- Missed updates between caregivers
- Difficulty tracking appointments and preparations
- Fragmented communication
- Lack of continuity during caregiver handoffs
- Additional coordination responsibilities for mothers

MaatruCare addresses these gaps by creating a shared, structured, and patient-controlled coordination experience.

---

## Our Solution

MaatruCare provides a centralized platform where mothers can organize their care journey, coordinate with trusted caregivers, track responsibilities, and maintain visibility over important activities.

The platform combines structured care coordination with assistive AI capabilities while keeping patients in control of their information.

---

## Key Features

### 1. Dashboard

A centralized overview of the patient's care coordination activities.

- Important updates and reminders
- Upcoming responsibilities
- Care coordination summaries
- Quick access to essential features

### 2. Journey

A dedicated space for organizing the motherhood journey.

- Journey-related information
- Important milestones
- Pregnancy and motherhood coordination
- Relevant activities and updates

### 3. Care Circle

Manage the people involved in supporting the patient.

- Patient-controlled caregiver access
- Caregiver invitations
- Authorized care coordination
- Clearly defined participation

### 4. Appointments

Organize appointments and their associated responsibilities.

- Appointment information
- Scheduling and preparation
- Coordination with caregivers
- Appointment-related tasks

### 5. Tasks

Keep track of responsibilities across the Care Circle.

- Create and manage tasks
- Assign responsibilities
- Track task progress
- Maintain accountability

### 6. Timeline

A chronological record of care coordination activities.

- Important updates
- Task-related events
- Care activities
- Coordination history

### 7. Care Handoffs

Support continuity when responsibilities move between caregivers.

- Structured handoff information
- Responsibility transitions
- Context preservation
- Caregiver coordination

### 8. Consent and Access Control

Patients retain control over participation and information sharing.

- Patient-controlled permissions
- Authorized caregiver access
- Consent management
- Scoped information sharing

### 9. Lifestyle

A dedicated space for everyday maternal wellness coordination.

- Water intake monitoring
- Sleep tracking
- Diet and nutrition adherence
- Exercise and meditation activities
- Weight monitoring
- Daily lifestyle observations

Lifestyle information supports tracking and coordination rather than independent medical decision-making.

### 10. AI Assist

AI-powered assistance for organizing and communicating care information.

Available workflows include:

- AI Care Planner
- Ask MaatruCare
- Summarize Notes
- Extract Tasks
- Prepare Appointment
- Draft Handoff
- Draft Care Update
- Organize Meal Notes

AI-generated information is intended for review and coordination support.

**AI outputs must be reviewed by users and should not be treated as medical diagnoses or treatment recommendations.**

---

## Technology Stack

MaatruCare uses a modern full-stack architecture combining web technologies, backend APIs, managed authentication, relational data storage, and generative AI.

| Layer | Technologies |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Styling | CSS |
| Backend | Python, FastAPI |
| Authentication | Supabase Auth |
| Google Sign-In | Google OAuth through Supabase |
| Database | PostgreSQL (production), SQLite (local development) |
| AI Integration | Google Gemini |
| Frontend Hosting | Vercel |
| Backend Hosting | Render |
| Version Control | Git, GitHub |

### Frontend

Built using Next.js, React, and TypeScript.

The interface provides responsive navigation, interactive care coordination workflows, and light and dark themes.

### Backend

Built using Python and FastAPI.

The backend manages application logic, authenticated requests, care coordination records, and AI-assisted workflows.

### Authentication

Supabase Auth provides:

- Email and password authentication
- Email verification
- Password recovery
- Google sign-in
- Session management

The FastAPI backend independently verifies Supabase access tokens.

### Database

MaatruCare uses relational storage for application records.

- **PostgreSQL:** Production database
- **SQLite:** Local development and isolated testing

Supabase is used for authentication; it should not be confused with the application's separately configured production database.

### Artificial Intelligence

Google Gemini supports assistive workflows such as care planning, information organization, summaries, and communication drafts.

AI functionality is designed to assist users rather than replace professional medical judgment.

---

## System Architecture

```text
                    USER
                      |
                      v
            Next.js / React Frontend
                 (Vercel)
                      |
           +----------+----------+
           |                     |
           v                     v
      Supabase Auth         FastAPI Backend
   (Login & Sessions)          (Render)
                                 |
                    +------------+------------+
                    |                         |
                    v                         v
             PostgreSQL Database         Google Gemini
              (Care Records)           (AI Assistance)
```

### Authentication Flow

1. The user signs in through Supabase Auth.
2. Supabase establishes an authenticated session.
3. The frontend sends the Supabase access token with protected API requests.
4. FastAPI verifies the token.
5. Authorized requests access the appropriate patient-scoped records.

Caregiver access requires authorization through the application's invitation and permission mechanisms.

---

## Getting Started

### Prerequisites

Install:

- Node.js and npm
- Python
- Git

You will also need a configured Supabase project for authentication.

### 1. Clone the Repository

```bash
git clone https://github.com/saishishirponnuru-stack/MaatruCare.git
cd MaatruCare
```

### 2. Configure the Frontend

```bash
cd frontend
npm install
```

Create a `.env.local` file inside the `frontend` directory.

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
```

Configure any additional frontend environment variables required by the application.

### 3. Configure the Backend

From the repository root:

```bash
cd backend
```

Create a Python virtual environment:

```bash
python -m venv .venv
```

Activate it.

Windows:

```powershell
.\.venv\Scripts\Activate.ps1
```

macOS/Linux:

```bash
source .venv/bin/activate
```

Install backend dependencies using the dependency file provided in the repository.

Create a backend `.env` file using `backend/.env.example` as the reference.

Configure the required authentication, database, and AI environment variables.

**Never commit environment files containing credentials or API keys.**

### 4. Configure Supabase Authentication

In your Supabase project:

1. Enable email authentication.
2. Configure email verification and password recovery.
3. Enable Google authentication if Google sign-in is required.
4. Configure the application redirect URLs.

For local development:

```text
http://localhost:3000/auth/callback
```

For production:

```text
https://maatru-care.vercel.app/auth/callback
```

Google OAuth must use the Supabase-managed callback URL configured in the Google Cloud OAuth client.

### 5. Run the Application

Start the backend using the FastAPI application entry point configured in the repository.

Start the frontend:

```bash
cd frontend
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## Security and Privacy

MaatruCare is designed around patient-controlled access and scoped care coordination.

Important design principles include:

- Authentication through Supabase
- Backend verification of access tokens
- Patient-scoped care records
- Authorized caregiver participation
- Consent-based information sharing
- Environment-based secret management
- Human review of AI-generated content

Care information should only be shared with appropriately authorized participants.

---

## Demo and Testing

MaatruCare supports isolated fictional demonstration workflows for testing care coordination experiences.

When enabled through explicit development configuration, demo caregiver functionality can create clearly labeled, non-authenticated participants.

These participants do not receive actual caregiver login access.

Demo-only features should remain disabled in normal production environments unless explicitly intended and appropriately secured.

---

## Deployment

MaatruCare is deployed using:

**Frontend:** Vercel

**Backend:** Render

**Authentication:** Supabase Auth

**Production Storage:** PostgreSQL

Production configuration uses environment variables for authentication, database connectivity, AI services, and application settings.

The application requires durable production storage and should not rely on ephemeral hosting filesystems for persistent records.

---

## Project Vision

MaatruCare aims to make maternal care coordination more connected, transparent, and manageable.

By bringing patients, caregivers, responsibilities, and relevant information into one experience, the platform seeks to reduce communication gaps and improve continuity throughout the motherhood journey.

**Because better care coordination starts with keeping everyone informed — while keeping the mother in control.**

---

## Disclaimer

MaatruCare is intended for care coordination, information organization, and assistive planning.

It does not provide medical diagnoses, prescribe treatments, or replace qualified healthcare professionals.

Users should consult appropriate healthcare professionals for medical decisions.

---

**MaatruCare — When responsibility moves, context shouldn't be lost.**
