import crypto from 'crypto';

function parseCookies(cookieHeader = '') {
return Object.fromEntries(
cookieHeader
.split(';')
.map(cookie => cookie.trim())
.filter(Boolean)
.map(cookie => {
const index = cookie.indexOf('=');
return [
cookie.slice(0, index),
decodeURIComponent(cookie.slice(index + 1))
];
})
);
}

function maakHandtekening(timestamp, secret) {
return crypto
.createHmac('sha256', secret)
.update(String(timestamp))
.digest('hex');
}

function sessieIsGeldig(req, secret) {
const cookies = parseCookies(req.headers.cookie || '');
const sessie = cookies.admin_session;

if (!sessie) {
return false;
}

const [geldigTotTekst, ontvangenHandtekening] = sessie.split('.');

if (!geldigTotTekst || !ontvangenHandtekening) {
return false;
}

const geldigTot = Number(geldigTotTekst);

if (!Number.isFinite(geldigTot) || Date.now() > geldigTot) {
return false;
}

const verwachteHandtekening = maakHandtekening(
geldigTot,
secret
);

const ontvangenBuffer = Buffer.from(ontvangenHandtekening);
const verwachteBuffer = Buffer.from(verwachteHandtekening);

if (ontvangenBuffer.length !== verwachteBuffer.length) {
return false;
}

return crypto.timingSafeEqual(
ontvangenBuffer,
verwachteBuffer
);
}

export default async function handler(req, res) {
if (req.method !== 'GET') {
return res.status(405).json({
error: 'Method not allowed'
});
}

try {
const sessionSecret = process.env.ADMIN_SESSION_SECRET;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (
!sessionSecret ||
!supabaseUrl ||
!supabaseSecretKey
) {
console.error('Admin/Supabase configuratie ontbreekt');

return res.status(500).json({
error: 'Serverconfiguratie ontbreekt'
});
}

if (!sessieIsGeldig(req, sessionSecret)) {
return res.status(401).json({
error: 'Niet ingelogd'
});
}

const headers = {
apikey: supabaseSecretKey,
Authorization: `Bearer ${supabaseSecretKey}`
};

const bestellingResponse = await fetch(
`${supabaseUrl}/rest/v1/bestellingen?select=id,naam,email,telefoon,status,totaalbedrag,created_at,bevestigingsmail_verstuurd&order=created_at.desc`,
{
headers
}
);

if (!bestellingResponse.ok) {
console.error(
'Bestellingen ophalen mislukt:',
await bestellingResponse.text()
);

return res.status(500).json({
error: 'Bestellingen konden niet worden opgehaald'
});
}

const bestellingen = await bestellingResponse.json();

const koppelingenResponse = await fetch(
`${supabaseUrl}/rest/v1/bestelling_kavels?select=bestelling_id,kavelnummer`,
{
headers
}
);

if (!koppelingenResponse.ok) {
console.error(
'Bestelling_kavels ophalen mislukt:',
await koppelingenResponse.text()
);

return res.status(500).json({
error: 'Kavelkoppelingen konden niet worden opgehaald'
});
}

const koppelingen = await koppelingenResponse.json();

const kavelsPerBestelling = new Map();

for (const koppeling of koppelingen) {
if (!kavelsPerBestelling.has(koppeling.bestelling_id)) {
kavelsPerBestelling.set(koppeling.bestelling_id, []);
}

kavelsPerBestelling
.get(koppeling.bestelling_id)
.push(koppeling.kavelnummer);
}

const resultaat = bestellingen.map(bestelling => ({
...bestelling,
kavels: (
kavelsPerBestelling.get(bestelling.id) || []
).sort((a, b) => a.localeCompare(b, 'nl'))
}));

// Alle kavels ophalen voor de kavelzoeker
const kavelsResponse = await fetch(
`${supabaseUrl}/rest/v1/kavels?select=kavelnummer,status&order=id.asc`,
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
bestellingen: resultaat,
kavels
});


} catch (error) {
console.error('Admin data fout:', error);

return res.status(500).json({
error: 'Beheerdata kon niet worden geladen'
});
}
}
