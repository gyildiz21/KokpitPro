#!/bin/sh
set -eu

if [ "$(id -u)" = "0" ]; then
  chown -R node:node "${KOKPIT_DATA_DIR:-/data}"
  exec gosu node "$@"
fi

exec "$@"
