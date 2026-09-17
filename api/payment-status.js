export default async function handler(req, res) {
if (req.method !== 'GET') {
return res.status(405).json({ error: 'Method not allowed' });
}

try {
const bestellingId = req.query.bestellingId;

if (!bestellingId) {
return res.status(400).json({
error: 'Bestelling-ID ontbreekt'
});
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
return res.status(500).json({
error: 'Serverconfiguratie ontbreekt'
});
}

const headers = {
apikey: supabaseSecretKey,
Authorization: `Bearer ${supabaseSecretKey}`
};

// Bestelling ophalen
const bestellingResponse = await fetch(
`${supabaseUrl}/rest/v1/bestellingen?id=eq.${encodeURIComponent(
bestellingId
)}&select=id,status,totaalbedrag`,
{
headers
}
);

if (!bestellingResponse.ok) {
console.error(
'Bestelling ophalen mislukt:',
await bestellingResponse.text()
);

return res.status(500).json({
error: 'Bestelling kon niet worden opgehaald'
});
}

const bestellingen = await bestellingResponse.json();
const bestelling = bestellingen[0];

if (!bestelling) {
return res.status(404).json({
error: 'Bestelling niet gevonden'
});
}

// Gekoppelde kavels ophalen
const kavelsResponse = await fetch(
`${supabaseUrl}/rest/v1/bestelling_kavels?bestelling_id=eq.${encodeURIComponent(
bestellingId
)}&select=kavelnummer&order=kavelnummer.asc`,
{
headers
}
);

if (!kavelsResponse.ok) {
console.error(
'Kavels ophalen mislukt:',
await kavelsResponse.text()
);

return res.status(500).json({
error: 'Kavels konden niet worden opgehaald'
});
}

const kavels = await kavelsResponse.json();

return res.status(200).json({
status: bestelling.status,
totaalbedrag: bestelling.totaalbedrag,
kavels: kavels.map(kavel => kavel.kavelnummer)
});

} catch (error) {
console.error('Payment status fout:', error);

return res.status(500).json({
error: 'Betaalstatus kon niet worden gecontroleerd'
});
}
}
