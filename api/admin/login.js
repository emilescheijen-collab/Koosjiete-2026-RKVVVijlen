import crypto from 'crypto';

function veiligeVergelijking(a, b) {
const bufferA = Buffer.from(String(a));
const bufferB = Buffer.from(String(b));

if (bufferA.length !== bufferB.length) {
return false;
}

return crypto.timingSafeEqual(bufferA, bufferB);
}

function maakHandtekening(timestamp, secret) {
return crypto
.createHmac('sha256', secret)
.update(String(timestamp))
.digest('hex');
}

export default async function handler(req, res) {
if (req.method !== 'POST') {
return res.status(405).json({
error: 'Method not allowed'
});
}

try {
const adminPassword = process.env.ADMIN_PASSWORD;
const sessionSecret = process.env.ADMIN_SESSION_SECRET;

if (!adminPassword || !sessionSecret) {
console.error('Admin environment variables ontbreken');

return res.status(500).json({
error: 'Serverconfiguratie ontbreekt'
});
}

const wachtwoord = req.body?.wachtwoord;

if (!wachtwoord) {
return res.status(400).json({
error: 'Wachtwoord ontbreekt'
});
}

if (!veiligeVergelijking(wachtwoord, adminPassword)) {
return res.status(401).json({
error: 'Onjuist wachtwoord'
});
}

// Geldigheidsduur van de beheersessie: 8 uur
const geldigTot = Date.now() + (8 * 60 * 60 * 1000);

const handtekening = maakHandtekening(
geldigTot,
sessionSecret
);

const sessieWaarde = `${geldigTot}.${handtekening}`;

res.setHeader(
'Set-Cookie',
[
`admin_session=${sessieWaarde}`,
'HttpOnly',
'Secure',
'SameSite=Lax',
'Path=/',
'Max-Age=28800'
].join('; ')
);

return res.status(200).json({
success: true
});

} catch (error) {
console.error('Admin login fout:', error);

return res.status(500).json({
error: 'Inloggen is mislukt'
});
}
}
