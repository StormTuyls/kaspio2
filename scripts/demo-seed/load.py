"""
Laadt de seed in via PostgREST, ingelogd als het tijdelijke seed-admin account.
Bewust niet via de SQL-editor: zo lopen de inserts door dezelfde RLS-policies en
triggers als de app zelf, en is een geslaagde load meteen een test daarvan.
"""
import json, os, sys, urllib.request, urllib.error

OUT = os.path.dirname(os.path.abspath(__file__))
ENV = "/Users/tuylss/Projects/kaspio2/.env.local"

conf = {}
for line in open(ENV):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        conf[k.strip()] = v.strip()

URL = conf["VITE_SUPABASE_URL"].rstrip("/")
KEY = conf.get("VITE_SUPABASE_PUBLISHABLE_KEY") or conf["VITE_SUPABASE_ANON_KEY"]


def call(path, payload, token=None, prefer=None):
    req = urllib.request.Request(
        URL + path,
        data=json.dumps(payload).encode(),
        method="POST",
        headers={"apikey": KEY, "Content-Type": "application/json",
                 "Authorization": f"Bearer {token or KEY}",
                 **({"Prefer": prefer} if prefer else {})})
    try:
        with urllib.request.urlopen(req) as r:
            body = r.read().decode()
            return r.status, body
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


# --- inloggen
st, body = call("/auth/v1/token?grant_type=password",
                {"email": "demo@demo.kaspio.be",
                 "password": "kaspio-demo"})
if st != 200:
    sys.exit(f"login mislukt ({st}): {body[:400]}")
TOKEN = json.loads(body)["access_token"]
print("ingelogd als seed-admin")


def insert(table, rows, chunk=200):
    done = 0
    for i in range(0, len(rows), chunk):
        batch = rows[i:i + chunk]
        st, body = call(f"/rest/v1/{table}", batch, TOKEN, prefer="return=minimal")
        if st not in (200, 201, 204):
            sys.exit(f"\n{table} rij {i} mislukt ({st}): {body[:600]}")
        done += len(batch)
        print(f"\r  {table:16} {done}/{len(rows)}", end="", flush=True)
    print()


def load(name):
    return json.load(open(os.path.join(OUT, f"payload_{name}.json")))


insert("pot_groups", load("groups"))
insert("pots", load("pots"))
insert("memberships", load("memberships"))
insert("transactions", load("transactions"), chunk=150)
plans = load("plans")
if plans:
    insert("recurring_plans", plans)
print("klaar")
