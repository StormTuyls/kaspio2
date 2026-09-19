"""
Zet de gegenereerde seed om in (1) een kleine bootstrap-SQL en (2) JSON-payloads
die via PostgREST ingeladen worden. De bulk gaat bewust niet door de SQL-editor
maar door de gewone API, met RLS aan, zodat de seed dezelfde weg volgt als de
app zelf.
"""
import re, json, glob, os

OUT = os.path.dirname(os.path.abspath(__file__))
meta = json.load(open(os.path.join(OUT, "seed_meta.json")))
ORG = meta["org"]
S = open(os.path.join(OUT, "seed_01_structure.sql")).read()

SEED_ADMIN = "seed-admin@demo.kaspio.be"
SEED_PW = "kaspio-seed-2026"


def tuples(block):
    """Splits een VALUES-blok in losse tuples, met respect voor quotes."""
    rows, depth, cur, inq = [], 0, "", False
    i = 0
    while i < len(block):
        c = block[i]
        if inq:
            if c == "'":
                if i + 1 < len(block) and block[i + 1] == "'":
                    cur += "''"
                    i += 2
                    continue
                inq = False
            cur += c
        else:
            if c == "'":
                inq = True
                cur += c
            elif c == "(":
                depth += 1
                if depth == 1:
                    cur = ""
                else:
                    cur += c
            elif c == ")":
                depth -= 1
                if depth == 0:
                    rows.append(cur)
                    cur = ""
                else:
                    cur += c
            elif depth:
                cur += c
        i += 1
    return rows


def fields(t):
    """Splits één tuple op komma's buiten quotes; geeft python-waarden terug."""
    out, cur, inq, i = [], "", False, 0
    while i < len(t):
        c = t[i]
        if inq:
            if c == "'":
                if i + 1 < len(t) and t[i + 1] == "'":
                    cur += "'"
                    i += 2
                    continue
                inq = False
            else:
                cur += c
        else:
            if c == "'":
                inq = True
            elif c == ",":
                out.append(cur.strip())
                cur = ""
            else:
                cur += c
        i += 1
    out.append(cur.strip())
    return [None if v == "null" else v for v in out]


def block_after(marker, text):
    i = text.index(marker)
    j = text.index(";", i)
    return text[i + len(marker):j]


# --- pot_groups
groups = []
for t in tuples(block_after("insert into public.pot_groups (id, organisation_id, name, sort_order) values", S)):
    f = fields(t)
    groups.append({"id": f[0], "organisation_id": f[1], "name": f[2],
                   "sort_order": int(f[3])})

# --- pots
pots = []
for t in tuples(block_after("insert into public.pots (id, organisation_id, name, color, target_amount, forecast_amount, target_kind, group_id, description) values", S)):
    f = fields(t)
    pots.append({"id": f[0], "organisation_id": f[1], "name": f[2], "color": f[3],
                 "target_amount": (None if f[4] is None else float(f[4])),
                 "forecast_amount": (None if f[5] is None else float(f[5])),
                 "target_kind": f[6], "group_id": f[7], "description": f[8]})

# --- memberships (group_owner: één rij per comité, niet per potje)
mem = []
for t in tuples(block_after("insert into public.memberships (organisation_id, user_id, role, group_id, invited_by) values", S)):
    f = fields(t)
    mem.append({"organisation_id": f[0], "user_id": f[1], "role": f[2],
                "group_id": f[3], "invited_by": f[4]})

# --- auth users uit de structure-SQL halen
users = []
for m in re.finditer(
        r"values \('([0-9a-f\-]{36})', '00000000-0000-0000-0000-000000000000', 'authenticated',\s*\n?\s*'authenticated', '([^']+)',", S):
    users.append({"id": m.group(1), "email": m.group(2)})
names = dict(re.findall(r"insert into public\.profiles \(id, email, full_name\)\s*\nvalues \('([0-9a-f\-]{36})', '[^']+', '((?:[^']|'')*)'\)", S))
for u in users:
    u["full_name"] = names.get(u["id"], "").replace("''", "'")

