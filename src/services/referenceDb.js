// kibilov.ge Reference DB — OEM კოდები და სპეციფიკაციები
// სტრუქტურა: "make|model|generation" → part_type → [[brand, code, description]]
// description-ში cap:X.XL = ზეთის/სითხის მოცულობა

const REF = {

  // ─── TOYOTA ───────────────────────────────────────────────────────────────

  "toyota|camry|xv40": { // 2006-2011, 2.4L 2AZ-FE
    "oil filter":         [["Toyota OEM","04152-YZZA6","Oil Filter 2AZ | cap:4.5L"],["Mann","HU 68/1","Oil Filter"],["Bosch","F026407006","Oil Filter"]],
    "air filter":         [["Toyota OEM","17801-0H010","Air Filter XV40"],["Mann","C 25 004","Air Filter"],["K&N","33-2361","Performance"]],
    "cabin filter":       [["Toyota OEM","87139-07010","Cabin Filter"],["Mann","CU 2842","Cabin Filter"]],
    "engine oil":         [["Toyota OEM","08880-80846","5W-30 | cap:4.5L (w/filt:4.7L)"],["Mobil 1","153669","0W-20 4L"],["Castrol","15669B","EDGE 5W-30 4L"]],
    "front brake pad":    [["Toyota OEM","04465-33480","Front Brake Pad XV40"],["TRW","GDB3445","Front Pad"],["Brembo","P83073","Front Pad"]],
    "rear brake pad":     [["Toyota OEM","04466-33120","Rear Brake Pad XV40"],["TRW","GDB3446","Rear Pad"]],
    "spark plug":         [["Toyota OEM","90919-01253","Iridium 2AZ x4"],["NGK","ILFR6J11","Iridium x4"],["Denso","SK20HR11","Iridium x4"]],
    "timing chain":       [["Toyota OEM","13506-0H010","Timing Chain 2AZ"],["Iwis","59134","Chain Kit"]],
    "shock absorber":     [["KYB","339047","Front Shock XV40"],["Monroe","72944","Front Shock"],["Sachs","316 423","Front Shock"]],
    "antifreeze coolant": [["Toyota OEM","00272-1LLAC","Toyota SLLC | cap:7.2L"],["Zerex","ZXTU1","Asian Vehicle 1L"]],
    "brake fluid":        [["Toyota OEM","00475-1BF03","DOT3 12oz"],["ATE","706202","DOT4 500ml"]],
    "wheel bearing":      [["Toyota OEM","90369-40065","Front Hub XV40"],["SKF","VKBA3574","Front Hub"],["FAG","713 6107 60","Front Bearing"]],
    "water pump":         [["Toyota OEM","16100-29085","Water Pump 2AZ"],["Gates","TW282","Water Pump"],["Aisin","WPT-059","Water Pump"]],
    "thermostat":         [["Toyota OEM","90916-03096","Thermostat 2AZ"],["Gates","TH33188G1","Thermostat"],["Wahler","3.1054.87D","Thermostat"]]
  },

  "toyota|camry|xv50": { // 2012-2017, 2.5L 2AR-FE
    "oil filter":         [["Toyota OEM","04152-YZZA6","Oil Filter 2AR | cap:4.8L"],["Mann","HU 710/4 x","Oil Filter"],["Bosch","F026407123","Oil Filter"]],
    "air filter":         [["Toyota OEM","17801-36020","Air Filter XV50"],["Mann","C 27 006","Air Filter"]],
    "cabin filter":       [["Toyota OEM","87139-07010","Cabin Filter"],["Mann","CU 2842","Cabin Filter"]],
    "engine oil":         [["Toyota OEM","00279-0WQTE","0W-20 Full Syn | cap:4.8L (w/filt:5.1L)"],["Mobil 1","153669","0W-20 5L"],["Castrol","15669C","EDGE 0W-20"]],
    "front brake pad":    [["Toyota OEM","04465-06290","Front Brake Pad XV50"],["Akebono","ASP1100A","ProACT Ceramic"],["TRW","GDB3520","Front Pad"]],
    "rear brake pad":     [["Toyota OEM","04466-06090","Rear Brake Pad XV50"],["Brembo","P83074","Rear Pad"]],
    "spark plug":         [["Toyota OEM","90919-01210","Iridium 2AR x4"],["NGK","DILFR6D11","Iridium x4"]],
    "timing chain":       [["Toyota OEM","13506-0V020","Timing Chain 2AR"],["Cloyes","9-4224","Chain Kit 2AR-FE"]],
    "shock absorber":     [["KYB","339273","Front Shock XV50"],["Monroe","72944","Front Shock"]],
    "antifreeze coolant": [["Toyota OEM","00272-1LLAC","Toyota SLLC | cap:7.5L"],["Zerex","ZXTU1","Asian Vehicle 1L"]],
    "brake fluid":        [["Toyota OEM","00475-1BF03","DOT3"],["ATE","706202","DOT4 500ml"]],
    "water pump":         [["Toyota OEM","16100-39466","Water Pump 2AR"],["Aisin","WPT-192","Water Pump"]],
    "thermostat":         [["Toyota OEM","90916-03124","Thermostat 2AR"],["Gates","TH33188G1","Thermostat"]]
  },

  "toyota|camry|xv70": { // 2018+, 2.5L A25A-FKS
    "oil filter":         [["Toyota OEM","04152-YZZA6","Oil Filter A25A | cap:4.8L"],["Mann","HU 710/4 x","Oil Filter"]],
    "air filter":         [["Toyota OEM","17801-F0010","Air Filter XV70"],["Mann","C 27 006","Air Filter"]],
    "engine oil":         [["Toyota OEM","08880-83388","0W-16 Full Syn | cap:4.8L"],["Mobil 1","153669","0W-20 5L"]],
    "front brake pad":    [["Toyota OEM","04465-06360","Front Brake Pad XV70"],["TRW","GDB3621","Front Pad"]],
    "rear brake pad":     [["Toyota OEM","04466-06200","Rear Brake Pad XV70"],["Brembo","P83109","Rear Pad"]],
    "spark plug":         [["Toyota OEM","90919-01253","Iridium A25A x4"],["NGK","DILFR5A-11G","Iridium x4"]],
    "antifreeze coolant": [["Toyota OEM","00272-1LLAC","Toyota SLLC | cap:7.0L"]]
  },

  "toyota|corolla|e150": { // 2006-2013, 1.6L 1ZR-FE
    "oil filter":         [["Toyota OEM","90915-YZZD4","Oil Filter 1ZR | cap:3.9L"],["Mann","HU 68/1","Oil Filter"],["Bosch","F026407006","Oil Filter"]],
    "air filter":         [["Toyota OEM","17801-22020","Air Filter 1ZR"],["Mann","C 25 004","Air Filter"]],
    "engine oil":         [["Toyota OEM","08880-80846","5W-30 | cap:3.9L (w/filt:4.1L)"],["Castrol","15669B","EDGE 5W-30 4L"]],
    "front brake pad":    [["Toyota OEM","04465-02200","Front Brake Pad E150"],["TRW","GDB3416","Front Pad"]],
    "spark plug":         [["Toyota OEM","90919-01253","Iridium 1ZR x4"],["NGK","ILFR6J11","Iridium x4"]],
    "timing belt":        [["Toyota OEM","13568-09060","Timing Belt Kit 1ZR"],["Gates","TCK328","Timing Belt Kit"],["Continental","CT1028WP2","Kit+Pump"]],
    "antifreeze coolant": [["Toyota OEM","00272-1LLAC","Toyota SLLC | cap:6.0L"]],
    "water pump":         [["Toyota OEM","16100-29085","Water Pump 1ZR"],["Gates","TW282","Water Pump"]]
  },

  "toyota|corolla|e160": { // 2013-2019, 1.6L 1ZR / 1.8L 2ZR
    "oil filter":         [["Toyota OEM","90915-YZZD4","Oil Filter | cap:4.2L"],["Mann","HU 68/1","Oil Filter"]],
    "engine oil":         [["Toyota OEM","08880-80846","5W-30 | cap:4.2L"],["Castrol","15669B","EDGE 5W-30 4L"]],
    "front brake pad":    [["Toyota OEM","04465-02390","Front Brake Pad E160"],["TRW","GDB3522","Front Pad"]],
    "air filter":         [["Toyota OEM","17801-37020","Air Filter E160"],["Mann","C 27 006","Air Filter"]],
    "timing belt":        [["Toyota OEM","13568-37020","Timing Belt Kit 1ZR"],["Gates","TCK328","Timing Belt Kit"]],
    "antifreeze coolant": [["Toyota OEM","00272-1LLAC","Toyota SLLC | cap:6.2L"]]
  },

  "toyota|rav4|xa30": { // 2005-2012, 2.4L 2AZ-FE
    "oil filter":         [["Toyota OEM","04152-YZZA6","Oil Filter 2AZ | cap:4.5L"],["Mann","HU 68/1","Oil Filter"]],
    "engine oil":         [["Toyota OEM","08880-80846","5W-30 | cap:4.5L"],["Mobil 1","153669","0W-20 4L"]],
    "front brake pad":    [["Toyota OEM","04465-42130","Front Brake Pad XA30"],["TRW","GDB3370","Front Pad"]],
    "rear brake pad":     [["Toyota OEM","04466-42060","Rear Brake Pad XA30"],["TRW","GDB3371","Rear Pad"]],
    "air filter":         [["Toyota OEM","17801-0H010","Air Filter XA30"],["Mann","C 25 004","Air Filter"]],
    "antifreeze coolant": [["Toyota OEM","00272-1LLAC","Toyota SLLC | cap:7.8L"]],
    "timing chain":       [["Toyota OEM","13506-0H010","Timing Chain 2AZ"],["Iwis","59134","Chain Kit"]]
  },

  "toyota|land cruiser|200": { // 2007-2021, 4.5L 1VD-FTV
    "oil filter":         [["Toyota OEM","04152-YZZA1","Oil Filter 1VD | cap:9.5L"],["Mann","HU 726/2 x","Oil Filter"]],
    "engine oil":         [["Toyota OEM","08883-02905","5W-40 Full Syn | cap:9.5L"],["Mobil 1","153694","5W-40 5L"]],
    "front brake pad":    [["Toyota OEM","04465-60260","Front Brake Pad 200"],["TRW","GDB3570","Front Pad"]],
    "rear brake pad":     [["Toyota OEM","04466-60150","Rear Brake Pad 200"],["TRW","GDB3571","Rear Pad"]],
    "air filter":         [["Toyota OEM","17801-51020","Air Filter 1VD"],["Mann","C 30 130","Air Filter"]],
    "antifreeze coolant": [["Toyota OEM","00272-1LLAC","Toyota SLLC | cap:14.0L"]],
    "fuel filter":        [["Toyota OEM","23390-51070","Fuel Filter 1VD"],["Bosch","F026402840","Fuel Filter"]]
  },

  // ─── VOLKSWAGEN ───────────────────────────────────────────────────────────

  "volkswagen|golf|mk6": { // 2008-2013, 1.4T CBZB / 1.6TDI CAYA / 2.0TDI CFFA
    "oil filter":         [["VW OEM","03C115561H","Oil Filter 1.4T | cap:3.6L"],["Mann","HU 710/4 x","Oil Filter"],["Bosch","F026407123","Oil Filter"]],
    "air filter":         [["VW OEM","1K0129620D","Air Filter Golf 6"],["Mann","C 37 012","Air Filter"]],
    "cabin filter":       [["VW OEM","1K1819653C","Cabin Filter Golf 6"],["Mann","CU 22 023","Cabin Filter"]],
    "engine oil":         [["VW OEM","GS55502M2","VW 504 0W-30 5L | cap:3.6L"],["Liqui Moly","2315","Top Tec 4200 5W-30"],["Castrol","15669E","EDGE VW 504"]],
    "front brake pad":    [["VW OEM","1K0698151G","Front Brake Pad Golf 6"],["TRW","GDB1764","Front Pad"],["Brembo","P85073","Front Pad"]],
    "rear brake pad":     [["VW OEM","1K0698451E","Rear Brake Pad Golf 6"],["TRW","GDB1601","Rear Pad"]],
    "spark plug":         [["VW OEM","101905631B","Spark Plug 1.4T Golf 6"],["NGK","ILTR5A-13G","Iridium"]],
    "timing belt":        [["VW OEM","03L109119G","Timing Belt Kit 1.6TDI"],["Gates","KD556-3","Timing Belt Kit"],["Continental","CT1159WP3","Kit+Pump"]],
    "shock absorber":     [["KYB","335808","Front Shock Golf 6"],["Sachs","313 456","Front Shock"],["Bilstein","22-244719","Front B4"]],
    "antifreeze coolant": [["VW OEM","G013A8J1G","VW G13 Ready Mix | cap:6.5L"],["Febi","22353","Antifreeze G12 1L"]],
    "brake fluid":        [["VW OEM","B000750M3","DOT4 500ml"],["ATE","706202","DOT4 500ml"]],
    "wheel bearing":      [["VW OEM","1K0407621","Front Hub Golf 6"],["FAG","713 6441 80","Front Bearing"],["SKF","VKBA3587","Front Hub"]],
    "ball joint":         [["VW OEM","5Q0407366D","Ball Joint Golf 6"],["TRW","JBJ839","Ball Joint"]],
    "water pump":         [["VW OEM","03L121011E","Water Pump 1.6TDI"],["Gates","TW282","Water Pump"],["Hepu","P203","Water Pump"]]
  },

  "volkswagen|golf|mk7": { // 2012-2020, 1.4T CZCA / 2.0TDI CRBC
    "oil filter":         [["VW OEM","04E115561H","Oil Filter Golf 7 1.4T | cap:4.3L"],["Mann","HU 710/4 x","Oil Filter"],["Mahle","OX 188D","Oil Filter"]],
    "air filter":         [["VW OEM","5Q0129620B","Air Filter Golf 7"],["Mann","C 37 012","Air Filter"]],
    "cabin filter":       [["VW OEM","5Q1819653B","Cabin Filter Golf 7"],["Mann","CU 22 023","Cabin Filter"]],
    "engine oil":         [["VW OEM","GS55502M2","VW 504 0W-30 5L | cap:4.3L"],["Liqui Moly","2315","Top Tec 4200 5W-30"],["Castrol","15669E","EDGE VW 504"]],
    "front brake pad":    [["VW OEM","1K0698151G","Front Brake Pad Golf 7"],["TRW","GDB1764","Front Pad"],["Brembo","P85073","Front Pad"]],
    "rear brake pad":     [["VW OEM","1K0698451E","Rear Brake Pad Golf 7"],["TRW","GDB1601","Rear Pad"]],
    "spark plug":         [["VW OEM","101905631B","Spark Plug Golf 7 1.4T"],["NGK","ILTR5A-13G","Iridium"]],
    "timing belt":        [["VW OEM","04L109119G","Timing Belt Kit Golf 7 2.0TDI"],["Gates","KD556-3","Timing Belt Kit"]],
    "shock absorber":     [["KYB","335808","Front Shock Golf 7"],["Sachs","313 456","Front Shock"]],
    "antifreeze coolant": [["VW OEM","G013A8J1G","VW G13 Ready Mix | cap:6.5L"]],
    "brake fluid":        [["VW OEM","B000750M3","DOT4 500ml"],["ATE","706202","DOT4 500ml"]],
    "wheel bearing":      [["VW OEM","7L8407621","Front Hub Golf 7"],["FAG","713 6441 80","Front Bearing"]],
    "water pump":         [["VW OEM","04L121011E","Water Pump 2.0TDI"],["Gates","TW282","Water Pump"]]
  },

  "volkswagen|passat|b6": { // 2005-2010, 2.0T BWA / 1.9TDI BMP
    "oil filter":         [["VW OEM","03G115562","Oil Filter B6 | cap:4.5L"],["Mann","HU 726/2 x","Oil Filter"],["Mahle","OX 188D","Oil Filter"]],
    "engine oil":         [["VW OEM","GS55502M2","VW 504 0W-30 5L | cap:4.5L"],["Liqui Moly","2315","Top Tec 4200 5W-30"]],
    "front brake pad":    [["VW OEM","1K0698151G","Front Brake Pad B6"],["TRW","GDB1764","Front Pad"]],
    "rear brake pad":     [["VW OEM","1K0698451E","Rear Brake Pad B6"],["TRW","GDB1601","Rear Pad"]],
    "timing belt":        [["VW OEM","038109119M","Timing Belt Kit 1.9TDI"],["Gates","K015624XS","Timing Belt Kit"]],
    "air filter":         [["VW OEM","3C0129620","Air Filter B6"],["Mann","C 37 012","Air Filter"]],
    "antifreeze coolant": [["VW OEM","G013A8J1G","VW G13 | cap:8.5L"]],
    "shock absorber":     [["KYB","335808","Front Shock B6"],["Sachs","313 456","Front Shock"]]
  },

  // ─── BMW ──────────────────────────────────────────────────────────────────

  "bmw|3-series|e46": { // 1997-2006, M54 2.5L / M47 2.0D
    "oil filter":         [["BMW OEM","11427512300","Oil Filter M54 | cap:6.5L"],["Mann","HU 925/4 x","Oil Filter"],["Mahle","OX 188D","Oil Filter"]],
    "air filter":         [["BMW OEM","13721468520","Air Filter E46"],["Mann","C 32 325","Air Filter"]],
    "cabin filter":       [["BMW OEM","64319904453","Cabin Filter E46"],["Mann","CU 2141","Cabin Filter"]],
    "engine oil":         [["BMW OEM","83212365946","BMW LL-01 5W-30 5L | cap:6.5L"],["Castrol","15669C","EDGE LL-01 5W-30"],["Liqui Moly","2332","Leichtlauf 5W-40 5L"]],
    "front brake pad":    [["BMW OEM","34116761252","Front Brake Pad E46"],["Brembo","P06017","Front Pad E46"],["TRW","GDB1467","Front Pad"]],
    "rear brake pad":     [["BMW OEM","34216761253","Rear Brake Pad E46"],["Brembo","P06020","Rear Pad"]],
    "spark plug":         [["BMW OEM","12120032135","Spark Plug M54"],["NGK","BKR6EQUP","V-Power Plug"],["Bosch","0242229659","Platinum Plug"]],
    "timing chain":       [["BMW OEM","11311433594","Timing Chain M54"],["Iwis","59190","Timing Chain Kit"],["Febi","33772","Chain Kit"]],
    "shock absorber":     [["Sachs","313 264","Front Shock E46"],["KYB","335804","Front Shock"],["Bilstein","22-049018","Front B4 E46"]],
    "wheel bearing":      [["FAG","713 6107 60","Front Wheel Bearing E46"],["SKF","VKBA3574","Front Hub"],["Timken","HA590285","Front Hub"]],
    "antifreeze coolant": [["BMW OEM","82141467228","BMW Blue Coolant | cap:9.0L"],["Febi","26583","Antifreeze G11 1L"]],
    "brake fluid":        [["BMW OEM","83130009758","DOT4 500ml"],["ATE","706202","DOT4 500ml"]],
    "clutch kit":         [["BMW OEM","21207625513","Clutch Kit E46 M54"],["LuK","624 3231 34","Clutch Kit E46"],["Sachs","3000 951 556","Clutch Kit"]],
    "water pump":         [["BMW OEM","11510393337","Water Pump M54"],["Hepu","P217","Water Pump"],["Gates","WP0124","Water Pump"]],
    "thermostat":         [["BMW OEM","11531436780","Thermostat M54"],["Wahler","3.1054.87D","Thermostat"]]
  },

  "bmw|3-series|e90": { // 2005-2012, N52 2.5L / N47 2.0D
    "oil filter":         [["BMW OEM","11427953129","Oil Filter N52 | cap:6.5L"],["Mann","HU 925/4 x","Oil Filter"],["Mahle","OX 188D","Oil Filter"]],
    "air filter":         [["BMW OEM","13717521033","Air Filter E90"],["Mann","C 32 325","Air Filter"]],
    "cabin filter":       [["BMW OEM","64319171858","Cabin Filter E90"],["Mann","CU 2939","Cabin Filter"]],
    "engine oil":         [["BMW OEM","83212365946","BMW LL-01 5W-30 5L | cap:6.5L"],["Castrol","15669C","EDGE LL-01 5W-30"],["Liqui Moly","2332","Leichtlauf 5W-40"]],
    "front brake pad":    [["BMW OEM","34116775023","Front Brake Pad E90"],["Brembo","P06072","Front Pad E90"],["TRW","GDB1549","Front Pad"]],
    "rear brake pad":     [["BMW OEM","34216775314","Rear Brake Pad E90"],["Brembo","P06075","Rear Pad"]],
    "spark plug":         [["BMW OEM","12122158252","Spark Plug N52"],["NGK","ILZFR6D11","Iridium"],["Bosch","0242236563","Iridium"]],
    "timing chain":       [["BMW OEM","11317811998","Timing Chain N52"],["Iwis","59190","Chain Kit"],["Febi","38211","Chain Kit E90"]],
    "shock absorber":     [["Sachs","313 477","Front Shock E90"],["KYB","365019","Front Shock"],["Bilstein","22-139802","Front B4"]],
    "antifreeze coolant": [["BMW OEM","82141467228","BMW Blue Coolant | cap:8.5L"]],
    "brake fluid":        [["BMW OEM","83130009758","DOT4 500ml"],["ATE","706202","DOT4 500ml"]],
    "water pump":         [["BMW OEM","11517586925","Water Pump N52 Electric"],["Hepu","P990","Water Pump Electric"]],
    "thermostat":         [["BMW OEM","11537534521","Thermostat N52"],["Wahler","3.1054.87D","Thermostat"]]
  },

  "bmw|5-series|e60": { // 2003-2010, N52 / M57 3.0D
    "oil filter":         [["BMW OEM","11427953129","Oil Filter N52 | cap:6.5L"],["Mann","HU 925/4 x","Oil Filter"]],
    "engine oil":         [["BMW OEM","83212365946","BMW LL-01 5W-30 5L | cap:6.5L"],["Castrol","15669C","EDGE LL-01 5W-30"]],
    "front brake pad":    [["BMW OEM","34116763769","Front Brake Pad E60"],["Brembo","P06072","Front Pad"],["TRW","GDB1549","Front Pad"]],
    "rear brake pad":     [["BMW OEM","34216763025","Rear Brake Pad E60"],["Brembo","P06075","Rear Pad"]],
    "air filter":         [["BMW OEM","13717521033","Air Filter E60"],["Mann","C 32 325","Air Filter"]],
    "antifreeze coolant": [["BMW OEM","82141467228","BMW Blue Coolant | cap:9.5L"]],
    "shock absorber":     [["Sachs","313 477","Front Shock E60"],["KYB","365019","Front Shock"]],
    "timing chain":       [["BMW OEM","11317811998","Timing Chain N52"],["Iwis","59190","Chain Kit"]]
  },

  // ─── MERCEDES ─────────────────────────────────────────────────────────────

  "mercedes|c-class|w204": { // 2007-2014, M271 1.8T / OM651 2.2D
    "oil filter":         [["Mercedes OEM","A2711800009","Oil Filter M271 | cap:6.5L"],["Mann","HU 711/51 x","Oil Filter"],["Mahle","OX 188D","Oil Filter"]],
    "air filter":         [["Mercedes OEM","A2710940004","Air Filter M271"],["Mann","C 26 030","Air Filter"]],
    "cabin filter":       [["Mercedes OEM","A2038300318","Cabin Filter W204"],["Mann","CU 3667","Cabin Filter"]],
    "engine oil":         [["Mercedes OEM","A000989680613","MB 229.5 5W-30 5L | cap:6.5L"],["Castrol","15DB4A","EDGE 5W-30 5L"],["Liqui Moly","2316","Top Tec 4100 5W-40"]],
    "front brake pad":    [["Mercedes OEM","A0074207520","Front Pad W204"],["Textar","2431001","PRO OEM Pad"],["Brembo","P50141","Front Pad"]],
    "rear brake pad":     [["Mercedes OEM","A0084207420","Rear Pad W204"],["TRW","GDB1730","Rear Pad"]],
    "spark plug":         [["Bosch","0241235754","Spark Plug M271"],["NGK","DILZKBR7A11G","Iridium"]],
    "timing chain":       [["Mercedes OEM","A2710500211","Timing Chain Kit M271"],["Iwis","59476","Chain Kit W204"]],
    "shock absorber":     [["Mercedes OEM","A2043236300","Front Shock W204"],["Sachs","316 290","Front Shock"],["KYB","341718","Front Shock"]],
    "antifreeze coolant": [["Mercedes OEM","A000989082511","MB Coolant | cap:8.0L"],["Febi","22353","Antifreeze 1L"]],
    "brake fluid":        [["Mercedes OEM","A000989080111","DOT4 500ml"],["ATE","706202","DOT4 500ml"]],
    "wheel bearing":      [["Mercedes OEM","A2043300725","Front Hub W204"],["FAG","713 6675 20","Front Bearing"],["SKF","VKBA3574","Front Hub"]],
    "water pump":         [["Mercedes OEM","A2712000301","Water Pump M271"],["Hepu","P217","Water Pump"],["Gates","TW282","Water Pump"]],
    "thermostat":         [["Mercedes OEM","A2712000315","Thermostat M271"],["Wahler","3.1054.87D","Thermostat"]]
  },

  "mercedes|e-class|w212": { // 2009-2016, M274 2.0T / OM651 2.2D
    "oil filter":         [["Mercedes OEM","A2711800509","Oil Filter M274 | cap:7.0L"],["Mann","HU 514 x","Evo Filter"],["Mahle","OX 188D","Oil Filter"]],
    "air filter":         [["Mercedes OEM","A2710940004","Air Filter M274"],["Mann","C 26 030","Air Filter"]],
    "cabin filter":       [["Mercedes OEM","A2218300318","Cabin Filter W212"],["Mann","CU 3667","Cabin Filter"]],
    "engine oil":         [["Mercedes OEM","A000989680613","MB 229.5 5W-30 5L | cap:7.0L"],["Castrol","15DB4A","EDGE 5W-30 5L"],["Mobil 1","153773","ESP 5W-30 5L"]],
    "front brake pad":    [["Mercedes OEM","A0074207520","Front Pad W212"],["Textar","2431001","PRO OEM Pad"],["Brembo","P50141","Front Pad"]],
    "rear brake pad":     [["Mercedes OEM","A0084207420","Rear Pad W212"],["TRW","GDB1730","Rear Pad"]],
    "timing chain":       [["Mercedes OEM","A2710500211","Timing Chain Kit M274"],["Iwis","59476","Chain Kit W212"]],
    "shock absorber":     [["Mercedes OEM","A2123236300","Front Shock W212"],["Sachs","316 290","Front Shock"],["KYB","341718","Front Shock"]],
    "antifreeze coolant": [["Mercedes OEM","A000989082511","MB Coolant | cap:8.5L"]],
    "brake fluid":        [["Mercedes OEM","A000989080111","DOT4 500ml"],["ATE","706202","DOT4 500ml"]],
    "wheel bearing":      [["Mercedes OEM","A2043300725","Front Hub W212"],["FAG","713 6675 20","Front Bearing"]],
    "water pump":         [["Mercedes OEM","A2712000301","Water Pump M274"],["Hepu","P217","Water Pump"]]
  },

  "mercedes|sprinter|w906": { // 2006-2018, OM651 2.2D
    "oil filter":         [["Mercedes OEM","A6511800009","Oil Filter OM651 | cap:8.5L"],["Mann","HU 726/2 x","Oil Filter"]],
    "engine oil":         [["Mercedes OEM","A000989680613","MB 229.5 5W-30 5L | cap:8.5L"],["Castrol","15DB4A","EDGE 5W-30 5L"]],
    "fuel filter":        [["Mercedes OEM","A6510901152","Fuel Filter OM651"],["Mann","WK 939/2","Fuel Filter"]],
    "air filter":         [["Mercedes OEM","A6510940004","Air Filter OM651"],["Mann","C 30 130","Air Filter"]],
    "front brake pad":    [["Mercedes OEM","A0074207820","Front Pad Sprinter"],["TRW","GDB1730","Front Pad"]],
    "antifreeze coolant": [["Mercedes OEM","A000989082511","MB Coolant | cap:12.0L"]],
    "timing chain":       [["Mercedes OEM","A6510500311","Timing Chain Kit OM651"],["Iwis","59476","Chain Kit"]]
  },

  // ─── OPEL ─────────────────────────────────────────────────────────────────

  "opel|astra|h": { // 2004-2010, Z16XER 1.6 / Z20DMH 2.0D
    "oil filter":         [["Wunscher","SH 446 P","ზეთის ფილტრი Astra H | cap:4.2L"],["Mann","HU 716/2 x","Oil Filter"],["Mahle","OX 153D","Oil Filter"]],
    "engine oil":         [["Liqui Moly","2315","Top Tec 4200 5W-30 | cap:4.2L"],["Castrol","15669B","EDGE 5W-30 4L"]],
    "front brake pad":    [["SpeedMax","SP 431","წინა კალოტკა Astra H"],["GDB","GDB 1613","წინა კალოტკა Astra H"],["Wunscher","BB 4108","წინა კალოტკა Astra H"]],
    "thermostat":         [["Wunscher","1338178","თერმოსტატი Astra H 1.6"],["Wahler","3.1054.87D","Thermostat"]],
    "bushing":            [["Wunscher","16 03 266","ნაკანეჩნიკი Astra H"],["Wunscher","16 03 267","ნაკანეჩნიკი Astra H"]],
    "air filter":         [["Mann","C 25 004","Air Filter Astra H"],["Bosch","F026400368","Air Filter"]],
    "antifreeze coolant": [["Febi","22353","Antifreeze G12 1L | cap:7.5L"]]
  },

  "opel|astra|g": { // 1998-2009, Z16XER / Z18XER
    "oil filter":         [["Mann","HU 716/2 x","Oil Filter Astra G | cap:4.0L"],["Mahle","OX 153D","Oil Filter"]],
    "engine oil":         [["Liqui Moly","2315","Top Tec 4200 5W-30 | cap:4.0L"],["Castrol","15669B","EDGE 5W-30 4L"]],
    "front brake pad":    [["SpeedMax","SP 241","წინა კალოტკა Astra G 1.6"],["GDB","GDB 1351","წინა კალოტკა Astra G 1.6"],["Wunscher","BB 4020","წინა კალოტკა Astra G 1.6"]],
    "rear brake pad":     [["SpeedMax","SP 494","უკანა კალოტკა Astra G"],["GDB","GDB 1515","უკანა კალოტკა Astra G"],["Wunscher","BB 4057","უკანა კალოტკა Astra G"]],
    "water pump":         [["Wunscher","13 34 117","წყლის ტუმბო Astra G 1.7D"],["Wunscher","1334135","წყლის ტუმბო Astra G"]],
    "thermostat":         [["Wunscher","13 38 098","თერმოსტატი Astra G 1.8"],["Wahler","3.1054.87D","Thermostat"]],
    "rear shock absorber":[["Wunscher","230586","უკანა ამორტიზატორი Astra G"],["Wunscher","230589","უკანა ამორტიზატორი Astra G"]],
    "engine mount":       [["Wunscher","56 84 045","ძრავის ბალიში Astra G"],["Wunscher","5684040","ძრავის ბალიში Astra G 1.6"]],
    "antifreeze coolant": [["Febi","22353","Antifreeze G12 1L | cap:7.0L"]]
  },

  // ─── NISSAN ───────────────────────────────────────────────────────────────

  "nissan|x-trail|t31": { // 2007-2013, MR20DE 2.0L
    "oil filter":         [["Nissan OEM","15208-65F0A","Oil Filter MR20 | cap:4.3L"],["Mann","HU 65/1","Oil Filter"]],
    "engine oil":         [["Nissan OEM","KE900-90042","5W-30 | cap:4.3L"],["Castrol","15669B","EDGE 5W-30 4L"]],
    "front brake pad":    [["SpeedMax","SP 338","წინა კალოტკა X-Trail T31"],["GDB","GDB 3167","წინა კალოტკა"],["Wunscher","BB 4088","წინა კალოტკა X-Trail"]],
    "rear brake pad":     [["SpeedMax","SP 339","უკანა კალოტკა X-Trail T31"],["GDB","GDB 3294","უკანა კალოტკა"],["Wunscher","BB 4030","უკანა კალოტკა X-Trail"]],
    "air filter":         [["Nissan OEM","16546-EN20A","Air Filter MR20"],["Mann","C 24 013","Air Filter"]],
    "timing chain":       [["Nissan OEM","13028-EN20A","Timing Chain MR20"],["Iwis","59134","Chain Kit"]],
    "antifreeze coolant": [["Nissan OEM","KE902-99932","Nissan Blue | cap:7.0L"]]
  },

  "nissan|qashqai|j10": { // 2006-2013, HR16DE 1.6L / MR20DE 2.0L
    "oil filter":         [["Nissan OEM","15208-65F0A","Oil Filter | cap:3.8L"],["Mann","HU 65/1","Oil Filter"]],
    "engine oil":         [["Nissan OEM","KE900-90042","5W-30 | cap:3.8L"],["Castrol","15669B","EDGE 5W-30 4L"]],
    "front brake pad":    [["SpeedMax","SP 337","წინა კალოტკა Qashqai J10"],["GDB","GDB 3467","წინა კალოტკა"],["Wunscher","BB 4081","წინა კალოტკა Qashqai"]],
    "air filter":         [["Nissan OEM","16546-EN20A","Air Filter"],["Mann","C 24 013","Air Filter"]],
    "antifreeze coolant": [["Nissan OEM","KE902-99932","Nissan Blue | cap:6.5L"]]
  },

  // ─── HYUNDAI / KIA ────────────────────────────────────────────────────────

  "hyundai|tucson|jm": { // 2004-2010, G4GC 2.0L
    "oil filter":         [["Hyundai OEM","26300-35502","Oil Filter G4GC | cap:4.3L"],["Mann","HU 68/1","Oil Filter"]],
    "engine oil":         [["Hyundai OEM","05100-00610","5W-30 | cap:4.3L"],["Castrol","15669B","EDGE 5W-30 4L"]],
    "front brake pad":    [["SpeedMax","SP 361","წინა კალოტკა Tucson JM"],["GDB","GDB 1174","წინა კალოტკა"],["Wunscher","BB 4021","წინა კალოტკა Tucson"]],
    "air filter":         [["Hyundai OEM","28113-2E200","Air Filter G4GC"],["Mann","C 25 004","Air Filter"]],
    "timing belt":        [["Hyundai OEM","24312-23010","Timing Belt Kit G4GC"],["Gates","K015624XS","Timing Belt Kit"]],
    "antifreeze coolant": [["Hyundai OEM","00232-19000","Hyundai Blue | cap:6.5L"]]
  },

  "kia|sorento|xm": { // 2009-2014, D4HB 2.2D
    "oil filter":         [["Kia OEM","26320-2F000","Oil Filter D4HB | cap:6.0L"],["Mann","HU 726/2 x","Oil Filter"]],
    "engine oil":         [["Kia OEM","05100-00610","5W-30 | cap:6.0L"],["Castrol","15DB4A","EDGE 5W-30 5L"]],
    "fuel filter":        [["Kia OEM","31922-2F000","Fuel Filter D4HB"],["Mann","WK 939/2","Fuel Filter"]],
    "front brake pad":    [["SpeedMax","SP 361","წინა კალოტკა Sorento XM"],["GDB","GDB 1174","წინა კალოტკა"],["Wunscher","BB 4021","წინა კალოტკა Sorento"]],
    "rear brake pad":     [["SpeedMax","SP 339","უკანა კალოტკა Sorento XM"],["GDB","GDB 3294","უკანა კალოტკა"]],
    "timing chain":       [["Kia OEM","24312-2G000","Timing Chain D4HB"],["Iwis","59134","Chain Kit"]],
    "antifreeze coolant": [["Hyundai OEM","00232-19000","Hyundai Blue | cap:8.0L"]]
  },

  // ─── LADA ─────────────────────────────────────────────────────────────────

  "lada|niva|2121": { // 1977+, VAZ 21214 1.7L
    "oil filter":         [["Wunscher","2101-1012005","ზეთის ფილტრი Niva | cap:3.5L"],["Mann","HU 68/1","Oil Filter"]],
    "engine oil":         [["Lukoil","1555227","5W-40 4L | cap:3.5L"],["Castrol","15669B","EDGE 5W-30 4L"]],
    "front brake pad":    [["Wunscher","2101-3501090","წინა კალოტკა Niva"],["SpeedMax","SP 101","წინა კალოტკა Niva"]],
    "air filter":         [["Wunscher","2101-1109013","ჰაერის ფილტრი Niva"],["Mann","C 25 004","Air Filter"]],
    "antifreeze coolant": [["Wunscher","2101-1301010","ანტიფრიზი | cap:8.0L"]]
  },

  "lada|priora|2172": { // 2007-2018, VAZ 21126 1.6L
    "oil filter":         [["Wunscher","2101-1012005","ზეთის ფილტრი Priora | cap:3.5L"],["Mann","HU 68/1","Oil Filter"]],
    "engine oil":         [["Lukoil","1555227","5W-40 4L | cap:3.5L"],["Castrol","15669B","EDGE 5W-30 4L"]],
    "front brake pad":    [["Wunscher","2110-3501080","წინა კალოტკა Priora"],["SpeedMax","SP 241","წინა კალოტკა"]],
    "spark plug":         [["Wunscher","2112-3707010","სანთელი Priora x4"],["NGK","BKR6EQUP","Spark Plug x4"]],
    "antifreeze coolant": [["Wunscher","2101-1301010","ანტიფრიზი | cap:7.5L"]]
  },

  // ─── DAEWOO ───────────────────────────────────────────────────────────────

  "daewoo|nexia|n150": { // 1994-2016, A15SMS 1.5L
    "oil filter":         [["Wunscher","25011775","ზეთის ფილტრი Nexia | cap:3.5L"],["Mann","HU 68/1","Oil Filter"]],
    "engine oil":         [["Lukoil","1555227","5W-40 4L | cap:3.5L"],["Castrol","15669B","EDGE 5W-30 4L"]],
    "front brake pad":    [["SpeedMax","SP 252","წინა კალოტკა Nexia"],["GDB","GDB 1040","წინა კალოტკა"],["Wunscher","BB 4026","წინა კალოტკა Nexia"]],
    "air filter":         [["Mann","C 25 004","Air Filter Nexia"],["Bosch","F026400368","Air Filter"]],
    "spark plug":         [["NGK","BKR6EQUP","Spark Plug Nexia x4"],["Bosch","0242229659","Spark Plug x4"]],
    "antifreeze coolant": [["Febi","22353","Antifreeze | cap:6.0L"]],
    "timing belt":        [["Gates","K015624XS","Timing Belt Kit A15SMS"],["Continental","CT1028WP2","Kit+Pump"]]
  },

  "daewoo|matiz|m100": { // 1998-2015, F8CV 0.8L
    "oil filter":         [["Wunscher","96183590","ზეთის ფილტრი Matiz | cap:2.5L"],["Mann","HU 68/1","Oil Filter"]],
    "engine oil":         [["Lukoil","1555227","5W-40 4L | cap:2.5L"],["Castrol","15669B","EDGE 5W-30 4L"]],
    "front brake pad":    [["SpeedMax","SP 252","წინა კალოტკა Matiz"],["Wunscher","BB 4026","წინა კალოტკა Matiz"]],
    "spark plug":         [["NGK","BKR6EQUP","Spark Plug Matiz x4"],["Bosch","0242229659","Spark Plug x4"]],
    "timing belt":        [["Gates","K015624XS","Timing Belt F8CV"],["Wunscher","96143380","ღვედი Matiz"]]
  }

};

