import type { Exercise } from '../types'
import { makeSeed, schemaSql } from './database'

const shared = { schemaSql, seedSql: makeSeed(), validationSeeds: [makeSeed(true)] }
export const exercises: Exercise[] = [
  {
    ...shared,
    id: 'in-transit',
    title: 'Spediti, non consegnati',
    subtitle: 'Rows become groups',
    difficulty: 'Intermediate',
    statement:
      'Determinare il nome, il cognome e l’email dei clienti che hanno più di 5 prodotti spediti ma non ancora consegnati.',
    tags: ['JOIN', 'WHERE', 'GROUP BY', 'HAVING'],
    outputColumns: ['Nome', 'Cognome', 'Email'],
    rules: [
      'Each ORDINE row represents one purchased product.',
      'More than 5 means strictly greater than 5.',
      'A NULL date means the event has not happened.',
    ],
    starter: `-- Start with the customers and their orders.\nSELECT C.Nome, C.Cognome, C.Email\nFROM CLIENTE C\nJOIN ORDINE O ON C.CF = O.CFCliente;`,
    reference: `SELECT C.Nome, C.Cognome, C.Email
FROM CLIENTE C
JOIN ORDINE O ON C.CF = O.CFCliente
WHERE O.DataSpedizione IS NOT NULL
  AND O.DataRicezione IS NULL
GROUP BY C.CF, C.Nome, C.Cognome, C.Email
HAVING COUNT(*) > 5;`,
    explanation:
      'WHERE keeps shipped but undelivered orders. GROUP BY gathers those rows by customer. HAVING keeps only groups with more than five rows; SELECT projects the three requested fields. Grouping by CF preserves customer identity.',
    hints: [
      'Compare your number of returned customers with the expected result.',
      'Shipment and delivery are separate events. Filter individual orders before counting.',
      'Use DataSpedizione IS NOT NULL and DataRicezione IS NULL. Keep groups with COUNT(*) > 5.',
    ],
  },
  {
    ...shared,
    id: 'above-average',
    title: 'Oltre la media',
    subtitle: 'An average of totals',
    difficulty: 'Advanced',
    statement:
      'Determinare il codice dei clienti che nel 2025 hanno speso più della media degli acquisti per cliente nel 2025.',
    tags: ['SUM', 'AVG', 'SUBQUERY'],
    outputColumns: ['CFCliente'],
    noCte: true,
    rules: [
      'Average over customers with at least one purchase in 2025.',
      'Use product prices as purchase prices; one product per order.',
      'Dates are ISO YYYY-MM-DD. Return only the customer code.',
      'Exam Mode requests a nested query (NO CTE). The CTE is semantically valid.',
    ],
    starter: `-- First, inspect purchases made in 2025.\nSELECT O.CFCliente, P.Prezzo\nFROM ORDINE O\nJOIN PRODOTTO P ON O.CodProdotto = P.Codice\nWHERE O.Data BETWEEN '2025-01-01' AND '2025-12-31';`,
    reference: `SELECT O.CFCliente
FROM ORDINE O
JOIN PRODOTTO P ON O.CodProdotto = P.Codice
WHERE O.Data BETWEEN '2025-01-01' AND '2025-12-31'
GROUP BY O.CFCliente
HAVING SUM(P.Prezzo) > (
  SELECT AVG(T.Spesa)
  FROM (
    SELECT O2.CFCliente, SUM(P2.Prezzo) AS Spesa
    FROM ORDINE O2
    JOIN PRODOTTO P2 ON O2.CodProdotto = P2.Codice
    WHERE O2.Data BETWEEN '2025-01-01' AND '2025-12-31'
    GROUP BY O2.CFCliente
  ) T
);`,
    alternative: `WITH SPESE AS (
  SELECT O.CFCliente, SUM(P.Prezzo) AS Totale
  FROM ORDINE O
  JOIN PRODOTTO P ON O.CodProdotto = P.Codice
  WHERE O.Data BETWEEN '2025-01-01' AND '2025-12-31'
  GROUP BY O.CFCliente
)
SELECT CFCliente
FROM SPESE
WHERE Totale > (SELECT AVG(Totale) FROM SPESE);`,
    explanation:
      'Compute one spending total per active customer in 2025, then average those totals. Comparing a customer total with the average price of an individual product answers a different question. The nested query and CTE express the same calculation. Customers without 2025 orders do not enter the average.',
    hints: [
      'Check which rows belong to 2025 in both the outer query and the average calculation.',
      'AVG(P.Prezzo) averages purchases, not customer totals.',
      'Build SUM(P.Prezzo) per customer first; an outer AVG should average that derived table.',
    ],
  },
  {
    ...shared,
    id: 'always-credit',
    title: 'Sempre con carta',
    subtitle: 'Reason about “always”',
    difficulty: 'Intermediate',
    statement:
      'Determinare il codice fiscale dei clienti che hanno sempre pagato con carta di credito.',
    tags: ['EXCEPT', 'SETS', 'EXISTS'],
    outputColumns: ['CFCliente'],
    rules: [
      'A qualifying customer must have at least one order.',
      'Every payment must be Carta di credito, across all years.',
      'MetodoPagamento is NOT NULL. Return each customer once.',
    ],
    starter: `-- Which customers have placed an order?\nSELECT DISTINCT CFCliente\nFROM ORDINE;`,
    reference: `SELECT CFCliente
FROM ORDINE
EXCEPT
SELECT CFCliente
FROM ORDINE
WHERE MetodoPagamento <> 'Carta di credito';`,
    alternative: `SELECT C.CF
FROM CLIENTE C
WHERE EXISTS (
  SELECT O.Id FROM ORDINE O WHERE O.CFCliente = C.CF
)
AND NOT EXISTS (
  SELECT O.Id FROM ORDINE O
  WHERE O.CFCliente = C.CF
    AND O.MetodoPagamento <> 'Carta di credito'
);`,
    explanation:
      'Start with customers who placed an order. EXCEPT removes anyone with even one non-card payment and removes duplicates. A customer with no orders never enters the candidate set. EXISTS plus NOT EXISTS is an equivalent strategy.',
    hints: [
      'At least one card payment does not mean every payment was by card.',
      'Find customers with a counterexample: a payment made by another method.',
      'Subtract those customers from customers with orders. Starting from all CLIENTE would also include people with no orders.',
    ],
  },
]
export const getExercise = (id: string) => exercises.find((e) => e.id === id) ?? exercises[0]
