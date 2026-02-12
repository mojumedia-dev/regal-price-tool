# Regal Homes Price Update Tool

## Quick Start
```bash
npm install
npm run seed    # Seeds Parkside data + creates default users
npm start       # Starts on http://localhost:3000
```

## Login Credentials
- **Heather (editor):** heather@regalhomes.com / RegalHomes2026!
- **Admin:** admin@regalhomes.com / RegalHomes2026!

## Features (Phase 1 MVP)
- ✅ Price-only editing (3 tabs: Homesites, Base Prices, Available Homes)
- ✅ PDF generation matching Canva designs (Puppeteer → Letter PDF)
- ✅ Audit log (every price change tracked with who/when/old/new)
- ✅ Simple auth with JWT cookies
- ✅ Parkside community seeded with all data from spec

## PDF Output
Generated PDFs are saved to `generated-pdfs/[community]/[type]-[date].pdf`
- Homesites, Base Prices, Available Designer Homes
- Maroon headers, RH logo, Playfair Display serif fonts, alternating row colors
