#!/usr/bin/env python3
# =============================================================================
# Kaspio , contrastcontrole op het kleurenpalet
# =============================================================================
# De tokens in src/App.css en DESIGN.md zijn niet op gevoel gekozen. Dit script
# rekent ze door tegen WCAG 2.2 AA en faalt als er iets zakt, zodat een
# "even een tint lichter" niet stilletjes de leesbaarheid sloopt.
#
#   python3 scripts/design/contrast.py
#
# Twee dingen die het bewaakt:
#   1. elke tekst-op-achtergrond combinatie die de app echt gebruikt haalt 4.5:1
#   2. geen enkele kleur valt buiten sRGB, want dan mapt de browser hem zelf en
#      is de gemeten waarde niet meer de getoonde waarde
# =============================================================================
import math
import sys

def oklch_to_srgb(L, C, H):
    h = math.radians(H)
    a, b = C * math.cos(h), C * math.sin(h)
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    buiten = any(c < -0.0005 or c > 1.0005 for c in (r, g, bb))
    def enc(c):
        c = min(max(c, 0.0), 1.0)
        return 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055
    return "#%02x%02x%02x" % tuple(round(enc(x) * 255) for x in (r, g, bb)), buiten

def _lin(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def _lum(h):
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b)

def ratio(a, b):
    la, lb = _lum(a), _lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)

# Exact de tokens uit src/App.css.
TOKENS = {
    "paper":    (0.9930, 0.0020, 250),
    "ink-50":   (0.9740, 0.0030, 250),
    "ink-100":  (0.9430, 0.0045, 250),
    "ink-200":  (0.8950, 0.0060, 250),
    "ink-300":  (0.8100, 0.0080, 250),
    "ink-400":  (0.6600, 0.0110, 250),
    "ink-500":  (0.5560, 0.0130, 250),
    "ink-600":  (0.4700, 0.0130, 250),
    "ink-700":  (0.3850, 0.0130, 250),
    "ink-800":  (0.2950, 0.0130, 250),
    "ink-900":  (0.2250, 0.0130, 250),
    "ink-950":  (0.1650, 0.0140, 250),
    "in-700":   (0.4300, 0.0940, 162),
    "in-600":   (0.5020, 0.1090, 162),
    "in-500":   (0.6300, 0.1350, 162),
    "in-400":   (0.7300, 0.1200, 162),
    "in-300":   (0.8300, 0.0850, 162),
    "in-100":   (0.9530, 0.0300, 162),
    "uit-700":  (0.4500, 0.1030,  62),
    "uit-600":  (0.5300, 0.1200,  62),
    "uit-500":  (0.6600, 0.1400,  62),
    "uit-400":  (0.7600, 0.1250,  62),
    "uit-300":  (0.8500, 0.0850,  62),
    "uit-100":  (0.9500, 0.0330,  70),
    "fout-600": (0.5250, 0.1900,  25),
    "fout-400": (0.7000, 0.1600,  25),
    "fout-100": (0.9450, 0.0260,  25),
    "wit":      None,
}

