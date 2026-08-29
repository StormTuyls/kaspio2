"""
Zet de details op de demo-org: budget (doel), prognose en een beschrijving per
potje, en een beheerder per groep.

De groepen in de app zijn met de hand gemaakt en volgen niet de comité-indeling
van het rekenblad. Daarom matchen we per comité op de naam van het potje, binnen
de groepen die bij dat comité horen. Zo botst "VARIA" niet met de zes andere
VARIA-potjes elders in de org.
"""
import json, os, re, sys, urllib.request, urllib.error, urllib.parse

OUT = os.path.dirname(os.path.abspath(__file__))
ORG = "03be1d68-0be2-5b39-b86a-e3135dfdf6ca"

conf = {}
for line in open("/Users/tuylss/Projects/kaspio2/.env.local"):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        conf[k.strip()] = v.strip()
URL = conf["VITE_SUPABASE_URL"].rstrip("/")
KEY = conf.get("VITE_SUPABASE_PUBLISHABLE_KEY") or conf["VITE_SUPABASE_ANON_KEY"]


def call(path, payload=None, token=None, method="GET", prefer=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        URL + path, data=data, method=method,
        headers={"apikey": KEY, "Content-Type": "application/json",
                 "Authorization": f"Bearer {token or KEY}",
                 **({"Prefer": prefer} if prefer else {})})
    try:
        with urllib.request.urlopen(req) as r:
            body = r.read().decode()
            return r.status, json.loads(body) if body.strip() else None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


st, body = call("/auth/v1/token?grant_type=password",
                {"email": "demo@demo.kaspio.be", "password": "kaspio-demo"},
                method="POST")
if st != 200:
    sys.exit(f"login mislukt ({st}): {body}")
TOK = body["access_token"]

st, groups = call(f"/rest/v1/pot_groups?organisation_id=eq.{ORG}&select=id,name", token=TOK)
st, pots = call(f"/rest/v1/pots?organisation_id=eq.{ORG}&select=id,name,group_id,is_hoofdpot", token=TOK)
gname = {g["id"]: g["name"] for g in groups}

# comité op het blad -> de groepen die de gebruiker ervoor maakte
COMITE_GROEPEN = {
 "Dagelijks bestuur": ["ALGEMENE KOSTEN", "LOONKOST", "BANK & VERZEKERING"],
 "Financiën": ["Financiën", "AFLOSSINGEN KREDIETEN (kapitaal)",
               "AFLOSSINGEN KREDIETEN (interesten + kosten)"],
 "Zomertennis": ["Zomertennis"],
 "Wintertennis": ["Wintertennis"],
 "Tennisschool": ["TENNISSCHOOL", "LESGELDEN", "TRAINERS"],
 "Bar": ["Bar", "OPBRENGST BAR", "UITGAVEN BAR"],
 "Infrastructuur": ["INVESTERINGEN", "ONDERHOUD", "ENERGIE & WATER & HUUR"],
 "Competitie": ["INTERCLUB", "TORNOOIEN"],
 "Public Relations": ["P.R."],
 "Sponsoring": ["Sponsoring"],
 "Subsidies": ["Subsidies"],
 "Jeugd- en feestcomité": ["Jeugd & feest"],
 "Rolstoeltennis": ["Gtennis"],
 "VE-tennis": ["Gtennis"],
}

# Namen die op het blad anders heten dan het potje in de app.
ALIAS = {
 ("Dagelijks bestuur", "TOTALE LOONKOST VAST BARPERSONEEL"): "LOON BARMAN",
 ("Dagelijks bestuur", "TOTAAL LOONKOST GERT VANDERLINDEN"): "LOON SECRETARIS",
 ("Infrastructuur", "HUUR TERREINEN"): "HUUR - STAD LEUVEN",
 ("Infrastructuur", "OPBOUW & AFBRAAK BALLON"): "OPBOUW & AFBRAAK BALLON T5-6",
 ("Tennisschool", "INKOMSTEN LESGELDEN LENTE"): "LESGELDEN LENTE",
 ("Tennisschool", "KOSTEN TRAINERS ZOMER & STAGES"): "KOSTEN TRAINERS STAGES",
 ("Competitie", "ETHIAS TOER REEKS 2&3 - U9 EN U11 WINTER"):
     "ETHIAS TOER WINTER U9 EN U11 - JEUGDTORNOOI",
 ("Competitie", "KINDERTOER"): "KIDSTOER",
 ("Competitie", "OPEN DUBBELTORNOOI WINTER"): "OPEN DUBBELTORNOOI",
 ("Competitie", "MAALTIJDEN"): "MAALTIJDEN EN DRANK INTERN",
 ("Competitie", "INTERCLUBLEIDERS"): "INTERCLUBLEIDERS EN",
 ("Competitie", "BOETES/PRIJZEN"): "BOETES & PRIJZEN",
 ("Sponsoring", "INKOMSTEN"): "INKOMSTEN STEUN & SPONSORING",
 ("Subsidies", "VTV"): "TENNIS VLAANDEREN",
 ("Public Relations", "MAILCHIMP"): "CLUBBLAD & COPIES & DRUKWERKEN",
 ("Bar", "INBEV & CO"): "INBEV",
 ("Jeugd- en feestcomité", "UITGAVEN VOOR REDUCTIE BIJ ACTIVIEITEN"):
     "UITGAVEN VOOR REDUCTIE BIJ ACTIVITEITEN",
 ("VE-tennis", "TRAINERS ZOMERTRAININGEN ROLLERS"): "TRAINERS ZOMERTRAININGEN ROLLERS",
}


def norm(s):
    return re.sub(r"\s+", " ", (s or "").strip()).upper()


budget = json.load(open(os.path.join(OUT, "budget.json")))
gelukt, mislukt, bijgewerkt = [], [], 0
for b in budget:
    groepen = COMITE_GROEPEN.get(b["comite"], [])
    if (b["comite"], norm(b["post"])) == ("Infrastructuur", "VARIA"):
        groepen = ["INVESTERINGEN"]
    doel = ALIAS.get((b["comite"], norm(b["post"])), norm(b["post"]))
    kand = [p for p in pots
            if not p["is_hoofdpot"] and gname.get(p["group_id"]) in groepen
            and norm(p["name"]) == doel]
    if len(kand) != 1:
        mislukt.append((b["comite"], b["post"], len(kand)))
        continue
    p = kand[0]
    bd, pr = b["budget"], b["prog"]
    payload = {}
    if isinstance(bd, (int, float)) and round(bd, 2) != 0:
        payload["target_kind"] = "budget" if bd < 0 else "saving"
        payload["target_amount"] = round(abs(bd), 2) if bd < 0 else round(bd, 2)
    if isinstance(pr, (int, float)) and round(pr, 2) != 0:
        payload["forecast_amount"] = round(abs(pr), 2) if (isinstance(bd,(int,float)) and bd < 0) else round(pr, 2)
    payload["description"] = b["comite"]
    st, _ = call(f"/rest/v1/pots?id=eq.{p['id']}", payload, TOK, "PATCH", "return=minimal")
    if st not in (200, 204):
        mislukt.append((b["comite"], b["post"], f"patch {st}"))
    else:
        bijgewerkt += 1
        gelukt.append((b["comite"], p["name"]))

print(f"bijgewerkt: {bijgewerkt} van {len(budget)}")
print("niet gematcht:")
for c, p, n in mislukt:
    print(f"   {c:<22} {p}   ({n})")
