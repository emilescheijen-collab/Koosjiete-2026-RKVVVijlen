export default async function handler(req, res) {
if (req.method !== 'POST') {
return res.status(405).json({ error: 'Method not allowed' });
}

try {
const { kavels, bestellingId } = req.body;

if (!Array.isArray(kavels) || kavels.length === 0) {
return res.status(400).json({ error: 'Geen kavels geselecteerd.' });
}
if (!bestellingId) {
return res.status(400).json({ error: 'Bestelling-ID ontbreekt.' });
}

const bedrag = (kavels.length * 5).toFixed(2);

const response = await fetch('https://api.mollie.com/v2/payments', {
method: 'POST',
headers: {
Authorization: `Bearer ${process.env.MOLLIE_API_KEY}`,
'Content-Type': 'application/json'
},
body: JSON.stringify({
amount: {
currency: 'EUR',
value: bedrag
},
description: `Koo-sjiete RKVV Vijlen - ${kavels.length} kavel(s)`,
redirectUrl: `https://koosjiete-2026-rkvv-vijlen.vercel.app/betaling-terug.html?bestellingId=${encodeURIComponent(bestellingId)}`,
webhookUrl: `https://koosjiete-2026-rkvv-vijlen.vercel.app/api/mollie-webhook`,
metadata: {
bestellingId: bestellingId,
kavels: kavels
}
})
});

const payment = await response.json();

if (!response.ok) {
console.error(payment);
return res.status(500).json({
error: 'Mollie-betaling kon niet worden aangemaakt.'
});
}

return res.status(200).json({
paymentId: payment.id,
checkoutUrl: payment._links.checkout.href
});

} catch (error) {
console.error(error);

return res.status(500).json({
error: 'Er ging iets mis bij het starten van de betaling.'
});
}
}
