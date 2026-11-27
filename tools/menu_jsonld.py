#!/usr/bin/env python3
"""Writes the menu as Google-readable structured data (schema.org Menu) into menu/index.html.

Reads menu.json (made by build_menu.py) and replaces the block between the
<!-- menu-jsonld --> and <!-- /menu-jsonld --> markers. English names, prices in IQD.
Run: python3 tools/menu_jsonld.py   (build_menu.py runs it for you)
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
menu = json.load(open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "menu.json"), encoding="utf-8"))
page = os.path.join(ROOT, "menu", "index.html")

def item(i):
    d = {"@type": "MenuItem", "name": i["name"]["en"]}
    if i.get("note", {}).get("en"): d["description"] = i["note"]["en"]
    prices = [o["price"] for o in i.get("options", []) if o.get("price")] or ([i["price"]] if i.get("price") else [])
    if prices: d["offers"] = {"@type": "Offer", "price": min(prices), "priceCurrency": "IQD"}
    return d

data = {
    "@context": "https://schema.org", "@type": "Menu", "name": "Amed Cafe menu",
    "url": "https://amedcaferest.com/menu/", "inLanguage": ["ckb", "ar", "en", "de"],
    "hasMenuSection": [{"@type": "MenuSection", "name": c["name"]["en"], "hasMenuItem": [item(i) for i in c["items"]]}
                       for c in menu["categories"]],
}
block = ('<!-- menu-jsonld -->\n<script type="application/ld+json">\n'
         + json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
         + '\n</script>\n<!-- /menu-jsonld -->')
html = open(page, encoding="utf-8").read()
if "<!-- menu-jsonld -->" in html:
    html = re.sub(r"<!-- menu-jsonld -->.*?<!-- /menu-jsonld -->", lambda m: block, html, flags=re.S)
else:
    html = html.replace("</head>", block + "\n</head>", 1)
open(page, "w", encoding="utf-8").write(html)
print("menu structured data:", sum(len(s["hasMenuItem"]) for s in data["hasMenuSection"]), "items")
