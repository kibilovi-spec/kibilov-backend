#!/bin/bash
# July 1 - Run all enrichment scripts
# გაუშვი: bash /var/www/kibilov-backend/scripts/run_all_enrichment.sh

cd /var/www/kibilov-backend
source .env 2>/dev/null

echo "=== KIBILOV OEM ENRICHMENT ==="
echo "$(date)"
echo ""

echo "1. enrich_oem_full.js — cross-refs for products"
nohup node scripts/enrich_oem_full.js > /tmp/enrich_oem.log 2>&1 &
echo "   PID: $! | log: /tmp/enrich_oem.log"
sleep 2

echo "2. build_cross_refs.js — vehicle OEM cross-reference graph"  
nohup node scripts/build_cross_refs.js > /tmp/build_cross.log 2>&1 &
echo "   PID: $! | log: /tmp/build_cross.log"

echo ""
echo "მონიტორინგი:"
echo "  tail -f /tmp/enrich_oem.log"
echo "  tail -f /tmp/build_cross.log"
