# ai-team-fml-health

Use for FML Health department work — patient coordination, appointment booking, aftercare, reputation management, referrals.

## Departments
| Department | Agent | Purpose |
|------------|-------|---------|
| patient-coordinator | aria | Patient intake, symptom triage, FAQ, routing |
| appointment | chronos | Slot optimization, conflict resolution, Google Calendar |
| prep | prepper | Pre-appointment prep workflows |
| aftercare | healer | Post-appointment follow-ups |
| reputation | sentinel | Review monitoring & management |
| referral | connector | Patient referral incentives & tracking |

## Multi-Language Support
`departments/patient-coordinator/i18n.cjs` — en/hi/ta/te/mr/bn

## Gotchas
- WhatsApp session via Baileys (`WHATSAPP_SESSION_DIR=./session`)
- Google Calendar requires `GOOGLE_CALENDAR_ID` + `GOOGLE_CALENDAR_API_KEY`
- SMS via MSG91 (configured but may not have credits)
- Voice calling is MOCK only — `voice_service.py` returns 501
- Appointment reminders at 24h/2h/30m before
