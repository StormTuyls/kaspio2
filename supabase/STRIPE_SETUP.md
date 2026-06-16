# Stripe-setup voor Kaspio-abonnementen

De code + Edge Functions staan klaar en zijn gedeployed. Dit zijn de stappen die
jij in Stripe + Supabase moet doen om betalingen live te zetten. Tot dit klaar
is, blijft elke org gewoon op het gratis plan en faalt "Upgrade" netjes.

## 1. Stripe-account + producten

1. Maak (of open) je [Stripe-account](https://dashboard.stripe.com). Begin in
   **Testmodus** (toggle rechtsboven) tot alles werkt.
2. Ga naar **Product catalog → Add product**. Maak twee producten:

   **Pro** (1 org, onbeperkt potjes + leden)
   - Maandprijs: € 4 / maand (recurring, monthly)
   - Jaarprijs: € 38,40 / jaar (recurring, yearly, = €3,20/mnd)

   **Team** (alles uit Pro + extra beheer/goedkeuringsfuncties)
   - Maandprijs: € 10 / maand
   - Jaarprijs: € 96 / jaar (= €8/mnd)

3. Noteer de 4 **price-id's** (beginnen met `price_...`), per prijs te vinden op
   de productpagina.

## 2. Secrets zetten in Supabase

Geef mij deze waarden, dan zet ik ze als secrets (of doe het zelf via
Project Settings → Edge Functions → Secrets):

```
STRIPE_SECRET_KEY        = sk_test_...   (Developers → API keys)
STRIPE_PRICE_PRO_MONTH   = price_...
STRIPE_PRICE_PRO_YEAR    = price_...
STRIPE_PRICE_TEAM_MONTH  = price_...
STRIPE_PRICE_TEAM_YEAR   = price_...
```

## 3. Webhook registreren

1. Stripe → **Developers → Webhooks → Add endpoint**.
2. Endpoint-URL:
   ```
   https://dxwyciqpryyoeuhukung.supabase.co/functions/v1/stripe-webhook
   ```
3. Events om te sturen:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Na opslaan toont Stripe een **Signing secret** (`whsec_...`). Geef die mee:
   ```
   STRIPE_WEBHOOK_SECRET = whsec_...
   ```

## 4. Testen

1. App → Instellingen → Abonnement → "Upgrade naar Pro".
2. Je belandt op Stripe Checkout. Gebruik testkaart `4242 4242 4242 4242`,
   willekeurige toekomstige datum + CVC.
3. Na betaling stuurt Stripe het webhook-event; de `subscriptions`-rij springt
   naar `tier = pro`. Door realtime ziet de app dat meteen: grafieken
   verschijnen, potjeslimiet verdwijnt.

## 5. Live gaan

Wanneer de testflow werkt: herhaal stap 1-3 in **Live-modus** (aparte
`sk_live_...` key, live price-id's, live webhook + `whsec_...`), en vervang de
secrets. Zet Kaspio's prijzen pas live als je de bedragen definitief hebt.

---

## Wat de code al doet

- `create-checkout-session` (JWT-verified): admin-only, maakt een Stripe-customer
  per org (eenmalig), maakt een Checkout-sessie voor de gekozen tier+interval.
- `stripe-webhook` (no-jwt, signature-verified): zet tier/status/period in
  `public.subscriptions` op basis van de Stripe-subscription.
- Limieten worden **server-side** afgedwongen (triggers in `subscriptions.sql`):
  gratis = 3 potjes / 2 leden, Pro = 5 leden, Team = 25 leden. Niet te omzeilen
  via de API.
- Grafieken zijn Pro+; gratis ziet een upgrade-aanzet.

## Beheerportal (later)

Voor opzeggen/plan wijzigen door de klant zelf kun je later het Stripe
**Customer Portal** toevoegen (een extra Edge Function die een portal-sessie
maakt). Nu nog niet ingebouwd.
