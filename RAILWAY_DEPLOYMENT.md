# Railway Deployment Guide - Sales Managers Migration

## What Changed

We've added a proper `sales_managers` table to support multiple sales managers per community (specifically for Amanti Lago which has both Melinda Balsterholt and Gina McBride).

## Option 1: Fresh Database (Recommended)

The easiest approach is to reset the database:

1. **In Railway Dashboard:**
   - Go to your service
   - Navigate to the **Variables** tab
   - Find the database volume or data directory
   - Delete the `regal.db` file (or rename it to `regal.db.backup`)

2. **Redeploy:**
   - Railway will auto-deploy from the latest push
   - On first run, `seed.js` will create a fresh database with the new schema

3. **Verify:**
   - Log into the web interface
   - Check that Amanti Lago shows both sales managers
   - Generate a PDF to confirm both names appear

## Option 2: Run Migration (Preserve Data)

If you need to keep existing data (price changes, user accounts, etc.):

1. **SSH into Railway container:**
   ```bash
   railway run bash
   ```

2. **Run migration:**
   ```bash
   npm run migrate:status    # Check current state
   npm run migrate           # Apply migration
   ```

3. **Verify:**
   ```bash
   npm run migrate:status    # Should show migration applied
   ```

4. **Restart the service** (if needed)

## What the Migration Does

1. Creates `sales_managers` table with:
   - `id`, `community_id`, `name`, `phone`, `email`, `sort_order`
   - Foreign key to `communities(id)` with CASCADE delete

2. Migrates existing data:
   - Reads current `sales_manager_name`, `sales_manager_phone`, `sales_manager_email` from `communities`
   - Handles multi-manager fields (separated by " / ")
   - Creates individual records in `sales_managers` table
   - Preserves sort order

3. Legacy fields remain in `communities` table for backward compatibility

## After Migration

The PDF generator will now:
- Query `sales_managers` table for each community
- Display multiple managers with proper visual separation
- Fall back to legacy fields if `salesManagers` array is empty

## Rollback

If something goes wrong:

```bash
railway run npm run migrate:down
```

This will:
- Drop the `sales_managers` table
- Remove migration from tracking table
- Data will fall back to using legacy `communities` fields

## Current Sales Managers

After migration completes, the system will have:

- **Parkside:** Mindee Gurney
- **Bella Vita:** Gary Hansen  
- **Bristol Farms:** Tristan Hamblin
- **Amanti Lago:** Melinda Balsterholt + Gina McBride ✨ (2 managers)
- **Windflower:** Marissa Burdett

## Troubleshooting

**"Migration already applied" error:**
- Check status: `npm run migrate:status`
- The migration tracks what's been run in the `migrations` table

**"No such table: communities" error:**
- Database is empty - use `npm run seed` instead

**PDFs not showing multiple managers:**
- Check the database: Query `sales_managers` table
- Verify `server.js` is fetching managers (line ~607)
- Check PDF generation logs
