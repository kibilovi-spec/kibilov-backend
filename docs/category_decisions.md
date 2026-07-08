# Category Duplicate Resolution Decisions

## Control Arm
- Canonical: 100203 (level 2, parent 100012)
- Alternative: 706384 (level 3, parent 706380 — commercial vehicle branch)
- Reason: 100203 has human-reviewed name_slang ("რიჩაგი"); 706384 has fallback slang (= name_ka, unworked). 706384 kept intact for its own branch, not deleted.
- Date: 2026-07-01

## V-Ribbed Belt
- Canonical: 100431 (level 3, parent 100082, name_slang "პოლი-V" human-reviewed)
- Alternative: 104309 (level 4, parent 104308, fallback name_slang, kept for own branch)
- PK-prefix regex added to categoryMatcher.js: /\d+PK\d+/i -> 100431 (confidence 98)
- Date: 2026-07-01

## Georgian Slang Aliases Added (batch1, 2026-07-01)
- ფერადო → 100030 (Brake Pad)
- ვინტილატორი → 100337 (Radiator Fan)
- ბაბინა → 100150 (Ignition Coil)
- ნაკლატკა / ნაკლატკა ცეპლენიის → 100053 (Clutch Disc)
- ჭრიჭინა → 100203 (Control Arm — canonical)
- ბალკის ტულკა → 100212 (Axle Cross Member/Axle Beam/Axle Beam Mounting)
- ზაჟიგანიის ზამოკი / ზაჟიგანია → 100008 (Spark/Glow Ignition — closest available; no dedicated Ignition Switch/Lock category exists in current 1325-tree)

## TODO
- Add `canonical_category_id` column to autodoc_categories
- Update categoryMatcher.js to resolve: match → COALESCE(canonical_category_id, autodoc_id) → save
- Add PK-prefix regex rule (\dPK\d+) for V-Ribbed Belt auto-detection
