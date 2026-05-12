export const DEMO_QUERY = `-- Default demo: Find people whose real income > stated income
SELECT p.name, p.birth_year, t.year, t.stated_income, bank.real_income
FROM persons AS p
JOIN tax AS t
    ON p.id = t.person
JOIN (
    SELECT 
        b.person,
        YEAR(b.date) AS year,
        SUM(b.income) AS real_income
    FROM bank_statements AS b
    GROUP BY b.person, YEAR(b.date)
) AS bank
    ON p.id = bank.person
   AND t.year = bank.year
WHERE t.stated_income < bank.real_income;`;

export const EXAMPLE_QUERIES = [
  {
    label: 'Simple SELECT',
    sql: `SELECT * FROM persons;`
  },
  {
    label: 'WHERE filter',
    sql: `SELECT * FROM persons\nWHERE birth_year > 1997;`
  },
  {
    label: 'INNER JOIN',
    sql: `SELECT p.name, t.year, t.stated_income\nFROM persons AS p\nJOIN tax AS t ON p.id = t.person;`
  },
  {
    label: 'LEFT JOIN',
    sql: `SELECT p.name, t.year, t.stated_income\nFROM persons AS p\nLEFT JOIN tax AS t ON p.id = t.person;`
  },
  {
    label: 'GROUP BY + SUM',
    sql: `SELECT b.person, YEAR(b.date) AS yr, SUM(b.income) AS total\nFROM bank_statements AS b\nGROUP BY b.person, YEAR(b.date);`
  },
  {
    label: 'HAVING filter',
    sql: `SELECT b.person, SUM(b.income) AS total\nFROM bank_statements AS b\nGROUP BY b.person\nHAVING SUM(b.income) > 1500;`
  },
  {
    label: 'Subquery in FROM',
    sql: `SELECT p.name, bank.real_income\nFROM persons AS p\nJOIN (\n  SELECT b.person, SUM(b.income) AS real_income\n  FROM bank_statements AS b\n  GROUP BY b.person\n) AS bank ON p.id = bank.person;`
  },
  {
    label: 'Full demo query',
    sql: DEMO_QUERY
  },
  {
    label: 'INSERT',
    sql: `INSERT INTO persons VALUES (4, 'Lena', 2001);`
  },
  {
    label: 'UPDATE',
    sql: `UPDATE tax SET stated_income = 1200 WHERE person = 1;`
  },
  {
    label: 'DELETE',
    sql: `DELETE FROM persons WHERE id = 3;`
  },
  {
    label: 'ORDER BY + LIMIT',
    sql: `SELECT * FROM bank_statements\nORDER BY income DESC\nLIMIT 3;`
  },
  {
    label: 'COUNT + AVG',
    sql: `SELECT b.person, COUNT(*) AS tx_count, AVG(b.income) AS avg_income\nFROM bank_statements AS b\nGROUP BY b.person;`
  },
  {
    label: 'COALESCE',
    sql: `SELECT p.name, COALESCE(t.stated_income, 0) AS income\nFROM persons AS p\nLEFT JOIN tax AS t ON p.id = t.person;`
  },
];