// ─── Generation Mapping — year → generation key ───────────────────────────────

const GEN_MAP = {
  "toyota|camry":          [
    { from:2006, to:2011, gen:"xv40" },
    { from:2012, to:2017, gen:"xv50" },
    { from:2018, to:2099, gen:"xv70" }
  ],
  "toyota|corolla":        [
    { from:2006, to:2013, gen:"e150" },
    { from:2013, to:2019, gen:"e160" }
  ],
  "toyota|rav4":           [
    { from:2005, to:2012, gen:"xa30" }
  ],
  "toyota|land cruiser":   [
    { from:2007, to:2021, gen:"200" }
  ],
  "volkswagen|golf":       [
    { from:2008, to:2013, gen:"mk6" },
    { from:2012, to:2020, gen:"mk7" }
  ],
  "volkswagen|passat":     [
    { from:2005, to:2010, gen:"b6" }
  ],
  "bmw|3-series":          [
    { from:1997, to:2005, gen:"e46" },
    { from:2005, to:2012, gen:"e90" }
  ],
  "bmw|5-series":          [
    { from:2003, to:2010, gen:"e60" }
  ],
  "mercedes|c-class":      [
    { from:2007, to:2014, gen:"w204" }
  ],
  "mercedes|e-class":      [
    { from:2009, to:2016, gen:"w212" }
  ],
  "mercedes|sprinter":     [
    { from:2006, to:2018, gen:"w906" }
  ],
  "opel|astra":            [
    { from:1998, to:2004, gen:"g" },
    { from:2004, to:2010, gen:"h" }
  ],
  "nissan|x-trail":        [
    { from:2007, to:2013, gen:"t31" }
  ],
  "nissan|qashqai":        [
    { from:2006, to:2013, gen:"j10" }
  ],
  "hyundai|tucson":        [
    { from:2004, to:2010, gen:"jm" }
  ],
  "kia|sorento":           [
    { from:2009, to:2014, gen:"xm" }
  ],
  "lada|niva":             [
    { from:1977, to:2099, gen:"2121" }
  ],
  "lada|priora":           [
    { from:2007, to:2018, gen:"2172" }
  ],
  "daewoo|nexia":          [
    { from:1994, to:2016, gen:"n150" }
  ],
  "daewoo|matiz":          [
    { from:1998, to:2015, gen:"m100" }
  ]
};

