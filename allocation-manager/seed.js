export const PRODUCERS = [
  { id: 'prod-riss', name: 'Catherine Riss', color: '#c48a2a', region: 'Alsace' },
  { id: 'prod-corbineau', name: 'Patrick Corbineau', color: '#7a2436', region: 'Touraine / VDF' },
  { id: 'prod-babass', name: 'Domaine Babass', color: '#6b3a5a', region: 'Loire / VDF' },
  { id: 'prod-olivier', name: "Les Vignes d'Olivier", color: '#2c4a6e', region: 'Languedoc / VDF' },
];

export const CUSTOMERS = [
  { id: 'cust-rep', name: 'REP Transfer', kind: 'transfer' },
  { id: 'cust-ordinaire', name: 'Ordinaire' },
  { id: 'cust-mijote', name: 'Mijote' },
  { id: 'cust-drivers', name: "Driver's Market" },
  { id: 'cust-little-vine', name: 'Little Vine' },
  { id: 'cust-snail', name: 'Snail Bar' },
  { id: 'cust-ruby', name: 'Ruby' },
  { id: 'cust-gemini', name: 'Gemini' },
  { id: 'cust-punchdown', name: 'Punchdown' },
  { id: 'cust-fog', name: 'Fog Eater' },
  { id: 'cust-slug', name: 'Slug Bar' },
  { id: 'cust-minimo', name: 'Minimo' },
  { id: 'cust-flatiron', name: 'Flatiron' },
  { id: 'cust-lolo', name: 'Lolo' },
  { id: 'cust-habibi', name: 'Habibi' },
  { id: 'cust-penny', name: 'Penny Roma' },
  { id: 'cust-quince', name: 'Quince' },
  { id: 'cust-redfield', name: 'Redfield' },
  { id: 'cust-biondivino', name: 'Biondivino' },
  { id: 'cust-fools', name: "Fool's Errand" },
  { id: 'cust-tofino', name: 'Tofino' },
  { id: 'cust-souvenir', name: 'Souvenir' },
  { id: 'cust-cotogna', name: 'Cotogna' },
  { id: 'cust-mister-jius', name: 'Mister Jius' },
];

export const WINES = [
  {
    id: 'wine-dessous',
    producerId: 'prod-riss',
    name: 'Dessous de Table',
    vintage: '2022',
    appellation: 'Alsace',
    color: 'white',
  },
  {
    id: 'wine-pied',
    producerId: 'prod-riss',
    name: 'Pied de Nez',
    vintage: '2022',
    appellation: 'Alsace',
    color: 'white',
  },
  {
    id: 'wine-riesling',
    producerId: 'prod-riss',
    name: 'Riesling de grès ou de force',
    vintage: '2022',
    appellation: 'Alsace',
    color: 'white',
  },
  {
    id: 'wine-conquetes',
    producerId: 'prod-corbineau',
    name: 'Conquètes',
    vintage: '2011',
    appellation: 'Touraine',
    color: 'red',
    format: 'magnum',
  },
  {
    id: 'wine-le-clos',
    producerId: 'prod-corbineau',
    name: 'Le Clos',
    vintage: '2019',
    appellation: 'VDF',
    color: 'red',
  },
  {
    id: 'wine-presse',
    producerId: 'prod-corbineau',
    name: 'Presse',
    vintage: '2021',
    appellation: 'VDF',
    color: 'red',
  },
  {
    id: 'wine-gamay',
    producerId: 'prod-babass',
    name: 'Dervieux Gamay "au bon secours"',
    vintage: '2022',
    appellation: 'VDF',
    color: 'red',
  },
  {
    id: 'wine-joseph',
    producerId: 'prod-babass',
    name: 'Dervieux Joseph Anne Françoise',
    vintage: '2020',
    appellation: 'VDF',
    color: 'white',
  },
  {
    id: 'wine-orangee',
    producerId: 'prod-olivier',
    name: 'Deferlante Orangée',
    vintage: '2023',
    appellation: 'VDF',
    color: 'skin',
  },
  {
    id: 'wine-deferlante-red',
    producerId: 'prod-olivier',
    name: 'Deferlante',
    vintage: '2022',
    appellation: 'VDF',
    color: 'red',
  },
];

