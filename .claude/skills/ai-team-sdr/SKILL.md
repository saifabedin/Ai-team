# ai-team-sdr

Use for SDR outreach work — nova agent, outreach sequences, objection handling, meeting booking.

## Structure (`departments/sdr/`)
| File | Purpose |
|------|---------|
| `agent.cjs` | Nova agent — outreach drafting, objection handling |
| `service.cjs` | Enroll, runStep, handleReply, bookMeeting |
| `routes.cjs` | HTTP API routes |
| `channels.cjs` | Channel senders (email/WhatsApp/LinkedIn), mock \| live |

## Flow
```
Lead → SDR enroll → sequence steps → email/WhatsApp/LinkedIn → reply handling → meeting booking
```

## Gotchas
- Current provider mode is `mock` — no real messages sent
- Gmail SMTP requires `GMAIL_APP_PASSWORD` for live mode
- WhatsApp requires WPPConnect server (`wppconnect-server/`)
- LinkedIn is mock-only (no API integration exists)
- All channels use `PROVIDER_MODE` env var to switch mock/live
