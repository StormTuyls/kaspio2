"""
Vult de verrichtingen van één groep aan in een org die met de hand is
opgebouwd. Leest per_group.json, koppelt post -> bestaand potje op naam en
schrijft de insert-SQL naar stdout.

Ids zijn uuid5 uit de bankreferte, dus opnieuw draaien voegt niets dubbel toe.
"""
import json, os, sys, uuid, datetime

OUT = os.path.dirname(os.path.abspath(__file__))
NS = uuid.UUID("6f2c1a3e-0000-5000-9000-000000000000")
ORG = "03be1d68-0be2-5b39-b86a-e3135dfdf6ca"
OWNER = "8ce38e95-6a4f-4d5c-a659-8ef96fb3c023"


def det(*parts):
    return str(uuid.uuid5(NS, "|".join(str(p) for p in parts)))


def q(s):
    if s is None or s == "":
        return "null"
    return "'" + str(s).replace("'", "''") + "'"


def tx(pot_id, r, ref):
    amt = round(float(r["amount"]), 2)
    direction = "in" if amt > 0 else "out"
    memo = r.get("memo")
    memo = str(memo).strip() if memo not in (None, "") else None
    if not memo:
        d = r.get("descr") or ""
        memo = d[:120].strip() or None
    return (f"  ('{det('tx', ref)}', '{ORG}', {q(pot_id)}, {abs(amt):.2f}, "
            f"'{direction}', '{r['date']}', {q(memo)}, {q(r.get('cp_name'))}, "
            f"{q(r.get('own'))}, '{OWNER}')")


# post-op-blad -> potnaam in de app. Alleen wat in deze groep hoort.
PLAN = json.load(open(os.path.join(OUT, sys.argv[1])))
per = json.load(open(os.path.join(OUT, "per_group.json")))

rows, rapport = [], []
for item in PLAN["posten"]:
    src = per[PLAN["comite"]][item["post"]]
    sel = [r for r in src
           if not item.get("cp_name") or r.get("cp_name") == item["cp_name"]]
    for r in sel:
        ref = r["ref"] or f"{item['post']}|{r.get('cp_name')}|{r['amount']}"
        rows.append(tx(item["pot_id"], r, ref))
    rapport.append((item["pot"], len(sel), sum(r["amount"] for r in sel),
                    item.get("stand")))

print("insert into public.transactions")
print("  (id, organisation_id, pot_id, amount, direction, occurred_on,")
print("   memo, counterparty, bank_account, created_by)")
print("values")
print(",\n".join(rows))
print("on conflict (id) do nothing;")
print()
for pot, n, som, stand in rapport:
    extra = "" if stand is None else f"   stand {stand:>12.2f}  verschil {som - stand:>9.2f}"
    print(f"-- {pot:<42} {n:>4} regels  som {som:>12.2f}{extra}")
