# Hotel Radar

## Docker Run

The repository is started from the root via `docker compose`.

1. Create the runtime env file:

```bash
cp .env.example .env
```

2. Fill in the required secrets in `.env`:

- `APIFY_TOKEN`
- `OPENAI_API_KEY`
- `MONGO_INITDB_ROOT_USERNAME`
- `MONGO_INITDB_ROOT_PASSWORD`

3. Set the active application slot in `.env`:

```env
HR_CORE_ACTIVE_SLOT=blue
```

Allowed values are `blue` and `green`.

4. Start the stack:

```bash
docker compose up -d
```

5. Check that containers are healthy:

```bash
docker compose ps
```

The public entrypoint is `http://localhost:3000`.

`docker compose up -d` starts both application slots, `hr-core-blue` and `hr-core-green`.

## Run Only Blue Slot

If you want to start only the blue slot together with MongoDB and the nginx router:

```bash
docker compose up -d hr-mongodb hr-core-blue hr-core
```

In this mode:

- `hr-core-blue` is started
- `hr-core-green` stays stopped
- nginx on `http://localhost:3000` routes traffic to blue when `.env` contains `HR_CORE_ACTIVE_SLOT=blue`

## Environment Variables

`docker-compose.yml` and `hr-core` currently require these variables from `.env`:

- `MONGO_INITDB_ROOT_USERNAME`
- `MONGO_INITDB_ROOT_PASSWORD`
- `MONGO_INITDB_DATABASE`
- `MONGODB_BACKUP_DIRECTORY_PATH`
- `MONGODB_BACKUP_HOST`
- `MONGODB_BACKUP_PORT`
- `HR_CORE_ACTIVE_SLOT`
- `VALHALLA_IMAGE`
- `VALHALLA_HOST_PORT`
- `VALHALLA_BASE_URL`
- `VALHALLA_DATA_DIRECTORY_PATH`
- `VALHALLA_USE_TILES_IGNORE_PBF`
- `VALHALLA_FORCE_REBUILD`
- `VALHALLA_SERVE_TILES`
- `VALHALLA_BUILD_ELEVATION`
- `VALHALLA_BUILD_ADMINS`
- `VALHALLA_BUILD_TIME_ZONES`
- `APIFY_TOKEN`
- `APIFY_ACTOR_ID`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `GOV_CY_HOTELS_PAGE_URL`
- `PDF_STORAGE_DIRECTORY_PATH`
- `PDF_DOWNLOAD_TIMEOUT_MS`
- `OPENAI_RESPONSES_TIMEOUT_MS`
- `GOV_CY_PDF_PARSING_CACHE_TIME_MS`

`.env.example` contains examples for all of them.

## MongoDB Backups

Create a full dump of the configured MongoDB database:

```bash
./scripts/mongodb-backup.sh
```

The script reads MongoDB credentials and database name from `.env`:

```env
MONGO_INITDB_ROOT_USERNAME=...
MONGO_INITDB_ROOT_PASSWORD=...
MONGO_INITDB_DATABASE=...
MONGODB_BACKUP_DIRECTORY_PATH=/Users/alphared/Yandex.Disk.localized/Projects/hotel-radar/backups
MONGODB_BACKUP_HOST=127.0.0.1
MONGODB_BACKUP_PORT=27777
```

If `MONGODB_BACKUP_DIRECTORY_PATH` is not set, the default is `/Users/alphared/Yandex.Disk.localized/Projects/hotel-radar/backups`. The directory is created automatically when it does not exist.

## Valhalla

Valhalla runs as `hr-valhalla` and uses the local data directory mounted at `/custom_files`:

```env
VALHALLA_DATA_DIRECTORY_PATH=./valhalla/custom_files
VALHALLA_BASE_URL=http://hr-valhalla:8002
```

Both `hr-core-blue` and `hr-core-green` receive the same `VALHALLA_BASE_URL`, so application code should use that env var for internal routing requests.

The local Cyprus OSM source file should be placed at:

```text
valhalla/custom_files/cyprus-latest.osm.pbf
```

Start Valhalla:

```bash
docker compose up -d hr-valhalla
```

The first start may take time because Valhalla builds routing tiles from the PBF. `valhalla/custom_files/` is ignored by git because it contains local source data and generated routing files.

## Slot Routing

Blue/green routing is controlled through `.env`, not through `sed`.

The nginx container reads:

```env
HR_CORE_ACTIVE_SLOT=blue
```

and proxies requests to either `hr-core-blue:3000` or `hr-core-green:3000`.

If both slots are started, the active slot is selected only by the `HR_CORE_ACTIVE_SLOT` value.

If you intentionally start only one slot, nginx still routes by `HR_CORE_ACTIVE_SLOT`, so the env value must match the slot that is actually running.

## Switch Green To Blue

If `green` is currently active and you want to switch traffic to `blue`:

1. Make sure `hr-core-blue` is up and healthy:

```bash
docker compose ps hr-core-blue
```

2. Change the slot in `.env`:

```env
HR_CORE_ACTIVE_SLOT=blue
```

3. Recreate only the nginx router container so it reloads the new env value:

```bash
docker compose up -d --force-recreate hr-core
```

4. Verify that traffic is routed to blue:

```bash
docker compose logs --tail=50 hr-core
docker compose ps
```

## Notes

- `hr-core-blue` is exposed on host port `3001`.
- `hr-core-green` is exposed on host port `3002`.
- MongoDB is exposed on host port `27777`.
- `PDF_STORAGE_DIRECTORY_PATH` should point to a writable path inside the container. The default `/opt/hr-core/data/files` is inside the mounted `./hr-core` workspace, so the application can create directories and write downloaded PDFs there.
- `GOV_CY_PDF_PARSING_CACHE_TIME_MS` controls the in-memory cache TTL for `POST /gov-cy-pdf-hotels/parse`. The default value is `43200000` milliseconds.
- On module startup, `hr-core` checks Apify and OpenAI availability. If Apify is unavailable, if the OpenAI key/model is unavailable, or if OpenAI reports insufficient quota, the service logs the error and exits with code `1`.