export const MONTH_ALLOTMENTS = [
  { wineId: 'wine-dessous', cases: 1.417, wholesale: 300, retail: 330 },
  { wineId: 'wine-pied', cases: 0.5, wholesale: 345, retail: 384 },
  { wineId: 'wine-riesling', cases: 0.917, wholesale: 330, retail: 360 },
  { wineId: 'wine-conquetes', cases: 0.33, wholesale: 624, retail: 684 },
  { wineId: 'wine-le-clos', cases: 0.5, wholesale: 624, retail: 684 },
  { wineId: 'wine-presse', cases: 0.5, wholesale: 624, retail: 684 },
  { wineId: 'wine-gamay', cases: 3, wholesale: 294, retail: 318 },
  { wineId: 'wine-joseph', cases: 1, wholesale: 420, retail: 462 },
  { wineId: 'wine-orangee', cases: 5, wholesale: 240, retail: 264 },
  { wineId: 'wine-deferlante-red', cases: 2, wholesale: 216, retail: 234 },
];

export const MONTH_ALLOCATIONS = [
  { wineId: 'wine-dessous', customerId: 'cust-ordinaire', cases: 0.5 },
  { wineId: 'wine-dessous', customerId: 'cust-mijote', cases: 0.5 },
  { wineId: 'wine-dessous', customerId: 'cust-snail', cases: 0.5 },
  { wineId: 'wine-pied', customerId: 'cust-mijote', cases: 0.5, status: 'confirmed' },
  { wineId: 'wine-riesling', customerId: 'cust-ordinaire', cases: 0.917 },
  { wineId: 'wine-presse', customerId: 'cust-punchdown', cases: 0.5 },
  { wineId: 'wine-gamay', customerId: 'cust-ordinaire', cases: 0.5 },
  { wineId: 'wine-gamay', customerId: 'cust-punchdown', cases: 0.5, status: 'confirmed' },
  { wineId: 'wine-gamay', customerId: 'cust-snail', cases: 0.5 },
  { wineId: 'wine-gamay', customerId: 'cust-mijote', cases: 1 },
  { wineId: 'wine-gamay', customerId: 'cust-gemini', cases: 0.5 },
  { wineId: 'wine-joseph', customerId: 'cust-ordinaire', cases: 0.5 },
  { wineId: 'wine-joseph', customerId: 'cust-gemini', cases: 0.5, status: 'waiting' },
  { wineId: 'wine-orangee', customerId: 'cust-ordinaire', cases: 1 },
  { wineId: 'wine-orangee', customerId: 'cust-punchdown', cases: 1 },
  { wineId: 'wine-orangee', customerId: 'cust-gemini', cases: 1, status: 'waiting' },
  { wineId: 'wine-orangee', customerId: 'cust-snail', cases: 1 },
  { wineId: 'wine-orangee', customerId: 'cust-souvenir', cases: 1 },
  { wineId: 'wine-deferlante-red', customerId: 'cust-ordinaire', cases: 0.5 },
  { wineId: 'wine-deferlante-red', customerId: 'cust-punchdown', cases: 0.5 },
  { wineId: 'wine-deferlante-red', customerId: 'cust-gemini', cases: 0.5, status: 'waiting' },
  { wineId: 'wine-deferlante-red', customerId: 'cust-snail', cases: 0.5 },
];

export function catalogSeedEvents() {
  const events = [];
  PRODUCERS.forEach((producer) => {
    events.push({ op: 'producer_added', ...producer });
  });
  CUSTOMERS.forEach((customer) => {
    events.push({ op: 'customer_added', ...customer });
  });
  WINES.forEach((wine) => {
    events.push({ op: 'wine_added', ...wine });
  });
  return events;
}

export function monthSeedEvents() {
  const events = [];
  MONTH_ALLOTMENTS.forEach((row) => {
    events.push({ op: 'allotment_set', ...row });
  });
  MONTH_ALLOCATIONS.forEach((row) => {
    events.push({ op: 'allocation_set', status: row.status || '', ...row });
  });
  return events;
}
