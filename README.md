# MaatruCare

### Patient-Controlled Care Coordination for the Complete Motherhood Journey

> **When responsibility moves, context shouldn't be lost.**

MaatruCare is a patient-controlled care coordination platform designed to connect mothers, caregivers, and approved care information across the motherhood journey — from **preconception and pregnancy to postnatal care and early motherhood**.

MaatruCare focuses on the coordination gaps that occur when responsibility is shared between patients, family members, caregivers, and care teams.

It is designed as an **assistive coordination platform**, not a diagnostic or treatment system.

---

## 🌐 Deployment and local development

**Live application:**
https://maatru-care.vercel.app/

**GitHub repository:**
https://github.com/saishishirponnuru-stack/MaatruCare

Authentication uses Supabase Auth for email/password sessions, verification, and password recovery. The frontend requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; the backend independently verifies bearer tokens with `SUPABASE_JWT_SECRET`, `SUPABASE_AUDIENCE`, and (when configured) `SUPABASE_ISSUER`. New patient accounts create a new patient-scoped workspace. Caregiver accounts require a one-time invitation created by an authorized patient controller.

Google sign-in uses Supabase's managed Google provider. In Supabase, enable Google under **Authentication → Providers → Google**, add the Google OAuth client ID and secret there, and use the Supabase callback URL shown by that provider configuration (normally `https://<project-ref>.supabase.co/auth/v1/callback`) as the Google Cloud OAuth client's authorized redirect URI. In **Authentication → URL Configuration**, set the local Site URL to `http://localhost:3000` while developing or the production Site URL to `https://maatru-care.vercel.app`, and allow these application redirect URLs:

- `http://localhost:3000/auth/callback`
- `https://maatru-care.vercel.app/auth/callback`

The application never receives or verifies Google tokens directly. Supabase establishes the session, and FastAPI verifies the resulting Supabase access token.

Local development defaults to SQLite at `backend/maatrucare.db`. For production, configure `DATABASE_URL` to a durable managed database; do not rely on an ephemeral Render filesystem for application data. Keep all Supabase, Gemini, and database secrets in the deployment environment, never in the frontend bundle or repository.

For an isolated fictional demo workspace only, set both `MAATRUCARE_DEMO_CAREGIVERS_ENABLED=true` in the backend environment and `NEXT_PUBLIC_DEMO_CAREGIVERS_ENABLED=true` in the frontend environment. This exposes **Add Demo Caregiver**, which creates clearly labeled, non-authenticated participants scoped to the authorized patient controller. It does not send invitations or grant caregiver login access. Keep both flags unset or false for normal and production use.

---

## 💡 The Problem

Maternal care does not happen only inside the clinic.

Patients often depend on partners, parents, siblings, and other caregivers for:

- Appointment coordination
- Transportation
- Documents and preparation
- Scheduling
- Communication
- Task ownership
- Caregiver handoffs
- Keeping everyone aligned

When responsibility moves from one person to another, important coordination context can become fragmented.

The patient can end up acting as the communication bridge between everyone involved.

### MaatruCare addresses this coordination gap.

---

## 🎯 Our Solution

MaatruCare provides a shared coordination layer where patients can:

- Manage their Care Circle
- Control what approved information is shared
- Assign and track coordination tasks
- Transfer coordination responsibility between caregivers
- Review care handoffs
- Maintain a shared activity timeline
- Organize appointment-related responsibilities
- Use assistive AI to organize approved coordination information
- Keep the patient in control of information sharing
