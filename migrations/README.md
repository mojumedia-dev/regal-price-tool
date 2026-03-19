# Database Migrations

This directory contains database migration files for the Regal Price Tool.

## Usage

### First-time setup (new database):
```bash
npm run seed          # Create tables and seed initial data
```

### Existing database (apply new migrations):
```bash
npm run migrate:status   # Check what migrations are pending
npm run migrate          # Run pending migrations
npm run migrate:down     # Roll back last migration
```

## Migration Files

- `001_add_sales_managers_table.js` - Creates sales_managers table and migrates existing data

## Creating New Migrations

1. Create a new file: `XXX_description.js` (e.g., `002_add_user_roles.js`)
2. Export `up` and `down` functions:

```javascript
async function up(db) {
  // Apply changes
  db.exec(`CREATE TABLE ...`);
}

async function down(db) {
  // Revert changes
  db.exec(`DROP TABLE ...`);
}

module.exports = { up, down };
```

3. Run `npm run migrate` to apply

## Important Notes

- **For new databases**: Always use `npm run seed` first (includes all schema)
- **For existing databases**: Use migrations to apply incremental changes
- The `seed.js` file now includes the sales_managers table schema
- Migrations track what's been applied in the `migrations` table
- Each migration should be idempotent (safe to run multiple times)

## Production Deployment

When deploying to Railway:
1. Push code with new migration files
2. Railway will automatically run the app
3. Run migrations manually via Railway CLI or web interface:
   ```bash
   railway run npm run migrate
   ```
