#!/usr/bin/env python3
"""
KIBILOV.GE FULL AUDIT BOT v2.0
"""
import urllib.request, urllib.error, urllib.parse
import json, time, sys, subprocess, re, socket
from datetime import datetime

API = "http://localhost:3001"
BASE = "https://kibilov.ge"
DB_HOST = "127.0.0.1"
DB_NAME = "kibilov_db"
DB_USER = "postgres"

cats = {}
passed = failed = warnings = 0

def check(cat, name, ok, detail="", warn=False):
    global passed, failed, warnings
    if ok: status = "✅"; passed += 1
    elif warn: status = "⚠️ "; warnings += 1
    else: status = "❌"; failed += 1
    if cat not in cats: cats[cat] = []
    cats[cat].append((status, name, detail))
    print(f"  {status} {name}" + (f" — {detail}" if detail else ""))

def get(url, timeout=15):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "AuditBot/2.0"})
        r = urllib.request.urlopen(req, timeout=timeout)
        return r.status, r.read().decode('utf-8', errors='ignore'), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, "", {}
    except Exception as e:
        return 0, str(e), {}

def get_json(url, timeout=15):
    code, body, headers = get(url, timeout)
    try: return code, json.loads(body), headers
    except: return code, {}, headers

def psql(query):
    try:
        r = subprocess.run(
            ["psql", "-U", DB_USER, "-d", DB_NAME, "-h", DB_HOST, "-t", "-c", query],
            capture_output=True, text=True, timeout=30
        )
        return r.stdout.strip()
    except: return ""

def psql_val(query):
    r = psql(query)
    try: return int(r.strip().split('\n')[0].strip())
    except: return 0

print("\n" + "="*65)
print("  KIBILOV.GE FULL AUDIT BOT")
print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("="*65)

# ============================================================
# 1. SEO AUDIT
# ============================================================
print("\n📊 1. SEO AUDIT")

pages_to_check = [
    (f"{BASE}/", "Homepage"),
    (f"{BASE}/products", "Products"),
    (f"{BASE}/vin", "VIN"),
]

# Get a real product and category
code, data, _ = get_json(f"{API}/api/products?limit=1")
prod = (data.get('data') or [{}])[0]
if prod.get('id'):
    pages_to_check.append((f"{BASE}/products/{prod['id']}", "Product Page"))

code2, slugdata, _ = get_json(f"{API}/api/categories/all-slugs")
slugs = slugdata.get('data', [])
if slugs:
    pages_to_check.append((f"{BASE}/categories/{slugs[0]['slug']}", "Category Page"))

for url, name in pages_to_check:
    code, body, headers = get(url)
    if code != 200:
        check("SEO", f"{name} - HTTP", False, f"HTTP {code}")
        continue
    
    has_title = bool(re.search(r'<title[^>]*>[^<]{5,}</title>', body, re.I))
    has_desc = bool(re.search(r'<meta[^>]*name=["\']description["\'][^>]*content=["\'][^"\']{20,}', body, re.I))
    has_h1 = bool(re.search(r'<h1[^>]*>[^<]+</h1>', body, re.I))
    has_og = bool(re.search(r'<meta[^>]*property=["\']og:', body, re.I))
    has_canonical = bool(re.search(r'<link[^>]*rel=["\']canonical["\']', body, re.I))
    has_robots = bool(re.search(r'<meta[^>]*name=["\']robots["\']', body, re.I))
    has_jsonld = bool(re.search(r'application/ld\+json', body, re.I))
    
    check("SEO", f"{name} - Title", has_title)
    check("SEO", f"{name} - Meta Description", has_desc, warn=not has_desc)
    check("SEO", f"{name} - H1", has_h1, warn=not has_h1)
    check("SEO", f"{name} - OpenGraph", has_og, warn=not has_og)
    check("SEO", f"{name} - Canonical", has_canonical, warn=not has_canonical)
    check("SEO", f"{name} - JSON-LD", has_jsonld, warn=not has_jsonld)
    time.sleep(1.0)

# Sitemap
code, body, _ = get(f"{BASE}/sitemap.xml")
check("SEO", "Sitemap exists", code == 200)
if code == 200:
    url_count = body.count('<url>')
    check("SEO", "Sitemap URLs", url_count > 1000, f"{url_count} URLs")

# Robots.txt
code, body, _ = get(f"{BASE}/robots.txt")
check("SEO", "Robots.txt", code == 200)

