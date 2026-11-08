# Build the public customer data.json from the staff tool's db export.
# usage: python3 -I sync.py <customers_dir_with_json> <settings.json> <out data.json>
# Only members with a PIN are published; each is keyed by PBKDF2(pin, "amed-cafe:"+national number).
import json, sys, os, hashlib, re, time
cdir, spath, out = sys.argv[1:4]
s = json.load(open(spath)); s = s.get("data", s)
cc = re.sub(r"\D", "", s.get("countryCode") or "")
progs = s.get("programs") or [{"id": "drinks", "name": "Drinks", "target": 7, "reward": "free drink"}]
expiry = int(s.get("expiryDays") or 0)
now = int(time.time() * 1000); DAY = 864e5
today = time.strftime("%Y-%m-%d", time.gmtime(time.time() + 3 * 3600))  # Baghdad date
I18N = {"drinks": {"name_ar": "المشروبات", "reward_ar": "مشروب مجاني", "name_ku": "ڤەخوارن", "reward_ku": "ڤەخوارنەکا بێ بەرامبەر"},
        "shisha": {"name_ar": "الأركيلة", "reward_ar": "أركيلة مجانية", "name_ku": "نێرگەلە", "reward_ku": "نێرگەلەکا بێ بەرامبەر"}}

def norm(d):
    d = re.sub(r"\D", "", d)
    if d.startswith("00"): d = d[2:]
    if cc and d.startswith(cc) and len(d) > 10: d = d[len(cc):]
    return d.lstrip("0")

def key(phone, pin):
    return hashlib.pbkdf2_hmac("sha256", pin.encode(), ("amed-cafe:" + norm(phone)).encode(), 100000, 16).hex()

cards = {}
for root, _, files in os.walk(cdir):
    for f in files:
        if not f.endswith(".json"): continue
        doc = json.load(open(os.path.join(root, f)))
        cid = doc.get("id") or f[:-5]; c = doc.get("data", doc)
        pin = re.sub(r"\D", "", str(c.get("pin") or ""))
        if len(pin) != 4: continue
        ids = c.get("enrolled") or [p["id"] for p in progs]
        log = c.get("log") or []
        visits = c.get("visits") if isinstance(c.get("visits"), int) else sum(1 for e in log if e.get("type") == "stamp")
        entry = {"fn": (c.get("name") or "").split(" ")[0][:24], "code": c.get("code"), "v": visits, "yv": c.get("yearVisits") or {}, "lv": c.get("lastVisit"), "p": {}}
        for p in progs:
            if p["id"] not in ids: continue
            k = (c.get("cards") or {}).get(p["id"])
            if k is None and p["id"] == "drinks" and isinstance(c.get("stamps"), int):
                k = {"stamps": c.get("stamps", 0), "rewards": c.get("rewards", 0), "redeemed": c.get("redeemed", 0), "totalStamps": c.get("totalStamps", 0)}
            k = k or {}
            n = k.get("rewards", 0) or 0
            times = k.get("rewardTimes") if isinstance(k.get("rewardTimes"), list) and len(k.get("rewardTimes")) == n else [k.get("readySince") or c.get("lastVisit") or now] * n
            times = sorted(t for t in times if not expiry or t + expiry * DAY > now)
            nxt = int(times[0] + expiry * DAY) if (times and expiry) else 0
            entry["p"][p["id"]] = [k.get("stamps", 0) or 0, len(times), k.get("redeemed", 0) or 0, k.get("totalStamps", 0) or 0, nxt]
        cards[key(cid, pin)] = entry

data = {"updated": now, "cafe": s.get("cafe", "Amed Cafe"), "countryCode": cc, "staffLink": s.get("staffLink", ""),
        "expiryDays": expiry,
        "programs": [{**I18N.get(p["id"], {}), **{k: p[k] for k in ("id", "name", "target", "reward", "name_ar", "reward_ar", "name_ku", "reward_ku") if k in p}} for p in progs],
        "showPerks": bool(s.get("showPerks")),
        "levels": [{"name": l.get("name"), "visits": l.get("visits"), "stamps": l.get("stamps", 0), "perk": l.get("perk", ""), "perk_ar": l.get("perk_ar", ""), "perk_ku": l.get("perk_ku", "")} for l in (s.get("levels") or [])],
        "rules": {"limits": {p["id"]: int(p.get("dailyLimit") or 0) for p in progs}, "expiryDays": expiry,
                  "referral": {"enabled": bool((s.get("referral") or {}).get("enabled")), "bonus": (s.get("referral") or {}).get("bonus", 1)},
                  "birthday": {"enabled": bool((s.get("birthday") or {}).get("enabled")), "program": (s.get("birthday") or {}).get("program", "drinks")}},
        "offers": [{k: o.get(k) for k in ("name", "multiplier", "days", "from", "to", "programs")} for o in (s.get("offers") or []) if o.get("enabled")],
        "events": sorted([{k: e.get(k) for k in ("title", "date", "from", "to", "multiplier", "details")} for e in (s.get("events") or []) if (e.get("date") or "") >= today], key=lambda e: (e["date"], e.get("from") or ""))[:6],
        "contact": {"wa": (lambda w: (cc + w[1:]) if (w.startswith("0") and cc) else w)(re.sub(r"\D", "", s.get("cafeWhatsApp") or "")), "join": bool(s.get("joinEnabled"))},
        "cards": cards}
json.dump(data, open(out, "w"), ensure_ascii=False, separators=(",", ":"))
print("members published:", len(cards))