# (omschrijving, voorgrond, achtergrond, minimum)
CONTROLES = [
    ("licht , hoofdtekst",             "ink-900",  "paper",   4.5),
    ("licht , secundair",              "ink-700",  "paper",   4.5),
    ("licht , tertiair",               "ink-600",  "paper",   4.5),
    ("licht , placeholder",            "ink-500",  "paper",   4.5),
    ("licht , secundair op verhoogd",  "ink-700",  "ink-50",  4.5),
    ("licht , tertiair op vulling",    "ink-600",  "ink-100", 4.5),
    ("licht , bedrag binnen",          "in-600",   "paper",   4.5),
    ("licht , bedrag buiten",          "uit-600",  "paper",   4.5),
    ("licht , fout",                   "fout-600", "paper",   4.5),
    ("licht , badge binnen",           "in-600",   "in-100",  4.5),
    ("licht , badge buiten",           "uit-600",  "uit-100", 4.5),
    ("licht , badge fout",             "fout-600", "fout-100", 4.5),
    ("licht , wit op primaire knop",   "wit",      "ink-950", 4.5),
    ("licht , wit op binnen-vlak",     "wit",      "in-600",  4.5),
    ("licht , wit op buiten-vlak",     "wit",      "uit-600", 4.5),
    ("licht , wit op fout-vlak",       "wit",      "fout-600", 4.5),
    ("donker , hoofdtekst",            "ink-100",  "ink-950", 4.5),
    ("donker , secundair",             "ink-300",  "ink-950", 4.5),
    ("donker , tertiair",              "ink-400",  "ink-950", 4.5),
    ("donker , placeholder",           "ink-400",  "ink-900", 4.5),
    ("donker , secundair op verhoogd", "ink-300",  "ink-900", 4.5),
    ("donker , bedrag binnen",         "in-400",   "ink-950", 4.5),
    ("donker , bedrag buiten",         "uit-400",  "ink-950", 4.5),
    ("donker , fout",                  "fout-400", "ink-950", 4.5),
    ("donker , knoptekst",             "ink-950",  "ink-100", 4.5),
    # De semantische laag (--color-sterk/basis/zacht/zwak) die componenten
    # horen te gebruiken. Licht is dezelfde waarde als de inkt-trap erboven,
    # donker is de omgekeerde trap uit html.dark.
    ("licht , sterk",                  "ink-900",  "paper",   4.5),
    ("licht , basis",                  "ink-700",  "paper",   4.5),
    ("licht , zacht",                  "ink-600",  "paper",   4.5),
    ("licht , zwak",                   "ink-500",  "paper",   4.5),
    ("donker , sterk",                 "ink-100",  "ink-950", 4.5),
    ("donker , basis",                 "ink-300",  "ink-950", 4.5),
    ("donker , zacht",                 "ink-400",  "ink-950", 4.5),
    ("donker , zacht op verhoogd",     "ink-400",  "ink-900", 4.5),
]

# =============================================================================
# Scan over de broncode
# =============================================================================
# De tokenlijst hierboven bewees alleen dat het palet klopt. Dat is niet
# hetzelfde als bewijzen dat de app het palet goed gebruikt: op het moment dat
# deze scan er kwam stonden er 228 plaatsen in src/ waar een component zelf een
# licht/donker-paar koos dat in donkere modus onder 4.5:1 zakte, terwijl dit
# script "25 controles, allemaal goed" meldde.
#
# Vandaar deze tweede helft: elke `dark:text-<token>` in een className wordt
# doorgerekend tegen de donkere pagina, en elke lichte tekstkleur tegen wit.
# Vindt hij iets, dan is het antwoord bijna altijd "gebruik text-sterk/basis/
# zacht/zwak" in plaats van een eigen paar.

import os
import re

BRON = os.path.join(os.path.dirname(__file__), "..", "..", "src")

# Alleen de donkere kant wordt statisch gescand, en met opzet. Een `dark:`-klasse
# is eenduidig: in donkere modus is de pagina altijd ink-950 en een verhoogd vlak
# altijd ink-900, dus de achtergrond staat vast zonder de DOM te kennen. Aan de
# lichte kant is dat niet zo: de bankkaart, de zijbalk en de voettekst zijn ook
# in lichte modus donker, en daar hoort `text-ink-300` juist wél. Die kant meet
# je op een echte pagina met scripts/design/contrast-in-de-browser.js.
#
# Uitzondering: een element dat in donkere modus zelf een licht vlak krijgt
# (een omgekeerde knop) wordt overgeslagen.
LICHT_IN_DONKER = re.compile(r"dark:bg-(?:white|ink-(?:100|200|300))")

# Tweede categorie, en in de praktijk de grootste: een klassenstring die een
# lichte inkt-tekstkleur zet en helemaal geen `dark:`-tegenhanger heeft. Die
# kleur blijft in donkere modus staan waar hij staat. `text-ink-700` haalde zo
# 1.96:1 op elke ingelogde pagina, en geen enkele token-meting zag dat, want
# het token zelf klopt. Dit vond alleen een meting op de echte pagina.
LICHTE_INKT = re.compile(r"(?<![\w:-])text-(ink-(?:500|600|700|800|900))\b")
# Vlakken die in beide thema's donker zijn (bankkaart, zijbalk, voettekst).
# Daar hoort een lichte tekstkleur juist wel.
OMGEKEERD_VLAK = re.compile(r"(?<!dark:)bg-(?:ink-(?:800|900|950)|white/|black)|text-white")
# Bestanden die bewust alleen een lichte modus hebben.
ALLEEN_LICHT = ("src/views/Landing.tsx", "src/views/landing")