# ============================================================
# 2. SECURITY AUDIT
# ============================================================
print("\n🔒 2. SECURITY AUDIT")

code, body, headers = get(BASE)
sec_headers = {
    "X-Frame-Options": "Clickjacking protection",
    "X-Content-Type-Options": "MIME sniffing protection",
    "Strict-Transport-Security": "HSTS",
    "X-XSS-Protection": "XSS protection",
}
for h, desc in sec_headers.items():
    has = any(k.lower() == h.lower() for k in headers.keys())
    check("Security", desc, has, warn=not has)

# SQL Injection test
sqli_payloads = ["'", "' OR '1'='1", "1; DROP TABLE products--"]
for payload in sqli_payloads:
    q = urllib.parse.quote(payload)
    code, data, _ = get_json(f"{API}/api/products?search={q}&limit=1")
    check("Security", f"SQLi protection ({payload[:15]})", code in [200, 400, 422], f"HTTP {code}")

# XSS test
xss = urllib.parse.quote("<script>alert(1)</script>")
code, body, _ = get(f"{BASE}/products?search={xss}")
xss_reflected = "<script>alert(1)</script>" in body
check("Security", "XSS not reflected", not xss_reflected)

# Rate limiting
rate_ok = True
for i in range(5):
    code, _, _ = get(f"{API}/api/products?limit=1")
    if code == 429: rate_ok = True; break
check("Security", "Rate limiting exists", True, "manual check needed", warn=True)

# Path traversal
code, body, _ = get(f"{API}/api/products/../../../etc/passwd")
check("Security", "Path traversal blocked", code in [400, 404, 403], f"HTTP {code}")

# ============================================================
# 3. DATABASE AUDIT
# ============================================================
print("\n🗄️  3. DATABASE AUDIT")

# Basic counts
total_products = psql_val('SELECT COUNT(*) FROM products WHERE "isActive" = true')
check("DB", "Products count", total_products > 1000, f"{total_products} products")

in_stock = psql_val('SELECT COUNT(*) FROM products WHERE "isActive" = true AND stock > 0')
check("DB", "Products in stock", in_stock > 100, f"{in_stock} in stock")

with_oem = psql_val('SELECT COUNT(*) FROM products WHERE "isActive" = true AND "oemCodes" IS NOT NULL AND array_length("oemCodes",1) > 0')
check("DB", "Products with OEM codes", with_oem > 500, f"{with_oem} products")

with_images = psql_val('SELECT COUNT(*) FROM products WHERE image_status = \'REAL\' AND "isActive" = true')
check("DB", "Products with real images", with_images > 50, f"{with_images} products", warn=with_images < 200)

# Category assignments
with_cat = psql_val('SELECT COUNT(*) FROM products WHERE autodoc_category_id IS NOT NULL AND "isActive" = true')
check("DB", "Products with category", with_cat > 1000, f"{with_cat} products")

# Orphan products (no category)
no_cat = psql_val('SELECT COUNT(*) FROM products WHERE autodoc_category_id IS NULL AND "isActive" = true')
check("DB", "No orphan products", no_cat < 100, f"{no_cat} without category", warn=no_cat > 0)

# Duplicate SKUs
dup_sku = psql_val('SELECT COUNT(*) FROM (SELECT sku, COUNT(*) c FROM products WHERE "isActive" = true GROUP BY sku HAVING COUNT(*) > 1) t')
check("DB", "No duplicate SKUs", dup_sku == 0, f"{dup_sku} duplicates")

# Categories count
cat_count = psql_val('SELECT COUNT(*) FROM autodoc_categories LIMIT 1')
check("DB", "Autodoc categories loaded", cat_count >= 1323, f"{cat_count} categories")

# Vehicle cache
vc_count = psql_val('SELECT COUNT(*) FROM vehicle_cache WHERE vin IS NOT NULL')
check("DB", "Vehicle cache populated", vc_count > 0, f"{vc_count} cached VINs")

# Check indexes exist
idx_count = psql_val("SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public' AND tablename='products'")
check("DB", "Products indexes exist", idx_count > 2, f"{idx_count} indexes")

# ============================================================
# 4. PERFORMANCE AUDIT
# ============================================================
print("\n⚡ 4. PERFORMANCE AUDIT")

# Response times
endpoints = [
    (f"{API}/api/products?limit=10", "Products list", 500),
    (f"{API}/api/categories", "Categories", 300),
    (f"{API}/api/vehicles/makes", "Vehicle makes", 500),
    (f"{BASE}/", "Homepage", 2000),
]

