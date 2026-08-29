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
]

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
    if buiten_gamut or gezakt:
        return 1
    print(f"{len(CONTROLES)} controles, allemaal goed, geen kleur buiten gamut")
    return 0

if __name__ == "__main__":
    sys.exit(main())