// ─── Quick Actions ────────────────────────────────────────────────────────────

const QUICK_ACTIONS = {
  "ზეთის შეცვლა":    ["engine oil","oil filter","air filter"],
  "წინა კალოტკა":    ["front brake pad"],
  "უკანა კალოტკა":   ["rear brake pad"],
  "ხუნდები":          ["front brake pad","rear brake pad"],
  "ფილტრები":         ["oil filter","air filter","cabin filter","fuel filter"],
  "სამუხრუჭე სისტემა":["front brake pad","rear brake pad","brake fluid"],
  "დათბობა":          ["thermostat","water pump","antifreeze coolant"],
  "ღვედი":            ["timing belt","timing chain"],
  "ამორტიზატორი":    ["shock absorber","front shock absorber","rear shock absorber"],
  "გადაბმულობა":     ["clutch kit"],
  "ელექტრო":          ["alternator","starter motor","ignition coil"],
  "საჭე":             ["tie rod","ball joint","bushing","wheel bearing"]
};

// ─── Service Kits ────────────────────────────────────────────────────────────

const SERVICE_KITS = {
  "ზეთის შეცვლა":    ["engine oil","oil filter"],
  "TO-15000":          ["engine oil","oil filter","air filter","cabin filter"],
  "TO-30000":          ["engine oil","oil filter","air filter","cabin filter","spark plug","fuel filter"],
  "სამუხრუჭე კომპლექტი": ["front brake pad","rear brake pad","brake fluid"]
};

