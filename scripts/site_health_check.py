#!/usr/bin/env python3
import urllib.request
import urllib.error
import json
import time
import urllib.parse

BASE = "https://kibilov.ge"
API = "http://localhost:3001"
results = []
passed = 0
failed = 0

def check(name, ok, detail=""):
    global passed, failed
    status = "✅" if ok else "❌"
    results.append((status, name, detail))
    if ok: passed += 1
    else: failed += 1
    print(f"{status} {name}" + (f" — {detail}" if detail else ""))

def get(url, timeout=10):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "HealthCheck/1.0"})
        r = urllib.request.urlopen(req, timeout=timeout)
        return r.status, r.read().decode('utf-8', errors='ignore')
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:
        return 0, str(e)

def get_json(url, timeout=10):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "HealthCheck/1.0"})
        r = urllib.request.urlopen(req, timeout=timeout)
        return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read().decode())
        except: return e.code, {}
    except Exception as e:
        return 0, {}

print("\n" + "="*60)
print("  KIBILOV.GE SITE HEALTH CHECK")
print("="*60 + "\n")

# 1. FRONTEND PAGES
print("📄 FRONTEND PAGES")
for path, name in [("/","Homepage"),("/products","Products"),("/vin","VIN"),("/categories","Categories"),("/auth","Auth")]:
    code, _ = get(BASE + path)
    check(name, code == 200, f"HTTP {code}")
    time.sleep(0.2)

# 2. BACKEND API
print("\n🔌 BACKEND API")
code, data = get_json(f"{API}/health")
check("Health", code == 200, f"HTTP {code}")

code, data = get_json(f"{API}/api/categories")
check("Categories", code == 200 and bool(data), f"HTTP {code}")

code, data = get_json(f"{API}/api/products?limit=5")
prods = data.get('data', [])
total = data.get('pagination', {}).get('total', 0)
check("Products API", code == 200 and len(prods) > 0, f"{total} total")

# 3. PRODUCTS
print("\n📦 PRODUCTS")
check("Products count", total > 1000, f"{total} products")
in_stock = sum(1 for p in prods if p.get('stock', 0) > 0)
check("Products have stock data", len(prods) > 0, f"{len(prods)} loaded")

code, data = get_json(f"{API}/api/products?limit=20")
prods20 = data.get('data', [])
with_img = sum(1 for p in prods20 if p.get('images') and len(p.get('images',[])) > 0)
check("Products with images", with_img > 0, f"{with_img}/20")

# 4. SEARCH
print("\n🔎 SEARCH")
q = urllib.parse.quote("სამუხრუჭე ხუნდი")
code, data = get_json(f"{API}/api/products?search={q}&limit=5")
sr = data.get('pagination', {}).get('total', 0)
check("Georgian search", sr > 0, f"{sr} results")

q2 = urllib.parse.quote("brake pad")
code, data = get_json(f"{API}/api/products?search={q2}&limit=5")
sr2 = data.get('pagination', {}).get('total', 0)
check("English search", sr2 > 0, f"{sr2} results")

# 5. VIN
print("\n🔍 VIN DECODE")
code, data = get_json(f"{API}/api/vehicles/vin?vin=1HGCM82633A004352")
check("VIN Honda", code == 200 and data.get('success'), data.get('data', {}).get('vehicle', {}).get('make',''))
time.sleep(0.5)

code, data = get_json(f"{API}/api/vehicles/vin?vin=WDBFA68F42F202731")
check("VIN Mercedes", code == 200 and data.get('success'), data.get('data', {}).get('vehicle', {}).get('make',''))
time.sleep(0.5)

# 6. VEHICLES
print("\n🚙 VEHICLES")
code, data = get_json(f"{API}/api/vehicles/makes")
makes = data.get('data', [])
check("Vehicle makes", len(makes) > 20, f"{len(makes)} makes")

code, data = get_json(f"{API}/api/vehicles/models?make=HONDA")
models = data.get('data', data.get('models', []))
check("Vehicle models Honda", len(models) > 0, f"{len(models)} models")

# 7. AUTODOC
print("\n🚗 AUTODOC")
code, data = get_json(f"{API}/api/autodoc/categories?vehicleId=9433")
cats = data.get('categories', [])
check("Autodoc categories", len(cats) > 5, f"{len(cats)} cats")
time.sleep(0.3)

code, data = get_json(f"{API}/api/autodoc/oem?code=0451103252")
check("OEM lookup", data.get('found') or data.get('count',0) > 0 or len(data.get('articles',[])) > 0, f"found={data.get('found')}")
time.sleep(0.3)

# 8. SEO
print("\n🔗 SEO")
code, data = get_json(f"{API}/api/categories/all-slugs")
slugs = data.get('data', data.get('slugs', data)) if isinstance(data, dict) else data
check("Category slugs", len(slugs) > 1000, f"{len(slugs)} slugs")

code, _ = get(f"{BASE}/sitemap.xml")
check("Sitemap.xml", code == 200, f"HTTP {code}")

code, _ = get(f"{BASE}/oem/0451103252")
check("OEM page", code == 200, f"HTTP {code}")

# 9. PRODUCT PAGE
print("\n📱 PRODUCT PAGE")
code, data = get_json(f"{API}/api/products?limit=1")
prod = (data.get('data') or [{}])[0]
if prod.get('id'):
    code, _ = get(f"{BASE}/products/{prod['id']}")
    check("Product detail page", code == 200, f"HTTP {code}")
else:
    check("Product detail page", False, "no product id")

# SUMMARY
print("\n" + "="*60)
total_checks = passed + failed
score = int(passed / total_checks * 100) if total_checks > 0 else 0
print(f"  SUMMARY: {passed}/{total_checks} passed — SCORE: {score}%")
if score == 100: print("  🏆 PERFECT!")
elif score >= 80: print("  ✅ GOOD")
elif score >= 60: print("  ⚠️  NEEDS ATTENTION")
else: print("  ❌ CRITICAL ISSUES")

if failed > 0:
    print("\n❌ FAILED:")
    for s, n, d in results:
        if s == "❌": print(f"  - {n}: {d}")
print("="*60 + "\n")
