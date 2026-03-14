# Regal Homes Price Update Tool

Property pricing sync tool for Homefiniti, ANewGo, Zillow, and MLS platforms.

## Features

- ✅ Price management (3 tabs: Base Prices, Homesites, Available Homes)
- ✅ Multi-platform sync (Homefiniti, ANewGo, Zillow, MLS)
- ✅ PDF generation matching Canva designs (Puppeteer → Letter PDF)
- ✅ Audit log (every price change tracked with who/when/old/new)
- ✅ JWT authentication with role-based access
- ✅ Responsive design (mobile, tablet, desktop)

## Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** SQLite (sql.js)
- **Authentication:** JWT with bcryptjs password hashing
- **PDF Generation:** Puppeteer
- **External APIs:** Homefiniti, ANewGo, Zillow/NewHomeFeed, MLS

## Installation

### Prerequisites
- Node.js 18+ 
- npm

### Setup

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env and set your JWT_SECRET
# Generate a secret: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Seed database with initial data
npm run seed

# Start server
npm start
```

Server runs on `http://localhost:3000` (or `PORT` from .env)

## Environment Variables

See `.env.example` for all required/optional variables.

**Required:**
- `JWT_SECRET` - JWT signing secret (minimum 32 characters, use random hex string)

**Optional:**
- `PORT` - Server port (default: 3000)
- `DB_DIR` - Database directory (default: ./db)

## Login Credentials (Seeded)

- **Editor:** heather@regalhomes.com / RegalHomes2026!
- **Admin:** admin@regalhomes.com / RegalHomes2026!

## Usage

1. Log in with credentials
2. Select community from dropdown
3. Navigate between tabs (Base Prices, Homesites, Available Homes)
4. Edit prices inline
5. Click "Save All Changes" to persist
6. Click "Sync to Platforms" to update external systems
7. Generate PDFs for client delivery

## PDF Output

Generated PDFs are saved to `generated-pdfs/[community]/[type]-[date].pdf`
- Base Prices, Homesites, Available Designer Homes
- Maroon headers, RH logo, Playfair Display serif fonts, alternating row colors

## Development

```bash
npm run dev     # Start with nodemon (if installed)
npm start       # Start production server
npm run seed    # Reset and seed database
```

## Deployment (Railway)

Deployed at: https://regal-homes-price-tool-production-0d02.up.railway.app/

### Environment Variables (Production)
Set in Railway dashboard:
- `JWT_SECRET` - Strong random secret (NEVER use default)
- `PORT` - Automatically set by Railway
- `DB_DIR` - `/app/db` recommended for persistence

### Database Persistence
SQLite database is stored in `db/regal.db`. On Railway, ensure volume is mounted to persist data across deploys.

## Security

⚠️ **IMPORTANT:**
- **JWT_SECRET must be set** - Application will not start without it
- Use a strong, random secret (minimum 32 characters)
- Never commit `.env` files to version control
- Change default login passwords in production
- Use HTTPS in production (handled by Railway)

## Project Structure

```
regal-price-tool/
├── public/           # Frontend (index.html + inline CSS/JS)
├── db/               # SQLite database
├── generated-pdfs/   # Generated PDF output
├── server.js         # Main Express server
├── db-wrapper.js     # Database wrapper
├── seed.js           # Database seeding script
├── *-sync.js         # Platform sync modules
├── pdf-generator.js  # PDF generation
└── migrate-*.js      # Database migrations
```

## Troubleshooting

### Application won't start
- **Error: JWT_SECRET not set** → Set `JWT_SECRET` in `.env` file
- **Database locked** → Close other connections, restart server

### Sync failures
- Check API credentials in sync modules
- Check network connectivity to external APIs
- Review audit log for error details

### PDF generation fails
- Ensure Puppeteer dependencies installed
- Check disk space for generated-pdfs/
- Review server logs for Puppeteer errors

## Known Issues

- Dependency vulnerability in puppeteer (moderate severity - yauzl off-by-one error)
  - Fix requires downgrading to puppeteer@19.8.0 (breaking change)
  - Current impact: Low (PDF generation still works)
  - Recommended: Evaluate and apply fix in next maintenance window

## License

Proprietary - Regal Homes internal tool
