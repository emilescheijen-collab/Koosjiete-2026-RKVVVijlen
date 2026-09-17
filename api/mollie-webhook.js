export default async function handler(req, res) {
if (req.method !== 'POST') {
return res.status(405).send('Method not allowed');
}

try {
// Mollie stuurt het payment ID meestal als form-urlencoded.
let paymentId;

if (typeof req.body === 'string') {
paymentId = new URLSearchParams(req.body).get('id');
} else {
paymentId = req.body?.id;
}

if (!paymentId) {
return res.status(400).send('Payment ID ontbreekt');
}

// Vraag de actuele betaling rechtstreeks op bij Mollie.
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

// Bestelling-ID uit Mollie metadata halen.
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

console.log('Mollie status:', payment.status);
console.log('Bestelling ID:', bestellingId);
console.log('SUPABASE_URL aanwezig:', Boolean(supabaseUrl));
console.log(
'SUPABASE_SECRET_KEY aanwezig:',
Boolean(supabaseSecretKey)
);

if (!supabaseUrl || !supabaseSecretKey) {
console.error('Supabase environment variables ontbreken');
return res.status(500).send('Serverconfiguratie ontbreekt');
}

const supabaseHeaders = {
apikey: supabaseSecretKey,
Authorization: `Bearer ${supabaseSecretKey}`,
'Content-Type': 'application/json'
};

// ============================================================
// 1. BETAALD
// ============================================================

if (payment.status === 'paid') {
// Bestelling op betaald zetten.
const bestellingResponse = await fetch(
`${supabaseUrl}/rest/v1/bestellingen?id=eq.${encodeURIComponent(
bestellingId
)}`,
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

return res
.status(500)
.send('Bestelling kon niet worden bijgewerkt');
}

// Alle kavels van deze bestelling ophalen.
const koppelingResponse = await fetch(
`${supabaseUrl}/rest/v1/bestelling_kavels?bestelling_id=eq.${encodeURIComponent(
bestellingId
)}&select=kavelnummer`,
{
headers: supabaseHeaders
}
);

if (!koppelingResponse.ok) {
console.error(
'Fout bij ophalen bestelling_kavels:',
await koppelingResponse.text()
);

return res
.status(500)
.send('Kavels konden niet worden opgehaald');
}

const koppelingen = await koppelingResponse.json();

// Iedere kavel definitief op verkocht zetten.
for (const koppeling of koppelingen) {
const kavelResponse = await fetch(
`${supabaseUrl}/rest/v1/kavels?kavelnummer=eq.${encodeURIComponent(
koppeling.kavelnummer
)}`,
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

return res
.status(500)
.send('Een kavel kon niet worden bijgewerkt');
}
}

console.log('Betaling succesvol verwerkt');
return res.status(200).send('OK');
}

// ============================================================
// 2. MISLUKT / GEANNULEERD / VERLOPEN
// ============================================================

const mislukteStatussen = ['failed', 'canceled', 'expired'];

if (mislukteStatussen.includes(payment.status)) {
console.log(
`Betaling ${payment.status}. Kavels worden vrijgegeven.`
);

// Bestelling op verlopen zetten.
// Een reeds betaalde bestelling wordt hiermee NIET aangepast.
const bestellingResponse = await fetch(
`${supabaseUrl}/rest/v1/bestellingen?id=eq.${encodeURIComponent(
bestellingId
)}&status=neq.betaald`,
{
method: 'PATCH',
headers: {
...supabaseHeaders,
Prefer: 'return=minimal'
},
body: JSON.stringify({
status: 'verlopen'
})
}
);

if (!bestellingResponse.ok) {
console.error(
'Fout bij bestelling op verlopen zetten:',
await bestellingResponse.text()
);

return res
.status(500)
.send('Bestelling kon niet worden bijgewerkt');
}

// Bijbehorende kavels ophalen.
const koppelingResponse = await fetch(
`${supabaseUrl}/rest/v1/bestelling_kavels?bestelling_id=eq.${encodeURIComponent(
bestellingId
)}&select=kavelnummer`,
{
headers: supabaseHeaders
}
);

if (!koppelingResponse.ok) {
console.error(
'Fout bij ophalen bestelling_kavels:',
await koppelingResponse.text()
);

return res
.status(500)
.send('Kavels konden niet worden opgehaald');
}

const koppelingen = await koppelingResponse.json();

// Alleen kavels die NOG gereserveerd zijn vrijgeven.
// Een reeds verkochte kavel kan hierdoor nooit worden teruggezet.
for (const koppeling of koppelingen) {
const kavelResponse = await fetch(
`${supabaseUrl}/rest/v1/kavels?kavelnummer=eq.${encodeURIComponent(
koppeling.kavelnummer
)}&status=eq.gereserveerd`,
{
method: 'PATCH',
headers: {
...supabaseHeaders,
Prefer: 'return=minimal'
},
body: JSON.stringify({
status: 'beschikbaar',
gereserveerd_tot: null,
updated_at: new Date().toISOString()
})
}
);

if (!kavelResponse.ok) {
console.error(
`Kavel ${koppeling.kavelnummer} kon niet worden vrijgegeven:`,
await kavelResponse.text()
);

return res
.status(500)
.send('Een kavel kon niet worden vrijgegeven');
}
}

console.log('Mislukte betaling verwerkt en kavels vrijgegeven');
return res.status(200).send('OK');
}

// ============================================================
// 3. TIJDELIJKE STATUS
// ============================================================

// Bijvoorbeeld open, pending of authorized.
// In dat geval houden we de reservering gewoon in stand.
console.log(
`Mollie status ${payment.status}: nog geen actie nodig`
);

return res.status(200).send('OK');
} catch (error) {
console.error('Webhook fout:', error);
return res.status(500).send('Webhook verwerking mislukt');
}
}