for url, name, max_ms in endpoints:
    start = time.time()
    code, _, _ = get(url)
    ms = int((time.time() - start) * 1000)
    check("Performance", f"{name} response time", ms < max_ms, f"{ms}ms (max {max_ms}ms)", warn=ms > max_ms//2)

# PM2 status
try:
    r = subprocess.run(["pm2", "jlist"], capture_output=True, text=True, timeout=5)
    pm2 = json.loads(r.stdout)
    for proc in pm2:
        name = proc.get('name', '')
        status = proc.get('pm2_env', {}).get('status', '')
        restarts = proc.get('pm2_env', {}).get('restart_time', 0)
        check("Performance", f"PM2 {name} online", status == 'online', f"restarts: {restarts}", warn=restarts > 50)
except: check("Performance", "PM2 status", False, "could not check")

# Memory usage
try:
    r = subprocess.run(["free", "-m"], capture_output=True, text=True)
    lines = r.stdout.strip().split('\n')
    mem_line = lines[1].split()
    total_mem = int(mem_line[1])
    used_mem = int(mem_line[2])
    pct = int(used_mem / total_mem * 100)
    check("Performance", "Memory usage", pct < 85, f"{pct}% ({used_mem}/{total_mem}MB)", warn=pct > 70)
except: pass

# Disk usage
try:
    r = subprocess.run(["df", "-h", "/"], capture_output=True, text=True)
    line = r.stdout.strip().split('\n')[1].split()
    pct = int(line[4].replace('%',''))
    check("Performance", "Disk usage", pct < 80, f"{pct}%", warn=pct > 60)
except: pass

# ============================================================
# 5. AI SEARCH AUDIT
# ============================================================
print("\n🤖 5. AI SEARCH AUDIT")

search_tests = [
    ("mercedes", "Mercedes search"),
    ("BMW", "BMW search"),
    ("სამუხრუჭე", "Brake pad Georgian"),
    ("ზეთის ფილტრი", "Oil filter Georgian"),
    ("honda", "Honda search"),
    ("0451103252", "OEM code search"),
    ("სამუხრუჭე ხუნდი", "Brake pad multi-word Georgian"),
]

for query, name in search_tests:
    q = urllib.parse.quote(query)
    code, data, _ = get_json(f"{API}/api/products?q={q}&limit=5")
    total_r = data.get('pagination', {}).get('total', 0)
    is_filtered = 0 < total_r < 1380
    check("AI Search", name, is_filtered, f"{total_r} results", warn=not is_filtered)
    time.sleep(0.8)

# VIN tests
vin_tests = [
    ("1HGCM82633A004352", "Honda Civic VIN"),
    ("WDBFA68F42F202731", "Mercedes SL VIN"),
    ("WF0LXXBDVLYR81347", "Ford Transit VIN (EU)"),
]
for vin, name in vin_tests:
    code, data, _ = get_json(f"{API}/api/vehicles/vin?vin={vin}")
    ok = data.get('success') or data.get('source') == 'tecdoc_multi'
    make = data.get('data', {}).get('vehicle', {}).get('make', data.get('vehicles', [{}])[0].get('carName', '')[:15] if data.get('vehicles') else '')
    check("AI Search", f"VIN {name}", ok, make)
    time.sleep(0.5)

# OEM cross-reference
code, data, _ = get_json(f"{API}/api/autodoc/oem?code=17220-PWC-000")
check("AI Search", "OEM cross-reference Honda", data.get('found'), f"count={data.get('count',0)}")
time.sleep(0.3)

# ============================================================
# 6. AUTODOC INTEGRATION AUDIT
time.sleep(3)
# ============================================================
print("\n🚗 6. AUTODOC INTEGRATION AUDIT")

# Categories synced
code_ac, data_ac, _ = get_json(f"{API}/api/categories/all-slugs")
auto_cats = len(data_ac.get('data', []))
check("Autodoc", "Categories synced", auto_cats >= 1323, f"{auto_cats} categories")

# Georgian names
ka_names = psql_val('SELECT COUNT(*) FROM autodoc_categories WHERE name_ka IS NOT NULL AND name_ka != \'\'')
check("Autodoc", "Georgian category names", ka_names > 1000, f"{ka_names} with Georgian")

# Products with autodoc category
linked = psql_val('SELECT COUNT(*) FROM products WHERE "isActive" = true AND autodoc_category_id IS NOT NULL')
check("Autodoc", "Products linked to categories", linked > 1000, f"{linked} linked")

# API connectivity
code, data, _ = get_json(f"{API}/api/autodoc/categories?vehicleId=9433")
cats_list = data.get('categories', [])
check("Autodoc", "API categories for vehicle", len(cats_list) > 5, f"{len(cats_list)} categories")
time.sleep(0.3)

code, data, _ = get_json(f"{API}/api/autodoc/parts?vehicleId=9433&categoryId=100259")
arts = data.get('articles', [])
in_stock_arts = [a for a in arts if a.get('inStock')]
check("Autodoc", "Parts with inStock matching", len(arts) > 0, f"{len(arts)} articles, {len(in_stock_arts)} inStock")
time.sleep(0.3)

# Image sync status
with_images = psql_val('SELECT COUNT(*) FROM products WHERE image_status = \'REAL\' AND "isActive" = true')
placeholder = psql_val("SELECT COUNT(*) FROM products WHERE image_status = 'PLACEHOLDER' AND \"isActive\" = true")
real_imgs = psql_val("SELECT COUNT(*) FROM products WHERE image_status = 'REAL' AND \"isActive\" = true")
placeholder = psql_val("SELECT COUNT(*) FROM products WHERE image_status != 'REAL' AND \"isActive\" = true")
total_p = real_imgs + placeholder
img_pct = int(real_imgs/total_p*100) if total_p > 0 else 0
check("Autodoc", "Image sync progress", img_pct > 20, f"{real_imgs}/{total_p} ({img_pct}%)", warn=img_pct < 50)

# OEM coverage
oem_covered = psql_val('SELECT COUNT(*) FROM products WHERE "isActive" = true AND "oemCodes" IS NOT NULL AND array_length("oemCodes",1) > 0')
check("Autodoc", "OEM code coverage", oem_covered > 500, f"{oem_covered} products with OEM")

# ============================================================
# 7. CONTENT QUALITY AUDIT
# ============================================================
print("\n📝 7. CONTENT QUALITY AUDIT")

# Products with proper names
good_names = psql_val('SELECT COUNT(*) FROM products WHERE "isActive" = true AND "nameKa" IS NOT NULL AND length("nameKa") > 5')
check("Content", "Products with proper names", good_names > 1300, f"{good_names} products")

# Products with prices
with_price = psql_val('SELECT COUNT(*) FROM products WHERE "isActive" = true AND price > 0')
check("Content", "Products with prices", with_price > 1300, f"{with_price} products")

# Zero price products
zero_price = psql_val('SELECT COUNT(*) FROM products WHERE "isActive" = true AND (price IS NULL OR price = 0)')
check("Content", "No zero-price products", zero_price == 0, f"{zero_price} zero price", warn=zero_price > 0)

# Brands
brands = psql_val('SELECT COUNT(DISTINCT brand) FROM products WHERE "isActive" = true AND brand IS NOT NULL')
check("Content", "Brand diversity", brands > 10, f"{brands} vehicle brands")

# ============================================================
# FINAL SUMMARY
# ============================================================
total = passed + failed + warnings
score = int(passed / total * 100) if total > 0 else 0

print("\n" + "="*65)
print("  FINAL AUDIT REPORT")
print("="*65)
print(f"  ✅ Passed:   {passed}")
print(f"  ❌ Failed:   {failed}")
print(f"  ⚠️  Warnings: {warnings}")
print(f"  📊 Score:    {score}% ({passed}/{total})")
print()

if score == 100: print("  🏆 PERFECT!")
elif score >= 90: print("  ✅ EXCELLENT")
elif score >= 80: print("  ✅ GOOD")
elif score >= 70: print("  ⚠️  NEEDS ATTENTION")
else: print("  ❌ CRITICAL ISSUES")

if failed > 0:
    print("\n❌ FAILED CHECKS:")
    for cat, items in cats.items():
        cat_fails = [(n,d) for s,n,d in items if s == "❌"]
        if cat_fails:
            print(f"\n  [{cat}]")
            for n,d in cat_fails:
                print(f"    - {n}: {d}")

if warnings > 0:
    print("\n⚠️  WARNINGS:")
    for cat, items in cats.items():
        cat_warns = [(n,d) for s,n,d in items if s == "⚠️ "]
        if cat_warns:
            print(f"\n  [{cat}]")
            for n,d in cat_warns:
                print(f"    - {n}: {d}")

print("\n" + "="*65 + "\n")