// ─── Part aliases (ქართული/სლენგი → canonical) ───────────────────────────────

const PART_ALIASES = {
  "კალოტკა":         "front brake pad",
  "კალოდკა":         "front brake pad",
  "ხუნდი":           "front brake pad",
  "სამუხრუჭე ხუნდი":"front brake pad",
  "უკანა კალოტკა":   "rear brake pad",
  "უკანა ხუნდი":     "rear brake pad",
  "ზეთის ფილტრი":   "oil filter",
  "ჰაერის ფილტრი":  "air filter",
  "სალონის ფილტრი":  "cabin filter",
  "საწვავის ფილტრი": "fuel filter",
  "ძრავის ზეთი":    "engine oil",
  "ამორტიზატორი":   "shock absorber",
  "წინა ამორტი":    "shock absorber",
  "უკანა ამორტი":   "rear shock absorber",
  "თერმოსტატი":     "thermostat",
  "წყლის ტუმბო":   "water pump",
  "სათბობი ფილტრი": "fuel filter",
  "ანთების სანთელი":"spark plug",
  "სანთელი":        "spark plug",
  "ვარცხნილობა":    "timing chain",
  "ღვედი":          "timing belt",
  "სტეჟინი":        "tie rod",
  "სტერჟინი":       "tie rod",
  "გიტარა":         "control arm",
  "ბერკეტი":        "control arm",
  "შარვო":          "ball joint",
  "ნახევარღერძი":   "cv joint",
  "გრანატა":        "cv joint",
  "კლაჩი":          "clutch kit",
  "გადაბმულობა":    "clutch kit",
  "დინამო":         "alternator",
  "გენერატორი":     "alternator",
  "სტარტერი":       "starter motor"
};

