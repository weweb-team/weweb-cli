# WeWeb CLI

#### Serve :

> Default port is 8080.

`npm run weweb serve [-- port=port]`

`yarn weweb serve [-- port=port]`

#### Build :

`npm run weweb build -- name=name type=type`

`yarn weweb build -- name=name type=type`

#### Database migration :

Generate a PostgreSQL migration from a source database to a target database:

`npx @weweb/cli@latest db:generate --source-db-url "$SOURCE_DB_URL" --target-db-url "$TARGET_DB_URL" --output-file ./migration.sql`

Execute a generated migration:

`npx @weweb/cli@latest db:execute --db-url "$TARGET_DB_URL" --sql-file ./migration.sql`

Test a migration without committing it:

`npx @weweb/cli@latest db:execute --db-url "$TARGET_DB_URL" --sql-file ./migration.sql --dry-run`
