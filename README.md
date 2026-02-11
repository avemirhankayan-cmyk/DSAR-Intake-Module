# Privacy Rights Intake Module (Demo)

This demo implements a US consumer privacy intake flow with:
- State-first web form UI
- Controlled-input intake (no free-text required for submission)
- Federal-sector overlays via checkbox selection (HIPAA, GLBA, FCRA, FERPA, COPPA) with "all federal rights together"
- PII checklist section ("In your opinion which PII does the company have about you?")
- Hardcoded rights profiles for all 50 U.S. states (no API key required for rights rendering)
- Law-context mapping for comprehensive-law states plus scope-limited/special-case states
- Plain-language categories inferred automatically from selected rights (for example, "Delete my info")
- Separate admin dashboard route with key-based access to submitted JSON objects

No email sending is used. No persistent storage is used. Use synthetic test data only.

## Run

```bash
npm install
npm start
```

Consumer intake page: `http://127.0.0.1:3000/`
Admin dashboard: `http://127.0.0.1:3000/admin`

Optional environment variables:
- `PORT` (default: `3000`)
- `HOST` (default: `127.0.0.1`)
- `ADMIN_KEY` (default: `demo-admin-key`)

## Admin access

The dashboard data endpoint requires header `x-admin-key`.
In the provided `admin.html` page, enter the same value as `ADMIN_KEY` to unlock.

## Federal overlays

Consumer rights shown in the checklist are merged from:
- Selected state profile
- Any selected federal profiles:
  - `hipaa` (healthcare)
  - `glba` (financial institutions)
  - `fcra` (credit reporting context)
  - `ferpa` (education records)
  - `coppa` (child-directed online services)

State rights are always included.

## PII checklist

The intake form includes a required multi-checkbox PII section (for example):
- First name / Middle name / Last name
- Date of birth
- SSN and other government identifiers
- Contact data (email, phone, address)
- Financial and account identifiers
- Biometric, geolocation, health, education, and employment data

Submission is blocked unless at least one PII item is selected.

## JSON output shape

The submit action generates and displays:

```json
{
  "State": "California",
  "Entity_Types": ["hipaa", "glba", "fcra"],
  "Category": "Delete my info",
  "Selected_Rights": ["Delete my info", "Stop selling or sharing my info"],
  "PII_Items": ["First name", "Social Security Number", "Email address"],
  "User_Intent": "Structured request: Delete my info. Rights: Delete my info; Stop selling or sharing my info.",
  "Timestamp": "2026-02-11T17:00:00.000Z"
}
```