// ─── Lookup functions ─────────────────────────────────────────────────────────

function normalizeKey(make, model) {
  return `${(make||'').toLowerCase().trim()}|${(model||'').toLowerCase().trim()}`;
}

function resolveGeneration(make, model, year) {
  const baseKey = normalizeKey(make, model);
  const gens = GEN_MAP[baseKey];
  if (!gens || !year) return null;
  const y = parseInt(year);
  for (const g of gens) {
    if (y >= g.from && y <= g.to) return g.gen;
  }
  return null;
}

function extractCapacity(description) {
  const match = (description || '').match(/cap:([\d.]+L)/i);
  return match ? match[1] : null;
}

function normalizePartType(partType) {
  const pt = (partType || '').toLowerCase().trim();
  return PART_ALIASES[pt] || pt;
}

function fuzzyPartMatch(k, pt) {
  if (pt.length < 4) return false;
  return k.includes(pt) || (pt.includes(k) && k.length >= 5);
}

function lookupRef(make, model, partType, year) {
  const pt = normalizePartType(partType);
  const baseKey = normalizeKey(make, model);

  // 1. year-aware: try with generation
  if (year) {
    const gen = resolveGeneration(make, model, year);
    if (gen) {
      const genKey = `${baseKey}|${gen}`;
      const data = REF[genKey];
      if (data) {
        // ზუსტი match
        if (data[pt]) return { items: data[pt], key: genKey, gen };
        // fuzzy match — "brake pad" → "front brake pad"
        const matches = {};
        for (const k in data) {
          if (fuzzyPartMatch(k, pt)) matches[k] = data[k];
        }
        if (Object.keys(matches).length) return { items: matches, key: genKey, gen, multi: true };
      }
    }
  }

  // 2. fallback — ყველა generation-ი შევამოწმოთ
  for (const key in REF) {
    if (!key.startsWith(baseKey + '|')) continue;
    const data = REF[key];
    if (data[pt]) return { items: data[pt], key };
    for (const k in data) {
      if (fuzzyPartMatch(k, pt)) return { items: data[k], key };
    }
  }

  return null;
}

