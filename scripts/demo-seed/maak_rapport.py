"""
Bouwt een controledocument: wat stond er in de Excel-bestanden, en wat staat er
nu in Kaspio. Bedoeld om per post te kunnen nakijken of het klopt.
"""
import json, re, uuid, collections, html, os, datetime

OUT = os.path.dirname(os.path.abspath(__file__))
NS = uuid.UUID("6f1d5a3e-9c2b-4a77-9f0e-3b1c2d4e5f60")


def det(*p):
    return str(uuid.uuid5(NS, "|".join(str(x) for x in p)))


def norm(s):
    return re.sub(r"\s+", " ", str(s)).strip().upper()


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def eur(v):
    if v is None:
        return "&mdash;"
    s = f"{abs(v):,.2f}".replace(",", ".").replace(".", ",", 0)
    heel, _, cent = f"{abs(v):,.2f}".partition(".")
    s = heel.replace(",", ".") + "," + cent
    return ("&minus;" if v < 0 else "") + "&euro; " + s


live = json.load(open(os.path.join(OUT, "kaspio_live.json")))
budget = json.load(open(os.path.join(OUT, "budget_posts.json")))
bal = live["bal"]
cnt = live["cnt"]
groups = live["groups"]
pots_by_id = {p["id"]: p for p in live["pots"]}

# Eén rij per post uit BudgetOverzicht, met het Kaspio-saldo ernaast.
rijen = []
gezien = set()
for x in budget:
    key = (x["comite"], norm(x["post"]))
    if key in gezien:
        continue
    gezien.add(key)
    pid = det("pot", *key)
    pot = pots_by_id.get(pid)
    stand = num(x.get("stand2026"))
    kaspio = round(bal.get(pid, 0.0), 2) if pot else None
    verschil = None
    if pot is not None and stand is not None:
        verschil = round(kaspio - round(stand, 2), 2)
    rijen.append(dict(
        comite=x["comite"], post=x["post"],
        budget=num(x.get("budget2026")), prognose=num(x.get("prog2026")),
        w2025=num(x.get("w2025")), stand=stand,
        kaspio=kaspio, n=cnt.get(pid, 0), verschil=verschil,
        in_kaspio=pot is not None,
    ))

# Statusbepaling per rij
for r in rijen:
    if not r["in_kaspio"]:
        r["status"] = "ontbreekt"
    elif r["n"] == 0 and (r["stand"] in (None, 0)):
        r["status"] = "leeg"
    elif r["verschil"] is not None and abs(r["verschil"]) < 0.02:
        r["status"] = "klopt"
    elif r["n"] == 0:
        r["status"] = "inbox"
    else:
        r["status"] = "afwijking"

telling = collections.Counter(r["status"] for r in rijen)
met_beweging = [r for r in rijen if r["n"] > 0]
klopt = [r for r in rijen if r["status"] == "klopt"]
afwijking = sorted([r for r in rijen if r["status"] == "afwijking"],
                   key=lambda r: -abs(r["verschil"] or 0))
inbox = sorted([r for r in rijen if r["status"] == "inbox"],
               key=lambda r: -abs(r["stand"] or 0))

hoofdpot = next((p for p in live["pots"] if p["is_hoofdpot"]), None)
hoofdpot_saldo = round(bal.get(hoofdpot["id"], 0.0), 2) if hoofdpot else 0.0
totaal_kaspio = round(sum(bal.values()), 2)
som_stand = round(sum(r["stand"] or 0 for r in rijen), 2)
som_klopt = round(sum(r["kaspio"] or 0 for r in rijen if r["status"] == "klopt"), 2)

BADGE = {
    "klopt": ("klopt", "ok"),
    "afwijking": ("wijkt af", "warn"),
    "inbox": ("niet teruggevonden", "info"),
    "leeg": ("geen beweging", "muted"),
    "ontbreekt": ("niet in Kaspio", "muted"),
}

