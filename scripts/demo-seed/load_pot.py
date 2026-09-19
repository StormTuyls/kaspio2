"""
Laadt de bankregels van één post op één bestaand potje, via PostgREST.

Bedoeld voor de posten die te groot zijn om met de hand door te geven. Logt in
als demo@demo.kaspio.be, dus de inserts lopen door dezelfde RLS en triggers als
de app: de trigger allocate_new_transaction maakt zelf de bevestigde allocatie
omdat pot_id meegegeven wordt.

  python3 load_pot.py <comite> <post> <pot_id>
"""
import json, os, sys, uuid, urllib.request, urllib.error

OUT = os.path.dirname(os.path.abspath(__file__))
NS = uuid.UUID("6f2c1a3e-0000-5000-9000-000000000000")
ORG = "03be1d68-0be2-5b39-b86a-e3135dfdf6ca"
OWNER = "8ce38e95-6a4f-4d5c-a659-8ef96fb3c023"

conf = {}
for line in open("/Users/tuylss/Projects/kaspio2/.env.local"):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        conf[k.strip()] = v.strip()
URL = conf["VITE_SUPABASE_URL"].rstrip("/")
KEY = conf.get("VITE_SUPABASE_PUBLISHABLE_KEY") or conf["VITE_SUPABASE_ANON_KEY"]


def call(path, payload, token=None, prefer=None):
    req = urllib.request.Request(
        URL + path, data=json.dumps(payload).encode(), method="POST",
        headers={"apikey": KEY, "Content-Type": "application/json",
                 "Authorization": f"Bearer {token or KEY}",
                 **({"Prefer": prefer} if prefer else {})})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


comite, post, pot = sys.argv[1], sys.argv[2], sys.argv[3]
src = json.load(open(os.path.join(OUT, "per_group.json")))[comite][post]
rows = []
for r in src:
    if not r["ref"]:
        continue                      # geen bankregel, hier niet aan de orde
    amt = round(float(r["amount"]), 2)
    memo = str(r["memo"]).strip() if r["memo"] not in (None, "") else None
    if not memo:
        memo = (r.get("descr") or "")[:120].strip() or None
    # De referte is per rekening genummerd, dus de rekening hoort in de sleutel.
    rows.append({
        "id": str(uuid.uuid5(NS, f"tx|{r['own']}|{r['ref']}")),
        "organisation_id": ORG, "pot_id": pot,
        "amount": abs(amt), "direction": "in" if amt > 0 else "out",
        "occurred_on": r["date"], "memo": memo,
        "counterparty": r["cp_name"], "bank_account": r["own"],
        "created_by": OWNER,
    })

# Dubbele refertes binnen dezelfde rekening: het blad plakt sommige blokken
# twee keer. Op id ontdubbelen, anders botst de insert op de primary key.
uniek = {r["id"]: r for r in rows}
rows = list(uniek.values())

st, body = call("/auth/v1/token?grant_type=password",
                {"email": "demo@demo.kaspio.be", "password": "kaspio-demo"})
if st != 200:
    sys.exit(f"login mislukt ({st}): {body[:300]}")
token = json.loads(body)["access_token"]

done = 0
for i in range(0, len(rows), 200):
    batch = rows[i:i + 200]
    st, body = call("/rest/v1/transactions", batch, token, prefer="return=minimal")
    if st not in (200, 201, 204):
        sys.exit(f"\nrij {i} mislukt ({st}): {body[:500]}")
    done += len(batch)
    print(f"\r  {done}/{len(rows)}", end="", flush=True)
print(f"\n{post}: {len(rows)} regels geladen, som "
      f"{sum((r['amount'] if r['direction'] == 'in' else -r['amount']) for r in rows):.2f}")
