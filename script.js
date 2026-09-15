const SUPABASE_URL = 'https://qqjzhzcmuhmxbmlvvjvk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nx8hJzfx00jVhm3aqlQEMg_Yic9gghC';

const grid = document.getElementById('plotGrid');
const count = document.getElementById('count');
const total = document.getElementById('total');
const btn = document.getElementById('continueBtn');
const modal = document.getElementById('modal');

const orderForm = document.getElementById('orderForm');
const orderSelection = document.getElementById('orderSelection');
const orderTotal = document.getElementById('orderTotal');
const orderMessage = document.getElementById('orderMessage');
const reserveBtn = document.getElementById('reserveBtn');

const selected = new Set();

async function loadKavels() {
grid.innerHTML = 'Kavels laden...';

try {
const response = await fetch(
`${SUPABASE_URL}/rest/v1/kavels?select=kavelnummer,status&order=id.asc`,
{
headers: {
apikey: SUPABASE_KEY,
Authorization: `Bearer ${SUPABASE_KEY}`
}
}
);

if (!response.ok) {
throw new Error(`Supabase fout: ${response.status}`);
}

const kavels = await response.json();

grid.innerHTML = '';

kavels.forEach((kavel) => {
const id = kavel.kavelnummer;
const el = document.createElement('button');

el.className = 'plot';
el.textContent = id;
el.title = `Kavel ${id}`;
el.type = 'button';

if (kavel.status !== 'beschikbaar') {
el.classList.add('is-sold');
el.disabled = true;
} else {
el.addEventListener('click', () => {
if (selected.has(id)) {
selected.delete(id);
el.classList.remove('is-selected');
} else {
selected.add(id);
el.classList.add('is-selected');
}

update();
});
}

grid.appendChild(el);
});
} catch (error) {
console.error(error);
grid.innerHTML =
'De kavels konden niet worden geladen. Probeer de pagina opnieuw.';
}
}

function update() {
const n = selected.size;

count.textContent = `${n} ${n === 1 ? 'kavel' : 'kavels'}`;

total.textContent = new Intl.NumberFormat('nl-NL', {
style: 'currency',
currency: 'EUR'
}).format(n * 5);

btn.disabled = n === 0;
}

btn.addEventListener('click', () => {
if (selected.size === 0) {
return;
}

const kavels = [...selected];
const bedrag = kavels.length * 5;

orderSelection.innerHTML =
`<strong>Gekozen kavels:</strong> ${kavels.join(', ')}`;

orderTotal.textContent =
`Totaal: ${new Intl.NumberFormat('nl-NL', {
style: 'currency',
currency: 'EUR'
}).format(bedrag)}`;

orderMessage.textContent = '';
reserveBtn.disabled = false;
reserveBtn.textContent = 'Kavels reserveren';

modal.showModal();
});

modal.addEventListener('click', (event) => {
if (event.target.matches('[data-close]')) {
modal.close();
}
});

orderForm.addEventListener('submit', async (event) => {
event.preventDefault();

if (selected.size === 0) {
orderMessage.textContent = 'Selecteer eerst één of meer kavels.';
return;
}

const naam = document.getElementById('naam').value.trim();
const email = document.getElementById('email').value.trim();
const telefoon = document.getElementById('telefoon').value.trim();

if (!naam || !email || !telefoon) {
orderMessage.textContent = 'Vul alle gegevens in.';
return;
}

reserveBtn.disabled = true;
reserveBtn.textContent = 'Bezig met reserveren...';
orderMessage.textContent = '';

try {
const response = await fetch(
`${SUPABASE_URL}/rest/v1/rpc/reserveer_kavels`,
{
method: 'POST',
headers: {
apikey: SUPABASE_KEY,
Authorization: `Bearer ${SUPABASE_KEY}`,
'Content-Type': 'application/json'
},
body: JSON.stringify({
p_kavels: [...selected],
p_naam: naam,
p_email: email,
p_telefoon: telefoon
})
}
);

if (!response.ok) {
let foutmelding =
'De reservering kon niet worden uitgevoerd. Probeer het opnieuw.';

try {
const errorData = await response.json();

if (
errorData.message &&
errorData.message.includes('niet meer beschikbaar')
) {
foutmelding =
'Een of meer gekozen kavels zijn inmiddels door iemand anders gereserveerd. Kies opnieuw.';
}
} catch (error) {
console.error(error);
}

throw new Error(foutmelding);
}

await response.json();

orderMessage.textContent =
'Gelukt! Jouw kavels zijn 15 minuten gereserveerd.';

selected.clear();
update();
orderForm.reset();

await loadKavels();

reserveBtn.textContent = 'Kavels gereserveerd';
} catch (error) {
console.error(error);

orderMessage.textContent =
error.message ||
'Er ging iets mis bij het reserveren. Probeer het opnieuw.';

reserveBtn.disabled = false;
reserveBtn.textContent = 'Kavels reserveren';

await loadKavels();
}
});

loadKavels();
update();
