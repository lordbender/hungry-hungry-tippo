# Keycloak Authentication

## Purpose

Hungry Hungry Tippo uses Keycloak as the local identity provider. The React app uses
Authorization Code + PKCE through the Keycloak JavaScript adapter, and the API
validates bearer access tokens before allowing prompt workflow calls.

Registration is disabled. Users are expected to be provisioned by a Keycloak
administrator.

## Local Services

Start Keycloak:

```sh
make keycloak-up
```

Useful URLs:

```text
Keycloak: http://localhost:8081
Admin console: http://localhost:8081/admin
Realm: hungry-hungry-tippo
```

Master admin login:

```text
Username: admin
Password: admin
```

Application admin user:

```text
Username: admin
Password: admin
Email: admin@hungry-hungry-tippo.local
Realm role: tippo-admin
```

The master admin account is for administering Keycloak. The application admin user is
the first user that can sign into the React app.

## Realm Import

The local realm import lives at:

```text
infrastructure/keycloak/realm-import/hungry-hungry-tippo-realm.json
```

It creates:

- realm: `hungry-hungry-tippo`
- client: `hungry-hungry-tippo-web`
- realm role: `tippo-admin`
- user: `admin`

The client is a public browser client using the standard authorization code flow
with PKCE. Registration is disabled at the realm level.

The imported redirect URI is `http://localhost:5173/*`. If Vite falls back to another
port, stop the process occupying `5173` or add the alternate redirect URI in the
Keycloak admin console.

## Frontend Configuration

The React app uses these Vite environment variables:

```sh
VITE_KEYCLOAK_URL=http://localhost:8081
VITE_KEYCLOAK_REALM=hungry-hungry-tippo
VITE_KEYCLOAK_CLIENT_ID=hungry-hungry-tippo-web
```

The prompt workflow screen is only rendered after Keycloak authentication succeeds.
Login and logout are exposed from the header navigation.

## API Configuration

The API validates access tokens with Keycloak's JWKS endpoint.

Local development:

```sh
KEYCLOAK_AUTH_ENABLED=true
KEYCLOAK_ISSUER=http://localhost:8081/realms/hungry-hungry-tippo
KEYCLOAK_JWKS_URI=http://localhost:8081/realms/hungry-hungry-tippo/protocol/openid-connect/certs
KEYCLOAK_CLIENT_ID=hungry-hungry-tippo-web
```

Docker Compose uses the browser-facing issuer but an internal JWKS URI:

```text
Issuer: http://localhost:8081/realms/hungry-hungry-tippo
JWKS URI: http://keycloak:8080/realms/hungry-hungry-tippo/protocol/openid-connect/certs
```

This split is intentional. Browser tokens are issued with the external localhost
issuer, while API containers can reach Keycloak by service name on the Compose
network.

## Provisioning Users

Use the Keycloak admin console:

1. Open `http://localhost:8081/admin`.
2. Login with the master admin account.
3. Switch to the `hungry-hungry-tippo` realm.
4. Go to `Users`.
5. Create a user.
6. Set a non-temporary password under `Credentials`.
7. Assign realm roles as needed.

Self-service registration is intentionally disabled.

## Protected API Surface

Currently protected:

```text
POST /api/prompts
```

Currently public:

```text
GET /health
```

The API verifies:

- token signature through the realm JWKS
- token issuer
- configured client ID through `azp` or `aud`

Prompt logs include basic actor metadata from the token subject and username.

## Resetting the Local Realm

Keycloak imports the realm on first startup. If you change the realm import and need a
fresh import, remove the Keycloak database volume:

```sh
docker compose down
docker volume rm hungry-hungry-tippo_keycloak-postgres-data
make keycloak-up
```

This deletes local Keycloak users and configuration.

## Production Notes

Before production:

- replace all default passwords
- use a managed Postgres database for Keycloak
- run Keycloak in production mode behind HTTPS
- configure real hostnames and redirect URIs
- decide whether app roles should be realm roles or client roles
- add role checks in the API once authorization requirements are clear
- remove or rotate the seeded local admin password
