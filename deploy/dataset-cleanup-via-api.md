# Dataset Cleanup via API (Admin Token)

Use this flow to delete broken dataset entries through the API, including MinIO cleanup.

## Prerequisites

- You are connected to the correct Kubernetes cluster/context.
- Namespace is `pids-production`.
- `curl` is installed.
- `jq` is installed (used to parse JSON responses).

## 1) Set namespace

```bash
NS=pids-production
```

## 2) Read Keycloak admin password from Kubernetes secret

```bash
KC_ADMIN_PASSWORD=$(kubectl get secret keycloak-secret -n "$NS" -o jsonpath='{.data.admin-password}' | base64 -d)
```

## 3) Set API and Keycloak URLs

```bash
API_BASE="https://toads.directory/api"
KEYCLOAK_BASE="https://auth.toads.directory"
```

## 4) Request admin access token

```bash
TOKEN=$(curl -sS -X POST "$KEYCLOAK_BASE/realms/pids/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=password" \
  --data-urlencode "client_id=pids-frontend" \
  --data-urlencode "username=admin" \
  --data-urlencode "password=$KC_ADMIN_PASSWORD" | jq -r '.access_token')

echo "${TOKEN:0:30}..."
```

## 5) Verify token and roles

```bash
curl -sS "$API_BASE/auth/me" \
  -H "Authorization: Bearer $TOKEN" | jq
```

## 6) Delete a dataset by ID

```bash
DATASET_ID="put-dataset-id-here"

curl -sS -X DELETE "$API_BASE/datasets/$DATASET_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq
```

## 7) List datasets to find IDs

```bash
curl -sS "$API_BASE/datasets?limit=200&network=mainnet" \
  -H "Authorization: Bearer $TOKEN" | jq '.data[] | {id: ._id, title, status, network}'
```

## Notes

- This route deletes the dataset from MongoDB and also removes associated files from MinIO.
- If token request fails, check:
  - Keycloak URL
  - realm (`pids`)
  - username/password
  - whether the user has the `admin` role
