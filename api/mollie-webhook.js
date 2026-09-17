export default async function handler(req, res) {
if (req.method !== 'POST') {
return res.status(405).send('Method not allowed');
}

try {
let paymentId;

if (typeof req.body === 'string') {
paymentId = new URLSearchParams(req.body).get('id');
} else {
paymentId = req.body?.id;
}

if (!paymentId) {
return res.status(400).send('Payment ID ontbreekt');
}

// Vraag de betaling opnieuw op bij Mollie.
// We vertrouwen dus niet blind op de webhook zelf.
const mollieResponse = await fetch(
`https://api.mollie.com/v2/payments/${encodeURIComponent(paymentId)}`,
{
headers: {
Authorization: `Bearer ${process.env.MOLLIE_API_KEY}`
}
}
);

const payment = await mollieResponse.json();

if (!mollieResponse.ok) {
console.error('Mollie fout:', payment);
return res.status(500).send('Kon betaling niet controleren');
}

// Alleen een daadwerkelijk betaalde betaling verwerken.
if (payment.status !== 'paid') {
return res.status(200).send('OK');
}

let metadata = payment.metadata;

if (typeof metadata === 'string') {
metadata = JSON.parse(metadata);
}

const bestellingId = metadata?.bestellingId;

if (!bestellingId) {
console.error('Geen bestellingId in Mollie metadata');
return res.status(500).send('Bestelling-ID ontbreekt');
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

console.log('SUPABASE_URL aanwezig:', Boolean(supabaseUrl));
console.log('SUPABASE_SECRET_KEY aanwezig:', Boolean(supabaseSecretKey));

if (!supabaseUrl || !supabaseSecretKey) {
  console.error('Supabase environment variables ontbreken');
  return res.status(500).send('Serverconfiguratie ontbreekt');
}

const supabaseHeaders = {
apikey: supabaseSecretKey,
'Content-Type': 'application/json'
};

// 1. Bestelling op betaald zetten
const bestellingResponse = await fetch(
`${supabaseUrl}/rest/v1/bestellingen?id=eq.${encodeURIComponent(bestellingId)}`,
{
method: 'PATCH',
headers: {
...supabaseHeaders,
Prefer: 'return=minimal'
},
body: JSON.stringify({
status: 'betaald'
})
}
);

if (!bestellingResponse.ok) {
console.error(
'Fout bij bestelling bijwerken:',
await bestellingResponse.text()
);
return res.status(500).send('Bestelling kon niet worden bijgewerkt');
}

// 2. Alle kavels van deze bestelling ophalen
const koppelingResponse = await fetch(
`${supabaseUrl}/rest/v1/bestelling_kavels?bestelling_id=eq.${encodeURIComponent(bestellingId)}&select=kavelnummer`,
{
headers: supabaseHeaders
}
);

if (!koppelingResponse.ok) {
console.error(
'Fout bij ophalen bestelling_kavels:',
await koppelingResponse.text()
);
return res.status(500).send('Kavels konden niet worden opgehaald');
}

const koppelingen = await koppelingResponse.json();

// 3. Iedere bijbehorende kavel definitief op verkocht zetten
for (const koppeling of koppelingen) {
const kavelResponse = await fetch(
`${supabaseUrl}/rest/v1/kavels?kavelnummer=eq.${encodeURIComponent(koppeling.kavelnummer)}`,
{
method: 'PATCH',
headers: {
...supabaseHeaders,
Prefer: 'return=minimal'
},
body: JSON.stringify({
status: 'verkocht',
gereserveerd_tot: null,
updated_at: new Date().toISOString()
})
}
);

if (!kavelResponse.ok) {
console.error(
`Kavel ${koppeling.kavelnummer} kon niet worden bijgewerkt:`,
await kavelResponse.text()
);
return res.status(500).send('Een kavel kon niet worden bijgewerkt');
}
}

return res.status(200).send('OK');
} catch (error) {
console.error('Webhook fout:', error);
return res.status(500).send('Webhook verwerking mislukt');
}
}
