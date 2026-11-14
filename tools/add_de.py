"""Add German ("de") to menu.json from tools/menu-de.json (English text -> German).
Run after build_menu.py (build_menu.py calls it). Texts without a German line are listed and stay English on the site."""
import json, os, sys
path = sys.argv[1] if len(sys.argv) > 1 else "menu.json"
de = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "menu-de.json")))
menu = json.load(open(path))
missing = []
def walk(x):
    if isinstance(x, dict):
        if {"en", "ar", "ku"} <= set(x):
            if x["en"] in de: x["de"] = de[x["en"]]
            elif x["en"] not in missing: missing.append(x["en"])
            return
        for v in x.values(): walk(v)
    elif isinstance(x, list):
        for v in x: walk(v)
walk(menu)
json.dump(menu, open(path, "w"), ensure_ascii=False, indent=1)
print("German added." + (" Missing (shown in English): " + "; ".join(missing) if missing else " Nothing missing."))