function lookupQuickAction(make, model, action, year) {
  const partTypes = QUICK_ACTIONS[action];
  if (!partTypes) return null;
  const results = {};
  partTypes.forEach(pt => {
    const found = lookupRef(make, model, pt, year);
    if (found) results[pt] = found;
  });
  return Object.keys(results).length ? results : null;
}

function getCapacityFromItems(items) {
  if (!Array.isArray(items)) return null;
  for (const item of items) {
    const cap = extractCapacity(item[2]);
    if (cap) return cap;
  }
  return null;
}

module.exports = {
  lookupRef,
  lookupQuickAction,
  resolveGeneration,
  normalizePartType,
  getCapacityFromItems,
  QUICK_ACTIONS,
  SERVICE_KITS,
  PART_ALIASES,
  GEN_MAP
};

// ── დამატებითი მარკები ────────────────────────────────────────────────────────

Object.assign(REF, {

  "jeep|wrangler|jk": { // 2007-2018, 3.6L V6 / 2.8D
    "oil filter":         [["Mopar","68191349AA","Oil Filter 3.6L Pentastar | cap:5.7L"],["Mann","HU 718/5 x","Oil Filter"],["Bosch","F026407123","Oil Filter"]],
    "engine oil":         [["Mopar","68218950AB","5W-20 Full Syn | cap:5.7L"],["Mobil 1","153773","5W-20 5L"],["Castrol","15669C","EDGE 5W-20 5L"]],
    "air filter":         [["Mopar","68091070AA","Air Filter 3.6L"],["Mann","C 30 130","Air Filter"],["K&N","33-2386","Performance"]],
    "cabin filter":       [["Mopar","68321535AA","Cabin Filter JK"],["Mann","CU 2882","Cabin Filter"]],
    "front brake pad":    [["Mopar","68165716AA","Front Brake Pad JK"],["Brembo","P11026","Front Pad Wrangler"],["TRW","GDB1876","Front Pad JK"]],
    "rear brake pad":     [["Mopar","68165717AA","Rear Brake Pad JK"],["Brembo","P11027","Rear Pad Wrangler"]],
    "spark plug":         [["Mopar","SP149085AB","Spark Plug 3.6L x6"],["NGK","ILTR5A-13G","Iridium x6"]],
    "shock absorber":     [["Mopar","68003736AA","Front Shock JK"],["Bilstein","24-186742","Front B6 Wrangler"],["KYB","344374","Front Shock"]],
    "antifreeze coolant": [["Mopar","68163848AA","Mopar OAT | cap:11.0L"],["Zerex","ZXRU1","Red OAT 1L"]],
    "brake fluid":        [["Mopar","04318080","DOT3 12oz"],["ATE","706202","DOT4 500ml"]]
  },

  "jeep|grand cherokee|wk2": { // 2010-2021, 3.6L V6 / 5.7L V8 / 3.0D
    "oil filter":         [["Mopar","68191349AA","Oil Filter 3.6L | cap:5.7L"],["Mann","HU 718/5 x","Oil Filter"],["Mahle","OX 188D","Oil Filter"]],
    "engine oil":         [["Mopar","68218950AB","5W-20 Full Syn | cap:5.7L"],["Mobil 1","153773","5W-20 5L"],["Castrol","15669C","EDGE 5W-20"]],
    "front brake pad":    [["Mopar","68165716AA","Front Brake Pad WK2"],["Brembo","P11026","Front Pad"],["TRW","GDB1876","Front Pad"]],
    "rear brake pad":     [["Mopar","68165717AA","Rear Brake Pad WK2"],["Brembo","P11027","Rear Pad"]],
    "air filter":         [["Mopar","68091070AA","Air Filter 3.6L"],["Mann","C 30 130","Air Filter"]],
    "timing chain":       [["Mopar","68148058AA","Timing Chain Kit 3.6L"],["Cloyes","9-0753S","Chain Kit Pentastar"]],
    "antifreeze coolant": [["Mopar","68163848AA","Mopar OAT | cap:10.5L"],["Zerex","ZXRU1","Red OAT 1L"]],
    "shock absorber":     [["Mopar","68029903AB","Front Shock WK2"],["Bilstein","24-186742","Front B6"],["KYB","344374","Front Shock"]]
  },

  "honda|cr-v|re": { // 2006-2011, K24Z1/Z4 2.4L
    "oil filter":         [["Honda OEM","15400-RTA-003","Oil Filter K24 | cap:4.2L"],["Mann","HU 68/1","Oil Filter"],["Bosch","F026407006","Oil Filter"]],
    "engine oil":         [["Honda OEM","08218-99974","Honda 0W-20 4L | cap:4.2L"],["Castrol","15669C","EDGE 0W-20 4L"],["Mobil 1","153669","0W-20 4L"]],
    "front brake pad":    [["Honda OEM","45022-SWA-E51","Front Brake Pad RE"],["Brembo","P28059","Front Pad CR-V"],["TRW","GDB3308","Front Pad"]],
    "rear brake pad":     [["Honda OEM","43022-SWA-E01","Rear Brake Pad RE"],["Brembo","P28060","Rear Pad"]],
    "air filter":         [["Honda OEM","17220-RZA-000","Air Filter K24"],["Mann","C 25 008","Air Filter"]],
    "timing chain":       [["Honda OEM","14401-RZA-004","Timing Chain K24Z"],["Iwis","59134","Chain Kit"]],
    "antifreeze coolant": [["Honda OEM","OL999-9011","Honda Blue Type2 | cap:5.8L"],["Zerex","ZXTU1","Asian Vehicle 1L"]],
    "shock absorber":     [["KYB","334455","Front Shock CR-V RE"],["Monroe","72944","Front Shock"],["Sachs","316 423","Front Shock"]]
  },

  "honda|cr-v|rm": { // 2011-2016, K24Z7 2.4L
    "oil filter":         [["Honda OEM","15400-RTA-003","Oil Filter K24 | cap:4.4L"],["Mann","HU 68/1","Oil Filter"]],
    "engine oil":         [["Honda OEM","08218-99974","Honda 0W-20 4L | cap:4.4L"],["Castrol","15669C","EDGE 0W-20 4L"]],
    "front brake pad":    [["Honda OEM","45022-T0G-A01","Front Brake Pad RM"],["Brembo","P28059","Front Pad"],["TRW","GDB3308","Front Pad"]],
    "rear brake pad":     [["Honda OEM","43022-T0G-A00","Rear Brake Pad RM"],["Brembo","P28060","Rear Pad"]],
    "timing chain":       [["Honda OEM","14401-R5A-004","Timing Chain K24Z7"],["Iwis","59134","Chain Kit"]],
    "antifreeze coolant": [["Honda OEM","OL999-9011","Honda Blue | cap:5.9L"]]
  },

  "subaru|forester|sg": { // 2002-2008, EJ20/EJ25 2.0/2.5L
    "oil filter":         [["Subaru OEM","15208AA100","Oil Filter EJ | cap:4.5L"],["Mann","HU 68/1","Oil Filter"],["Bosch","F026407006","Oil Filter"]],
    "engine oil":         [["Subaru OEM","SOA427V1410","5W-30 | cap:4.5L"],["Castrol","15669B","EDGE 5W-30 4L"],["Mobil 1","153669","0W-20 4L"]],
    "front brake pad":    [["SpeedMax","SP 340","წინა კალოტკა Forester SG"],["GDB","GDB 3328","წინა კალოტკა"],["Wunscher","BB 4060","წინა კალოტკა Forester"]],
    "rear brake pad":     [["SpeedMax","SP 341","უკანა კალოტკა Forester SG"],["GDB","GDB 3223","უკანა კალოტკა"],["Wunscher","BB 4169","უკანა კალოტკა"]],
    "timing belt":        [["Subaru OEM","13028AA170","Timing Belt EJ25"],["Gates","T273","Timing Belt"],["Continental","CT1074WP4","Kit+Pump"]],
    "air filter":         [["Subaru OEM","16546AA08A","Air Filter EJ"],["Mann","C 25 004","Air Filter"]],
    "antifreeze coolant": [["Subaru OEM","SOA868V9210","Subaru Blue | cap:6.4L"],["Zerex","ZXTU1","Asian Vehicle 1L"]]
  },

  "mitsubishi|outlander|cw": { // 2006-2012, 4B11/4B12 2.0/2.4L
    "oil filter":         [["Mitsubishi OEM","MD135737","Oil Filter 4B12 | cap:4.3L"],["Mann","HU 68/1","Oil Filter"]],
    "engine oil":         [["Mitsubishi OEM","MZ320282","5W-30 | cap:4.3L"],["Castrol","15669B","EDGE 5W-30 4L"]],
    "front brake pad":    [["SpeedMax","SP 361","წინა კალოტკა Outlander CW"],["GDB","GDB 1174","წინა კალოტკა"],["Wunscher","BB 4021","წინა კალოტკა Outlander"]],
    "rear brake pad":     [["SpeedMax","SP 339","უკანა კალოტკა Outlander"],["GDB","GDB 3294","უკანა კალოტკა"],["Wunscher","BB 4030","უკანა კალოტკა"]],
    "timing belt":        [["Mitsubishi OEM","1145A027","Timing Belt 4B12"],["Gates","K015624XS","Timing Belt Kit"]],
    "air filter":         [["Mitsubishi OEM","1500A029","Air Filter 4B12"],["Mann","C 25 004","Air Filter"]],
    "antifreeze coolant": [["Mitsubishi OEM","MZ320291","Mitsubishi Blue | cap:7.0L"]]
  },

  "mazda|cx-5|ke": { // 2012-2017, SKYACTIV-G 2.0/2.5L / SKYACTIV-D 2.2D
    "oil filter":         [["Mazda OEM","LF01-14-302","Oil Filter SKYG | cap:4.5L"],["Mann","HU 68/1","Oil Filter"]],
    "engine oil":         [["Mazda OEM","0000-77-5W30-QT","0W-30 SKYACTIV | cap:4.5L"],["Castrol","15669B","EDGE 5W-30 4L"]],
    "front brake pad":    [["Mazda OEM","GHP9-33-28ZA","Front Brake Pad KE"],["TRW","GDB3416","Front Pad"],["Brembo","P49051","Front Pad CX-5"]],
    "rear brake pad":     [["Mazda OEM","GHP9-26-48ZA","Rear Brake Pad KE"],["TRW","GDB3417","Rear Pad"]],
    "air filter":         [["Mazda OEM","PE01-13-3A0","Air Filter SKYG"],["Mann","C 27 006","Air Filter"]],
    "timing chain":       [["Mazda OEM","PE01-12-201","Timing Chain SKYG"],["Iwis","59134","Chain Kit"]],
    "antifreeze coolant": [["Mazda OEM","0000-77-LLC2","Mazda FL22 | cap:7.0L"],["Zerex","ZXTU1","Asian Vehicle 1L"]]
  },

  "land rover|discovery|lr3": { // 2004-2009, 4.0L V6 / 2.7D TDV6
    "oil filter":         [["Land Rover OEM","LPX100590L","Oil Filter TDV6 | cap:8.5L"],["Mann","HU 726/2 x","Oil Filter"],["Mahle","OX 188D","Oil Filter"]],
    "engine oil":         [["Castrol","15669C","EDGE 5W-30 5L | cap:8.5L"],["Mobil 1","153773","ESP 5W-30 5L"]],
    "front brake pad":    [["Land Rover OEM","SFP500130","Front Brake Pad LR3"],["Brembo","P23072","Front Pad"],["TRW","GDB1467","Front Pad"]],
    "rear brake pad":     [["Land Rover OEM","SFP500110","Rear Brake Pad LR3"],["Brembo","P23073","Rear Pad"]],
    "antifreeze coolant": [["Land Rover OEM","TDJ000010","Land Rover OAT | cap:11.5L"],["Febi","22353","Antifreeze 1L"]],
    "timing chain":       [["Land Rover OEM","LR006498","Timing Chain TDV6"],["Iwis","59476","Chain Kit"]]
  },

  "chevrolet|cruze|j300": { // 2009-2016, F18D4 1.8L / Z20DMH 2.0D
    "oil filter":         [["Chevrolet OEM","55562258","Oil Filter F18D4 | cap:4.2L"],["Mann","HU 716/2 x","Oil Filter"],["Bosch","F026407123","Oil Filter"]],
    "engine oil":         [["Liqui Moly","2315","Top Tec 4200 5W-30 | cap:4.2L"],["Castrol","15669B","EDGE 5W-30 4L"]],
    "front brake pad":    [["Wunscher","BB 4164","წინა კალოტკა Cruze J300"],["SpeedMax","SP 431","წინა კალოტკა"],["GDB","GDB 1613","წინა კალოტკა Cruze"]],
    "rear brake pad":     [["Wunscher","BB 4476","უკანა კალოტკა Cruze"],["SpeedMax","SP 378","უკანა კალოტკა"]],
    "air filter":         [["Chevrolet OEM","13271191","Air Filter F18D4"],["Mann","C 25 004","Air Filter"]],
    "timing belt":        [["Gates","K015624XS","Timing Belt Kit F18D4"],["Continental","CT1028WP2","Kit+Pump"]],
    "antifreeze coolant": [["Febi","22353","Antifreeze G12 1L | cap:6.5L"]],
    "spark plug":         [["NGK","ILZFR6D11","Iridium x4"],["Bosch","0242236563","Iridium x4"]]
  },

  "renault|duster|hs": { // 2010-2021, H4M 1.6L / K9K 1.5D
    "oil filter":         [["Renault OEM","152089599R","Oil Filter H4M | cap:4.5L"],["Mann","HU 68/1","Oil Filter"]],
    "engine oil":         [["Renault OEM","7711943831","5W-40 | cap:4.5L"],["Castrol","15669B","EDGE 5W-30 4L"]],
    "front brake pad":    [["SpeedMax","SP 737","წინა კალოტკა Duster"],["GDB","GDB 1789","წინა კალოტკა"],["Wunscher","BB 4434","წინა კალოტკა Duster"]],
    "rear brake pad":     [["SpeedMax","SP 339","უკანა კალოტკა Duster"],["GDB","GDB 3294","უკანა კალოტკა"]],
    "air filter":         [["Renault OEM","165460062R","Air Filter H4M"],["Mann","C 25 004","Air Filter"]],
    "timing belt":        [["Renault OEM","130C17156R","Timing Belt H4M"],["Gates","K015624XS","Timing Belt Kit"]],
    "antifreeze coolant": [["Febi","22353","Antifreeze | cap:6.5L"]]
  },

  "peugeot|308|t7": { // 2007-2014, EP6 1.6T / DW10 1.6D
    "oil filter":         [["Peugeot OEM","1109CJ","Oil Filter EP6 | cap:4.5L"],["Mann","HU 716/2 x","Oil Filter"],["Mahle","OX 188D","Oil Filter"]],
    "engine oil":         [["Total","183105","Quartz 9000 5W-30 | cap:4.5L"],["Castrol","15669B","EDGE 5W-30 4L"]],
    "front brake pad":    [["SpeedMax","SP 751","წინა კალოტკა 308 T7"],["GDB","GDB 1761","წინა კალოტკა"],["Wunscher","BB 4433","წინა კალოტკა 308"]],
    "rear brake pad":     [["SpeedMax","SP 456","უკანა კალოტკა 308"],["GDB","GDB 1620","უკანა კალოტკა"]],
    "timing belt":        [["Peugeot OEM","0831L5","Timing Belt Kit EP6"],["Gates","K015624XS","Timing Belt Kit"]],
    "air filter":         [["Peugeot OEM","1444VH","Air Filter EP6"],["Mann","C 25 004","Air Filter"]],
    "antifreeze coolant": [["Total","183105","Coolant OAT | cap:7.0L"],["Febi","22353","Antifreeze 1L"]],
    "spark plug":         [["NGK","PLKR6B-10EG","Iridium EP6 x4"],["Bosch","0242229659","Platinum x4"]]
  }

});

// GEN_MAP განახლება
Object.assign(GEN_MAP, {
  "jeep|wrangler":          [{ from:2007, to:2018, gen:"jk" }],
  "jeep|grand cherokee":    [{ from:2010, to:2021, gen:"wk2" }],
  "honda|cr-v":             [{ from:2006, to:2011, gen:"re" }, { from:2011, to:2016, gen:"rm" }],
  "subaru|forester":        [{ from:2002, to:2008, gen:"sg" }],
  "mitsubishi|outlander":   [{ from:2006, to:2012, gen:"cw" }],
  "mazda|cx-5":             [{ from:2012, to:2017, gen:"ke" }],
  "land rover|discovery":   [{ from:2004, to:2009, gen:"lr3" }],
  "chevrolet|cruze":        [{ from:2009, to:2016, gen:"j300" }],
  "renault|duster":         [{ from:2010, to:2021, gen:"hs" }],
  "peugeot|308":            [{ from:2007, to:2014, gen:"t7" }]
});
