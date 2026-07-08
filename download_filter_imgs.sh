#!/bin/bash
DIR="/var/www/kibilov-frontend/public/images/categories"

# Coolant Filter → 10362 ან სხვა ID
for id in 10362 10365 10366 10367 10713; do
  curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
    -H "Referer: https://www.autodoc.de/" \
    "https://scdn.autodoc.de/catalog/categories/300x300/${id}.png" \
    -o "/tmp/test_${id}.png"
  size=$(wc -c < "/tmp/test_${id}.png")
  echo "ID $id: $size bytes"
done
