"""
Hergebruikt de parser van build_seed.py, maar stopt vóór de SQL-generatie en
dumpt de bankregels per comité. Bedoeld voor de flow waarbij de groepen en
potjes met de hand in de app worden aangemaakt en de verrichtingen daarna per
groep ingeladen worden.

Schrijft per_group.json: {comite: {post: [regels]}}.
"""
import json, os, collections, datetime

OUT = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(OUT, "build_seed.py")).read()
head = src.split("# 6. SQL genereren")[0].rsplit("# " + "=" * 77, 1)[0]

g = {"__name__": "build_seed_parse",
     "__file__": os.path.join(OUT, "build_seed.py")}
exec(compile(head, "build_seed.py", "exec"), g)


def jsonable(v):
    if isinstance(v, (datetime.datetime, datetime.date)):
        return str(v)[:10]
    return v


per = collections.defaultdict(lambda: collections.defaultdict(list))
for bucket, soort in (("recs", "bank"), ("afsl", "afsluiting")):
    for r in g[bucket]:
        row = {k: jsonable(v) for k, v in r.items()}
        row["bucket"] = bucket
        per[r["comite"]][r["post"]].append(row)

per = {c: {p: v for p, v in sorted(ps.items())} for c, ps in sorted(per.items())}
json.dump(per, open(os.path.join(OUT, "per_group.json"), "w"),
          ensure_ascii=False, indent=1)

print("comités:", len(per))
for c, ps in per.items():
    n = sum(len(v) for v in ps.values())
    print(f"  {c:<24} {len(ps):>3} posten  {n:>5} regels")
print("losse (hoofdpot):", len(g["losse"]))
print("cashflow-only   :", len(g["extra"]) if "extra" in g else "n/a")