CSS = """
:root{--bg:#ffffff;--fg:#0f172a;--muted:#64748b;--line:#e2e8f0;--card:#f8fafc;
--ok:#0f766e;--okbg:#ccfbf1;--warn:#b45309;--warnbg:#fef3c7;--info:#1d4ed8;--infobg:#dbeafe;}
@media (prefers-color-scheme: dark){:root:not([data-theme=light]){
--bg:#0b1220;--fg:#e2e8f0;--muted:#94a3b8;--line:#1e293b;--card:#111c2e;
--ok:#5eead4;--okbg:#134e4a;--warn:#fcd34d;--warnbg:#4a3209;--info:#93c5fd;--infobg:#1e3a8a;}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);
font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}
.wrap{max-width:1180px;margin:0 auto;padding:40px 20px 80px}
h1{font-size:30px;margin:0 0 6px;letter-spacing:-.02em}
h2{font-size:20px;margin:44px 0 12px;letter-spacing:-.01em}
h3{font-size:16px;margin:28px 0 8px}
.sub{color:var(--muted);margin:0 0 28px}
.cards{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin:20px 0 8px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.card .k{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.06em}
.card .v{font-size:23px;font-weight:650;margin-top:4px;font-variant-numeric:tabular-nums}
.card .n{color:var(--muted);font-size:12px;margin-top:2px}
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:12px;margin:14px 0}
table{border-collapse:collapse;width:100%;font-size:13.5px}
th,td{padding:8px 12px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap}
th{background:var(--card);font-weight:600;font-size:12px;text-transform:uppercase;
letter-spacing:.05em;color:var(--muted);position:sticky;top:0}
tr:last-child td{border-bottom:none}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
td.post{white-space:normal;min-width:230px}
.b{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11.5px;font-weight:600}
.b.ok{background:var(--okbg);color:var(--ok)}
.b.warn{background:var(--warnbg);color:var(--warn)}
.b.info{background:var(--infobg);color:var(--info)}
.b.muted{background:var(--card);color:var(--muted)}
.note{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--muted);
border-radius:8px;padding:12px 16px;margin:16px 0;color:var(--muted);font-size:14px}
.note strong{color:var(--fg)}
ul{padding-left:20px}li{margin:4px 0}
footer{margin-top:56px;padding-top:18px;border-top:1px solid var(--line);
color:var(--muted);font-size:13px}
"""


def tabel(rs, kolommen_prognose=True):
    kop = ["Comité", "Post", "Excel<br>Stand 2026", "Kaspio<br>saldo", "Verschil", "Regels", "Status"]
    if kolommen_prognose:
        kop[2:2] = ["Budget<br>2026", "Prognose<br>2026"]
    h = "<div class=scroll><table><thead><tr>"
    for i, k in enumerate(kop):
        h += f"<th class={'n' if i >= 2 and k != 'Status' else ''}>{k}</th>"
    h += "</tr></thead><tbody>"
    for r in rs:
        lbl, kleur = BADGE[r["status"]]
        h += "<tr>"
        h += f"<td>{html.escape(r['comite'])}</td>"
        h += f"<td class=post>{html.escape(r['post'])}</td>"
        if kolommen_prognose:
            h += f"<td class=n>{eur(r['budget'])}</td><td class=n>{eur(r['prognose'])}</td>"
        h += f"<td class=n>{eur(r['stand'])}</td>"
        h += f"<td class=n>{eur(r['kaspio']) if r['in_kaspio'] else '&mdash;'}</td>"
        h += f"<td class=n>{eur(r['verschil']) if r['verschil'] not in (None, 0) else ('&ndash;' if r['verschil'] == 0 else '&mdash;')}</td>"
        h += f"<td class=n>{r['n'] or '&mdash;'}</td>"
        h += f"<td><span class='b {kleur}'>{lbl}</span></td>"
        h += "</tr>"
    return h + "</tbody></table></div>"


MAANDEN = ["januari", "februari", "maart", "april", "mei", "juni", "juli",
           "augustus", "september", "oktober", "november", "december"]
