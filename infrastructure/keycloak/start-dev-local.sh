#!/bin/sh
set -eu

/opt/keycloak/bin/kc.sh "$@" &
kc_pid=$!

cleanup() {
  kill "$kc_pid" 2>/dev/null || true
}
trap cleanup INT TERM

attempt=0
while [ "$attempt" -lt 60 ]; do
  if /opt/keycloak/bin/kcadm.sh config credentials \
    --server http://127.0.0.1:8080 \
    --realm master \
    --user "${KC_BOOTSTRAP_ADMIN_USERNAME:?}" \
    --password "${KC_BOOTSTRAP_ADMIN_PASSWORD:?}" >/dev/null 2>&1; then
    break
  fi
  attempt=$((attempt + 1))
  sleep 2
done

if [ "$attempt" -ge 60 ]; then
  echo "Timed out waiting for Keycloak admin credentials." >&2
  wait "$kc_pid"
  exit 1
fi

/opt/keycloak/bin/kcadm.sh update realms/master -s sslRequired=NONE --server http://127.0.0.1:8080

attempt=0
while [ "$attempt" -lt 30 ]; do
  if /opt/keycloak/bin/kcadm.sh update realms/hungry-hungry-tippo -s sslRequired=NONE --server http://127.0.0.1:8080 >/dev/null 2>&1; then
    break
  fi
  attempt=$((attempt + 1))
  sleep 2
done

wait "$kc_pid"
