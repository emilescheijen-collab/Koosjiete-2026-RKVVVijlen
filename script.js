const SUPABASE_URL = 'https://qqjzhzcmuhmxbmlvvjvk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nx8hJzfx00jVhm3aqlQEMg_Yic9gghC';

const grid = document.getElementById('plotGrid');
const count = document.getElementById('count');
const total = document.getElementById('total');
const btn = document.getElementById('continueBtn');
const modal = document.getElementById('modal');

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
const list = [...selected].join(', ');
const amount = selected.size * 5;

modal.querySelector('.modal-body').innerHTML = `
<h3>Jouw selectie</h3>
<p><strong>Kavels:</strong> ${list}</p>
<p><strong>Totaal:</strong> € ${amount.toFixed(2).replace('.', ',')}</p>
<p>In de volgende stap koppelen we hier het bestelformulier aan.</p>
`;

modal.showModal();
});

modal.addEventListener('click', (e) => {
if (e.target.matches('[data-close]')) {
modal.close();
}
});

loadKavels();
update();
