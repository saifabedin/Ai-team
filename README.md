# ECM AI Team

Autonomous revenue system with multi-agent architecture for sales, marketing, and customer success.

## Architecture

```
Gateway (Express) → Workers (BullMQ) → Agents → WhatsApp/Email/CRM → PostgreSQL
```

## Tech Stack

- **Runtime:** Node.js, Express, BullMQ, Redis
- **Database:** PostgreSQL (Neon)
- **Messaging:** WhatsApp (WPPConnect), Nodemailer
- **PDF Generation:** PDFKit
- **Auth:** JWT, bcryptjs

## Features

- Multi-tenant SaaS with brand isolation
- Autonomous agent system (Sales, Marketing, Research, Developer, Architecture, Lesson)
- WhatsApp integration for outreach & support
- Email automation
- CRM with companies, leads, contacts, deals
- Pipeline management
- Proposal & meeting scheduling
- Knowledge graph & memory system
- Autopilot mode

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Run migrations
npm run migrate

# Seed database
npm run seed

# Start gateway
npm run gateway

# Start workers (separate terminal)
npm run workers
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run gateway` | Start API gateway |
| `npm run workers` | Start background workers |
| `npm run dashboard` | Start dashboard server |
| `npm run autopilot` | Start autopilot mode |
| `npm run migrate` | Run database migrations |
| `npm run seed` | Seed database |
| `npm test` | Run tests |

## Agent Types

| Agent | Purpose |
|-------|---------|
| Sales | Lead qualification, outreach, follow-ups |
| Marketing | Content creation, campaign management |
| Research | Market intelligence, competitor analysis |
| Developer | Code tasks, technical implementation |
| Architecture | System design, technical decisions |
| Lesson | Learning, knowledge extraction |

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key

# WhatsApp
WPP_GROUP_ID=group-id

# Email
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-password
```

## Project Structure

```
ai-team/
├── core/           # Core business logic & autopilot
├── db/             # Database migrations & queries
├── gateway/        # API gateway (Express)
├── workers/        # Background job processors
├── dashboard/      # Dashboard server
├── control/        # Bot control interface
├── scripts/        # Utility scripts
└── tests/          # Test suite
```

## License

Private - All rights reserved.
