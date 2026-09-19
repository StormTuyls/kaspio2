#!/usr/bin/env python3
# =============================================================================
# Kaspio , eenmalige migratie naar het nieuwe kleursysteem
# =============================================================================
# De oude app had twee grijsfamilies (navy 1282x, slate 152x) en gebruikte teal
# als merkkleur op alles wat interactief was. Het nieuwe systeem heeft er een:
# inkt voor alles wat geen geld is, plus in/uit/fout voor wat dat wel is.
#
# De mapping is SEMANTISCH, niet numeriek. text-navy-400 haalde 4.38:1 en gaat
# dus naar ink-600 (6.67:1), niet naar ink-400. Een domme zoek-vervang zou de
# leesbaarheid juist slechter maken.
#
#   python3 scripts/design/migreer-tokens.py [--dry]
# =============================================================================
import pathlib
import re
import sys

DRY = "--dry" in sys.argv

# (patroon, vervanging). Volgorde telt: specifiek voor generiek.
REGELS = [
    # --- Tekst: donkerder waar het contrast tekortschoot -------------------
    (r"\btext-(navy|slate)-950\b", "text-ink-950"),
    (r"\btext-(navy|slate)-900\b", "text-ink-900"),
    (r"\btext-(navy|slate)-800\b", "text-ink-800"),
    (r"\btext-(navy|slate)-700\b", "text-ink-800"),
    (r"\btext-(navy|slate)-600\b", "text-ink-700"),
    (r"\btext-(navy|slate)-500\b", "text-ink-700"),
    (r"\btext-(navy|slate)-400\b", "text-ink-600"),   # was 4.38:1
    (r"\btext-(navy|slate)-300\b", "text-ink-500"),   # was 2.43:1 als placeholder
    (r"\btext-(navy|slate)-200\b", "text-ink-300"),
    (r"\btext-(navy|slate)-100\b", "text-ink-200"),
    (r"\btext-(navy|slate)-50\b", "text-ink-100"),
    (r"\bplaceholder:text-(navy|slate)-\d+\b", "placeholder:text-ink-500"),

    # --- Vlakken -----------------------------------------------------------
    (r"\bbg-(navy|slate)-950\b", "bg-ink-950"),
    (r"\bbg-(navy|slate)-900\b", "bg-ink-950"),        # zijbalk, donkere panelen
    (r"\bbg-(navy|slate)-800\b", "bg-ink-900"),
    (r"\bbg-(navy|slate)-700\b", "bg-ink-800"),
    (r"\bbg-(navy|slate)-100\b", "bg-ink-100"),
    (r"\bbg-(navy|slate)-50\b", "bg-ink-50"),
    (r"\bbg-canvas\b", "bg-ink-50"),

    # --- Randen: alles naar de haarlijn of een trap sterker ----------------
    (r"\bborder-(navy|slate)-100\b", "border-ink-200"),
    (r"\bborder-(navy|slate)-200\b", "border-ink-300"),
    (r"\bborder-(navy|slate)-300\b", "border-ink-300"),
    (r"\bborder-(navy|slate)-700\b", "border-ink-800"),
    (r"\bborder-(navy|slate)-800\b", "border-ink-800"),
    (r"\bborder-(navy|slate)-900\b", "border-ink-900"),
    (r"\bdivide-(navy|slate)-100\b", "divide-ink-200"),
    (r"\bdivide-(navy|slate)-700\b", "divide-ink-800"),
    (r"\bring-(navy|slate)-(\d+)\b", r"ring-ink-\2"),

    # --- Geld erin: teal en mint waren allebei "groen" ---------------------
    (r"\btext-teal-(700|800|900)\b", "text-in-700"),
    (r"\btext-teal-(500|600)\b", "text-in-600"),
    (r"\btext-teal-(300|400)\b", "text-in-400"),
    (r"\btext-mint-(500|600|700)\b", "text-in-600"),
    (r"\bbg-teal-(500|600|700)\b", "bg-in-600"),
    (r"\bbg-teal-(50|100)\b", "bg-in-100"),
    (r"\bbg-teal-(200|300|400)\b", "bg-in-300"),
    (r"\bbg-mint-(400|500|600)\b", "bg-in-600"),
    (r"\bbg-mint-(50|100)\b", "bg-in-100"),
    (r"\bborder-teal-(200|300)\b", "border-in-300"),
    (r"\bborder-teal-(400|500|600|700|800)\b", "border-in-600"),
    (r"\bfrom-teal-\d+\b", "from-in-500"),
    (r"\bto-teal-\d+\b", "to-in-600"),
    (r"\bring-teal-\d+\b", "ring-in-600"),

    # --- Geld eruit --------------------------------------------------------
    (r"\btext-amber-(700|800|900)\b", "text-uit-700"),
    (r"\btext-amber-(500|600)\b", "text-uit-600"),
    (r"\btext-amber-(300|400)\b", "text-uit-400"),
    (r"\bbg-amber-(500|600|700)\b", "bg-uit-600"),
    (r"\bbg-amber-(50|100)\b", "bg-uit-100"),
    (r"\bbg-amber-(200|300|400)\b", "bg-uit-300"),
    (r"\bborder-amber-(200|300)\b", "border-uit-300"),
    (r"\bborder-amber-(400|500|600|700)\b", "border-uit-600"),
    (r"\bfrom-amber-\d+\b", "from-uit-500"),
    (r"\bto-amber-\d+\b", "to-uit-600"),

    # --- Fouten ------------------------------------------------------------
    (r"\btext-rose-(600|700|800|900)\b", "text-fout-600"),
    (r"\btext-rose-(300|400|500)\b", "text-fout-400"),
    (r"\bbg-rose-(500|600|700)\b", "bg-fout-600"),
    (r"\bbg-rose-(50|100)\b", "bg-fout-100"),
    (r"\bborder-rose-\d+\b", "border-fout-100"),
    (r"\bfrom-rose-\d+\b", "from-fout-400"),
    (r"\bto-rose-\d+\b", "to-fout-600"),

    # --- Azure was een derde accent zonder betekenis -----------------------
    (r"\btext-azure-(600|700|800)\b", "text-ink-800"),
    (r"\btext-azure-(300|400|500)\b", "text-ink-600"),
    (r"\bbg-azure-(50|100)\b", "bg-ink-100"),
    (r"\bbg-azure-\d+\b", "bg-ink-800"),
    (r"\bborder-azure-\d+\b", "border-ink-300"),

    # --- Indigo/emerald/sky die her en der binnengeslopen zijn -------------
    (r"\btext-(indigo|violet|sky|blue)-(\d+)\b", "text-ink-700"),
    (r"\bbg-(indigo|violet|sky|blue)-(50|100)\b", "bg-ink-100"),
    (r"\btext-emerald-(600|700|800)\b", "text-in-600"),
    (r"\bbg-emerald-(50|100)\b", "bg-in-100"),

    # --- Fonts -------------------------------------------------------------
    # Plus Jakarta Sans bestaat niet meer; hiërarchie komt uit gewicht.
    (r"\bfont-display\b", "font-semibold"),

    # --- Radius: 2xl op kaarten was speelgoed ------------------------------
    (r"\brounded-3xl\b", "rounded-lg"),
    (r"\brounded-2xl\b", "rounded-md"),
]

bestanden = sorted(
    p for p in pathlib.Path("src").rglob("*")
    if p.suffix in {".tsx", ".ts"} and p.is_file()
)

totaal = 0
per_regel = {}
for pad in bestanden:
    tekst = origineel = pad.read_text()
    for patroon, vervanging in REGELS:
        tekst, n = re.subn(patroon, vervanging, tekst)
        if n:
            per_regel[patroon] = per_regel.get(patroon, 0) + n
            totaal += n
    if tekst != origineel and not DRY:
        pad.write_text(tekst)

print(f"{totaal} vervangingen over {len(bestanden)} bestanden{' (dry run)' if DRY else ''}\n")
for patroon, n in sorted(per_regel.items(), key=lambda kv: -kv[1])[:18]:
    print(f"  {n:5}  {patroon}")

rest = []
for pad in bestanden:
    for m in re.finditer(r"\b(?:text|bg|border|ring|divide|from|to)-(navy|slate|teal|mint|amber|rose|azure)-\d+", pad.read_text()):
        rest.append(f"{pad}: {m.group(0)}")
print(f"\n{len(rest)} verwijzingen naar oude tokens over")
for r in rest[:20]:
    print("  " + r)