_nu = datetime.datetime.now()
gen = f"{_nu.day} {MAANDEN[_nu.month - 1]} {_nu.year}, {_nu:%H:%M}"


def getal(n):
    """Duizendtallen met een punt, zoals het hier hoort."""
    return f"{n:,}".replace(",", ".")

doc = f"""<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kaspio naast de Excel</title>
<style>{CSS}</style>
<div class=wrap>
<h1>Kaspio naast de Excel</h1>
<p class=sub>Koninklijke Stade Leuven Tennis &middot; boekjaar 2026 &middot; opgemaakt {gen}</p>

<div class=note>
Dit document zet elke budgetpost uit <strong>&ldquo;2026 budget en overzicht in-uit
opvolging&rdquo;</strong> naast wat er nu in Kaspio staat. De kolom <strong>Excel Stand 2026</strong>
is jullie eigen cijfer; <strong>Kaspio saldo</strong> is de som van de verrichtingen die aan dat
potje toegewezen zijn. Staan ze gelijk tot op de cent, dan is de post correct overgezet.
</div>

<div class=cards>
  <div class=card><div class=k>Posten die kloppen</div><div class=v>{len(klopt)} / {len(met_beweging)}</div>
    <div class=n>van alle posten met verrichtingen</div></div>
  <div class=card><div class=k>Verrichtingen</div><div class=v>{getal(live['n_tx'])}</div>
    <div class=n>jan&ndash;aug 2026</div></div>
  <div class=card><div class=k>Toegewezen</div><div class=v>{getal(live['n_tx'] - live['onbeslist'])}</div>
    <div class=n>aan een post</div></div>
  <div class=card><div class=k>Nog toe te wijzen</div><div class=v>{getal(live['onbeslist'])}</div>
    <div class=n>van {getal(live['n_tx'])} verrichtingen</div></div>
</div>
<div class=cards>
  <div class=card><div class=k>Totaal in Kaspio</div><div class=v>{eur(totaal_kaspio)}</div>
    <div class=n>alle potjes + hoofdpot</div></div>
  <div class=card><div class=k>Hoofdpot</div><div class=v>{eur(hoofdpot_saldo)}</div>
    <div class=n>beginsaldo + nog te verdelen</div></div>
  <div class=card><div class=k>Bedrag op kloppende posten</div><div class=v>{eur(som_klopt)}</div>
    <div class=n>identiek in Excel en Kaspio</div></div>
</div>

<h2>Hoe je dit leest</h2>
<ul>
<li><span class='b ok'>klopt</span> Het Kaspio-saldo is exact gelijk aan jullie Stand 2026.
    Deze posten zijn zonder voorbehoud overgezet.</li>
<li><span class='b info'>niet teruggevonden</span> De post staat in het budget met een bedrag,
    maar op de comit&eacute;bladen staat geen enkele reeks die eraan toegewezen kon worden. Meestal
    omdat dat geld op het blad van een ander comit&eacute; staat.</li>
<li><span class='b warn'>wijkt af</span> Er zijn verrichtingen toegewezen, maar het saldo komt
    niet uit op jullie cijfer. Hier moet je naar kijken; zie de uitleg onderaan.</li>
<li><span class='b muted'>geen beweging</span> Geen bedrag in de Excel en geen verrichtingen
    in Kaspio. Niets aan de hand.</li>
</ul>

<h2>Posten die afwijken: {len(afwijking)}</h2>
{'<div class=note><strong>Geen enkele post in Kaspio toont een verkeerd bedrag.</strong> Elke post met verrichtingen komt exact uit op jullie Stand 2026. Dat is geen toeval maar de opzet: een post wordt pas overgenomen als de som tot op de cent klopt. Wat niet klopte is niet gecorrigeerd of geschat, het staat in de inbox. De onzekerheid zit dus volledig in <em>nog te verdelen</em>, niet in <em>fout</em>.</div>' if not afwijking else '<p class=sub>Gesorteerd op grootte van het verschil. Dit is de lijst om na te kijken.</p>' + tabel(afwijking)}

<h2>Posten zonder verrichtingen: {len(inbox)}</h2>
<p class=sub>Deze staan in het budget met een bedrag, maar er is geen reeks op de bladen die
eraan toegewezen kon worden. Samen {eur(round(sum(abs(r['stand'] or 0) for r in inbox), 2))}.</p>
{tabel(inbox) if inbox else '<div class=note>Alles is toegewezen.</div>'}

<h2>Alle posten ({len(rijen)})</h2>
{tabel(rijen)}

<h2>Waarom niet alles klopt</h2>
<p>De koppeling verrichting &rarr; post komt uit de comitébladen zelf: elke bankregel hoort bij
het dichtstbijzijnde kopje erboven dat op een budgetpost te herleiden is. Daarna wordt per post
de som vergeleken met Stand 2026, en <strong>alleen posten die tot op de cent kloppen worden
overgenomen</strong>. Klopt het niet, dan gaan die regels zichtbaar naar de inbox in plaats van
stilletjes op een verkeerde post te belanden.</p>
<p>Drie dingen zorgen ervoor dat een post niet automatisch te herleiden is:</p>
<ul>
<li><strong>Kopjes die anders heten dan de post.</strong> &ldquo;HUUR - STAD LEUVEN&rdquo; op het
blad tegenover &ldquo;HUUR TERREINEN&rdquo; in BudgetOverzicht. Waar het subtotaal in kolom E
overeenkomt vangen we dat op, maar niet altijd.</li>
<li><strong>Geld dat op het blad van een ander comité staat.</strong> Het lidgeldenblok staat bij
Dagelijks Bestuur terwijl BudgetOverzicht het onder Zomertennis rekent.</li>
<li><strong>Sectiegrenzen die een rij of twee verschoven liggen.</strong> Bij Bar staan 80 regels
onder &ldquo;CARREFOUR EXPRESS&rdquo; die samen het bedrag van &ldquo;AANKOOP VOEDING&rdquo;
vormen.</li>
</ul>
<p>Dat is geen tekortkoming van Kaspio maar van een rekenblad dat met de hand is gegroeid.
In Kaspio kan dit niet meer gebeuren: een verrichting hoort bij één potje, en dat potje hoort bij
één comité.</p>

<h2>Wat er nog niet in zit</h2>
<ul>
<li><strong>Alleen 2026.</strong> Enkel dat jaar is in jullie bestanden per post gecategoriseerd.</li>
<li><strong>Afsluitingsregels.</strong> Regels die jullie zelf in het rekenblad maken
(&ldquo;LIDGELDEN ZOMER&rdquo;, &ldquo;SALDO OPLADINGEN WINTER&rdquo;) staan niet in Kaspio: geen
rekening, geen tegenpartij, en het geld staat elders al als echte bankverrichting. Ze meenemen
zou het totaal ruim &euro;&nbsp;115.000 laten afwijken van de rekening.</li>
<li><strong>Het beginsaldo</strong> van {eur(73098.41)} staat als aparte regel in de hoofdpot,
overgenomen uit &ldquo;Cashflow sinds 2004&rdquo;, blad 2025, rij EIND DECEMBER 2025.</li>
</ul>

<footer>Opgemaakt uit de live Kaspio-databank en de twee Excel-bestanden.
Elk bedrag hierboven komt uit één van die twee, niets is afgerond of bijgeschat.</footer>
</div>
"""

pad = os.path.expanduser("~/Downloads/kaspio-naast-de-excel.html")
open(pad, "w").write(doc)
print(f"geschreven: {pad}  ({os.path.getsize(pad):,} bytes)")
print(f"  klopt {len(klopt)} | wijkt af {len(afwijking)} | inbox {len(inbox)} | "
      f"geen beweging {telling['leeg']} | niet in Kaspio {telling['ontbreekt']}")
print(f"  totaal Kaspio {totaal_kaspio:,.2f} | hoofdpot {hoofdpot_saldo:,.2f}")
