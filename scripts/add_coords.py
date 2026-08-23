#!/usr/bin/env python3
"""Add coords to data.ts routes"""

import re

ROUTE_COORDS = {
    "Ennore": (13.2167, 80.3000),
    "Tondiarpet": (13.1356, 80.2922),
    "Kasimedu": (13.1189, 80.2933),
    "Triplicane": (13.0500, 80.2760),
    "Choolai": (13.0836, 80.2676),
    "Collector Nagar": (13.0773, 80.2133),
    "Water Tank": (13.0790, 80.2080),
    "East Mogappair": (13.0827, 80.1770),
    "CIT Nagar": (13.0290, 80.2330),
    "Loyola College": (13.0836, 80.2210),
    "Chinmayanagar": (13.0490, 80.1900),
    "Santhome": (13.0500, 80.2730),
    "Kovilambakkam": (12.9160, 80.1440),
    "Adambakkam": (12.9930, 80.2070),
    "MKB Nagar": (13.1189, 80.2470),
    "Perambur": (13.1189, 80.2330),
    "Thachoor": (13.2889, 80.3167),
    "Chengalpattu": (12.6900, 79.9700),
    "Guduvanchery": (12.8500, 80.0300),
    "Minjur": (13.2767, 80.2500),
    "Vyasarpadi": (13.1189, 80.2400),
    "ICF": (13.0830, 80.2150),
    "Thiruvallur": (13.1300, 79.9000),
    "Kakkalur": (13.1100, 79.9700),
    "Kancheepuram": (12.8380, 79.7000),
    "Orikkai": (12.8300, 79.7100),
    "Neelangkarai": (12.9300, 80.2500),
    "Guindy": (13.0100, 80.2200),
    "Sholinganallur": (12.8900, 80.2270),
    "Valluvarkottam": (13.0500, 80.2400),
    "Valasaravakkam": (13.0490, 80.1560),
    "Pallikaranai": (12.9300, 80.2100),
    "Sembakkam": (12.9200, 80.1100),
    "Kelambakkam": (12.7900, 80.2000),
    "Poombukar": (13.0490, 80.1100),
    "Vinayagapuram": (13.1100, 80.2300),
    "Vepampattu": (13.0830, 79.9700),
    "Ayyapakkam": (13.0770, 80.1300),
    "Thiruthani": (13.1800, 79.8200),
    "SR Gate": (13.2700, 79.9000),
    "K4 Police Station": (13.0850, 80.2200),
    "Arcot": (12.9100, 79.3300),
    "Kallikuppam": (13.0770, 80.1300),
    "Pudur": (13.0800, 80.1300),
    "Andarkuppam": (13.0900, 80.1500),
    "Avadi": (13.1100, 80.1100),
    "Kollumedu": (13.1400, 80.0800),
    "Agaram": (13.0800, 80.2200),
    "Velachery": (12.9800, 80.2200),
    "Pammal": (12.9700, 80.1700),
    "Sivanthangal": (12.9400, 80.1100),
}

path = "/home/z/my-project/src/lib/ritians/data.ts"
with open(path, "r") as f:
    content = f.read()

# Add coords to each route
for name, (lat, lng) in ROUTE_COORDS.items():
    # Match: routeName:"NAME",<ws>timing:"Boarding Points",<ws>start:"X am" },
    pattern = rf'(routeName:"{re.escape(name)}",\s+timing:"Boarding Points",\s+start:"[^"]+")( }})'
    replacement = rf'\1, coords:{{lat:{lat},lng:{lng}}} }}'
    content = re.sub(pattern, replacement, content)

with open(path, "w") as f:
    f.write(content)

print("Done adding route coords")