# --- transacties
txs = []
for f in sorted(glob.glob(os.path.join(OUT, "seed_02_tx_*.sql"))):
    for line in open(f):
        line = line.strip().rstrip(",;")
        if not line.startswith("("):
            continue
        v = fields(line[1:-1])
        txs.append({"organisation_id": v[0], "pot_id": v[1],
                    "amount": float(v[2]), "direction": v[3],
                    "occurred_on": v[4], "memo": v[5], "counterparty": v[6],
                    "bank_account": v[7], "transfer_group": v[8]})

# --- recurring plans
R = open(os.path.join(OUT, "seed_03_recurring.sql")).read()
plans = []
if R.strip():
    for t in tuples(block_after("insert into public.recurring_plans (organisation_id, pot_id, kind, amount, day_of_month, counterparty, match_window_days, active) values", R)):
        f = fields(t)
        plans.append({"organisation_id": f[0], "pot_id": f[1], "kind": f[2],
                      "amount": float(f[3]), "day_of_month": int(f[4]),
                      "counterparty": f[5], "match_window_days": int(f[6]),
                      "active": f[7] == "true"})

for name, data in [("groups", groups), ("pots", pots), ("memberships", mem),
                   ("transactions", txs), ("plans", plans), ("users", users)]:
    json.dump(data, open(os.path.join(OUT, f"payload_{name}.json"), "w"),
              ensure_ascii=False)
    print(f"{name:14} {len(data)}")

# --- bootstrap SQL: org, tier, admin, en de accounts (auth.users kan niet via REST)
b = [f"""-- Bootstrap demo-org. De bulk (potjes, transacties) gaat via PostgREST.
do $$
declare v_org uuid;
begin
  for v_org in select id from public.organisations where id = '{ORG}' loop
    delete from public.allocations where organisation_id = v_org;
    delete from public.transactions where organisation_id = v_org;
    delete from public.recurring_plans where organisation_id = v_org;
    delete from public.distribution_shares where organisation_id = v_org;
    delete from public.memberships where organisation_id = v_org;
    delete from public.audit_log where organisation_id = v_org;
    delete from public.pots where organisation_id = v_org and not is_hoofdpot;
    delete from public.pot_groups where organisation_id = v_org;
    delete from public.pots where organisation_id = v_org;
    delete from public.subscriptions where organisation_id = v_org;
    delete from public.organisations where id = v_org;
  end loop;
end $$;

insert into public.organisations (id, name, owner_id)
values ('{ORG}', 'Koninklijke Stade Leuven Tennis',
        '8ce38e95-6a4f-4d5c-a659-8ef96fb3c023');

update public.subscriptions
   set tier = 'team', status = 'active',
       current_period_end = now() + interval '1 year'
 where organisation_id = '{ORG}';

insert into public.memberships (organisation_id, user_id, role)
values ('{ORG}', '8ce38e95-6a4f-4d5c-a659-8ef96fb3c023', 'admin');
"""]

allusers = users + [{"id": "00000000-0000-4000-8000-000000000001",
                     "email": SEED_ADMIN, "full_name": "Kaspio seed"}]
for u in allusers:
    pw = SEED_PW if u["email"] == SEED_ADMIN else "kaspio-demo"
    b.append(f"""insert into auth.users (id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data)
values ('{u["id"]}', '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', '{u["email"]}',
    extensions.crypt('{pw}', extensions.gen_salt('bf')), now(), now(), now(),
    '{{"provider":"email","providers":["email"]}}'::jsonb,
    '{{"full_name":"{u["full_name"]}"}}'::jsonb)
on conflict (id) do update set encrypted_password = excluded.encrypted_password,
    email_confirmed_at = excluded.email_confirmed_at;
insert into public.profiles (id, email, full_name)
values ('{u["id"]}', '{u["email"]}', '{u["full_name"].replace("'", "''")}')
on conflict (id) do update set full_name = excluded.full_name;""")

b.append(f"""
-- Tijdelijk admin-account waarmee de seed via de API inlaadt. Wordt op het
-- einde weer verwijderd.
insert into public.memberships (organisation_id, user_id, role)
values ('{ORG}', '00000000-0000-4000-8000-000000000001', 'admin');
""")
open(os.path.join(OUT, "bootstrap.sql"), "w").write("\n".join(b))
print("\nbootstrap.sql", os.path.getsize(os.path.join(OUT, "bootstrap.sql")), "bytes")
print("org", ORG)
