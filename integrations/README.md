# n8n → FixMyLeads AI Team — Lead Ingest

Sheet upload karo → n8n rows nikaal kar AI Team ko bhejta hai → poora team
(enrich → score → outreach) autopilot pe kaam shuru kar deta hai.

## Do tareeke (dono supported)

### 1. n8n webhook push  *(recommended)*
n8n sheet ki rows ko POST karta hai:

```
POST http://127.0.0.1:4100/api/lead-intel/ingest
Headers: x-brand-id: fixmyleads
Body: { "src": "n8n-sheet", "rows": [ { ...row1 }, { ...row2 } ] }
```

- `rows` me kuch bhi column naam ho sakta hai — auto-map hota hai:
  `name/full name/contact` → name, `company/business`, `email/mail`,
  `phone/mobile/whatsapp`, `website/url`, `industry/niche`, `city/location`,
  `linkedin`. Bas `email` **ya** `phone` **ya** `company` chahiye.
- Default: har lead background queue (`enrich`) pe jaata hai. Inline chahiye
  (turant score) to body me `"inline": true`.

**Import:** n8n → Import from File → `integrations/n8n-sheet-ingest.json`.
Phir `Read Google Sheet` node me apni sheet URL daalo, credentials connect karo,
aur `POST` node ka URL apne server pe point karo. Manual trigger se test, ya
`Every 30 min` schedule se 24/7.

### 2. Server khud sheet pull kare *(n8n optional)*
Public Google Sheet (Anyone-with-link) ya CSV link:

```
POST http://127.0.0.1:4100/api/lead-intel/pull-sheet
Headers: x-brand-id: fixmyleads
Body: { "url": "https://docs.google.com/spreadsheets/d/XX../edit#gid=0" }
```

Autopilot (`AUTOPILOT_SHEET_URL` env) ise har cycle pe khud call kar sakta hai —
poori detail neeche autopilot section me.

## Test (curl)
```bash
curl -s -XPOST localhost:4100/api/lead-intel/ingest \
  -H 'x-brand-id: fixmyleads' -H 'content-type: application/json' \
  -d '{"rows":[{"company":"Acme Gym","name":"Riya","email":"riya@acme.in","phone":"+919800000001","industry":"fitness","city":"Mumbai"}]}'
```
Response: `{"ingested":1,"leadIds":[N]}` → dashboard pe lead live dikhega.