KLASSE = re.compile(r'"([^"\n]*)"|`([^`\n$]*)`')


def scan_bron(hexen):
    """Geeft een lijst (bestand, regel, klasse, ratio, achtergrond) terug."""
    problemen = []
    for wortel, _, bestanden in os.walk(BRON):
        for naam in sorted(bestanden):
            if not naam.endswith(".tsx"):
                continue
            pad = os.path.join(wortel, naam)
            toon = os.path.relpath(pad, os.path.join(os.path.dirname(__file__), "..", ".."))
            with open(pad, encoding="utf-8") as f:
                for nr, regel in enumerate(f, 1):
                    for m in KLASSE.finditer(regel):
                        s = m.group(1) if m.group(1) is not None else m.group(2)
                        if not s:
                            continue
                        if "dark:text-" in s and not LICHT_IN_DONKER.search(s):
                            for tok in set(re.findall(r"dark:text-(ink-\d+)", s)):
                                if tok not in hexen:
                                    continue
                                r = ratio(hexen[tok], hexen["ink-950"])
                                if r < 4.5:
                                    problemen.append((toon, nr, f"dark:text-{tok}", r, "donkere pagina"))
                        elif (
                            "dark:text-" not in s
                            and not OMGEKEERD_VLAK.search(s)
                            and not toon.startswith(ALLEEN_LICHT)
                        ):
                            for tok in set(LICHTE_INKT.findall(s)):
                                if tok not in hexen:
                                    continue
                                r = ratio(hexen[tok], hexen["ink-950"])
                                if r < 4.5:
                                    problemen.append(
                                        (toon, nr, f"text-{tok} (geen dark:)", r, "donkere pagina")
                                    )
    # ontdubbel
    gezien, uniek = set(), []
    for p in problemen:
        sleutel = (p[0], p[1], p[2])
        if sleutel in gezien:
            continue
        gezien.add(sleutel)
        uniek.append(p)
    return sorted(uniek)


def main():
    hexen, buiten_gamut = {"wit": "#ffffff"}, []
    for naam, spec in TOKENS.items():
        if spec is None:
            continue
        h, buiten = oklch_to_srgb(*spec)
        hexen[naam] = h
        if buiten:
            buiten_gamut.append(naam)

    gezakt = []
    print("contrast (WCAG 2.2 AA, 4.5:1 voor tekst)\n")
    for omschrijving, vg, bg, minimum in CONTROLES:
        r = ratio(hexen[vg], hexen[bg])
        goed = r >= minimum
        if not goed:
            gezakt.append((omschrijving, r, minimum))
        print(f"  {'ok  ' if goed else 'ZAKT'}  {omschrijving:34} {r:5.2f}:1")

    print()
    if buiten_gamut:
        print(f"buiten sRGB-gamut: {', '.join(buiten_gamut)}")
        print("  verlaag de chroma, anders mapt de browser de kleur zelf en klopt de meting niet")
    if gezakt:
        for omschrijving, r, minimum in gezakt:
            print(f"gezakt: {omschrijving} haalt {r:.2f}:1, minimum is {minimum}")
    problemen = scan_bron(hexen)
    if problemen:
        print("componenten die zelf een kleurpaar kiezen dat zakt:\n")
        for pad, nr, klasse, r, waarop in problemen:
            print(f"  {r:5.2f}:1  {pad}:{nr}  {klasse}  op {waarop}")
        print("\n  vervang door text-sterk / text-basis / text-zacht / text-zwak")
        print("  (die volgen het thema, zie de semantische laag in src/App.css)")

    if buiten_gamut or gezakt or problemen:
        return 1
    print(f"{len(CONTROLES)} controles, allemaal goed, geen kleur buiten gamut")
    print("broncode gescand, geen component kiest in donkere modus een paar dat zakt")
    return 0

if __name__ == "__main__":
    sys.exit(main())
