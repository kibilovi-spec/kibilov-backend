#!/bin/bash
DIR="/var/www/kibilov-frontend/public/images/categories"

# 675 tecdoc IDs from New_Text_Document.txt equivalent
IDS="10109 10117 10120 10125 10126 10128 10129 10130 10131 10132 10142 10147 10148 10151 10157 10162 10191 10203 10213 10221 10233 10250 10251 10287 10359 10360 10361 10363 10414 10418 10450 10454 10471 10505 10511 10531 10533 10553 10554 10666 10671 10678 10679 10707 10907 10972 12094 12899 13001 15065 74880 10713"

ok=0; fail=0
for id in $IDS; do
  out="$DIR/tecdoc_${id}.png"
  curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
    -H "Referer: https://www.autodoc.de/" \
    -H "Accept: image/png,image/*" \
    -o "$out" \
    "https://scdn.autodoc.de/catalog/categories/300x300/${id}.png"
  size=$(wc -c < "$out")
  if [ "$size" -gt 1000 ]; then
    ok=$((ok+1))
  else
    fail=$((fail+1))
    rm -f "$out"
  fi
done
echo "Done: ok=$ok fail=$fail"
