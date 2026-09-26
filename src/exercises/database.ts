export const schemaSql = `
CREATE TABLE CLIENTE (
  CF TEXT PRIMARY KEY NOT NULL,
  Cognome TEXT NOT NULL,
  Nome TEXT NOT NULL,
  Nazione TEXT NOT NULL,
  Email TEXT NOT NULL UNIQUE
);
CREATE TABLE PRODOTTO (
  Codice TEXT PRIMARY KEY NOT NULL,
  Nome TEXT NOT NULL,
  Descrizione TEXT,
  Prezzo REAL NOT NULL CHECK (Prezzo >= 0)
);
CREATE TABLE ORDINE (
  Id INTEGER PRIMARY KEY,
  CodProdotto TEXT NOT NULL REFERENCES PRODOTTO(Codice),
  CFCliente TEXT NOT NULL REFERENCES CLIENTE(CF),
  Data TEXT NOT NULL,
  MetodoPagamento TEXT NOT NULL CHECK (MetodoPagamento IN ('Carta di credito', 'Bonifico', 'PayPal')),
  TipoConsegna TEXT NOT NULL,
  DataSpedizione TEXT,
  DataRicezione TEXT,
  CHECK (DataRicezione IS NULL OR DataSpedizione IS NOT NULL)
);`

const quote = (value: string | number | null) =>
  value === null ? 'NULL' : typeof value === 'number' ? value : `'${value.replaceAll("'", "''")}'`
const insert = (table: string, rows: (string | number | null)[][]) =>
  `INSERT INTO ${table} VALUES ${rows.map((row) => `(${row.map(quote).join(',')})`).join(',')};`

// Each order represents one unit. These named boundary cases are part of the curriculum.
export function makeSeed(variant = false): string {
  const customers = [
    ['RSSMRA80A01F205X', 'Rossi', 'Mario', 'Italia', 'mario.rossi@example.test'],
    ['BNCNNA85B42F205Y', 'Bianchi', 'Anna', 'Italia', 'anna.bianchi@example.test'],
    ['VRDLCU90C03F205Z', 'Verdi', 'Luca', 'Italia', 'luca.verdi@example.test'],
    ['NRISRA92D44F205W', 'Neri', 'Sara', 'Italia', 'sara.neri@example.test'],
    ['GLLPLA78E05F205V', 'Galli', 'Paolo', 'Svizzera', 'paolo.galli@example.test'],
    ['CNTLNA95F46F205U', 'Conti', 'Elena', 'Italia', 'elena.conti@example.test'],
    ['RCCGIA88G07F205T', 'Ricci', 'Gianni', 'Francia', 'gianni.ricci@example.test'],
  ]
  if (variant)
    customers.forEach((c, i) => {
      c[0] = `TEST${i}`
      c[2] += ' II'
      c[4] = `test${i}@example.test`
    })
  const products = [
    ['P01', 'Quaderno', 'Quaderno a quadretti', variant ? 12 : 10],
    ['P02', 'Manuale SQL', 'Basi di dati relazionali', variant ? 100 : 40],
    ['P03', 'Tastiera', 'Tastiera meccanica', variant ? 85 : 80],
    ['P04', 'Monitor', 'Monitor 24 pollici', variant ? 220 : 200],
    ['P05', 'Workstation', 'Acquisto fuori dal 2025', variant ? 2700 : 2500],
  ]
  const orders: (string | number | null)[][] = []
  const add = (
    customer: number,
    n: number,
    product: string,
    status: 'transit' | 'delivered' | 'pending',
    method = 'Carta di credito',
    year = 2025,
  ) => {
    for (let i = 0; i < n; i++)
      orders.push([
        orders.length + 1,
        product,
        customers[customer][0],
        `${year}-03-${String(i + 1).padStart(2, '0')}`,
        method,
        'Standard',
        status === 'pending' ? null : `${year}-03-15`,
        status === 'delivered' ? `${year}-03-20` : null,
      ])
  }
  add(0, variant ? 5 : 6, 'P02', 'transit') // Boundary changes in the second grading fixture.
  add(1, variant ? 6 : 5, 'P01', 'transit')
  add(2, 4, 'P03', 'transit')
  add(2, 4, 'P03', 'delivered', 'Bonifico')
  add(3, 3, 'P01', 'transit')
  add(3, 4, 'P01', 'pending', 'PayPal')
  add(4, 9, 'P04', 'delivered', 'Bonifico')
  add(6, 1, 'P05', 'transit', variant ? 'Bonifico' : 'Carta di credito', 2024)
  add(6, 1, 'P05', 'delivered', variant ? 'Bonifico' : 'Carta di credito', 2026)
  return [
    insert('CLIENTE', customers),
    insert('PRODOTTO', products),
    insert('ORDINE', orders),
  ].join('\n')
}
