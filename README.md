# CSV Data Analyzer

A lightweight, browser-based tool for exploring CSV data. Upload a file and instantly preview it, compute statistics across rows and columns, and run SQL-style operations. All operations are client-side, with no server or upload of your data anywhere.

## 1. Features

- **Dataframe preview**: Sortable table view of the uploaded CSV.
- **(1) Stats across a single column**: Most frequent value, mean, median, standard deviation, sum, and unique value count.
- **(2) Stats across a single row** — compares one row's numeric values against the same
  columns across all other rows.
- **(3) SQL operations** — `COUNT(*)` and `SELECT` with `WHERE`, `ORDER BY`, and `LIMIT`.

## Running locally

It's a static site — no build step. Either:

- Open `index.html` directly in your browser, or
- Serve the folder statically, e.g.:

  ```bash
  python -m http.server 8000
  # then visit http://localhost:8000
  ```

The app is also configured for deployment on Vercel (see `vercel.json`).

## Sample data

The [`CSVs/`](./CSVs) folder contains ready-made example files so you can test the
analyzer right away. Each has 10 rows and 8 columns, mixing numeric and categorical data:

- **`cars.csv`** — car models with `cc`, `hp`, `torque_nm`, `weight_kg`, `top_speed_kph`
  (numeric) plus `body_type` and `fuel` (categorical).
- **`laptops.csv`** — laptop models with `ram_gb`, `storage_gb`, `screen_inch`,
  `battery_wh`, `price_usd` (numeric) plus `brand` and `os` (categorical).

Numeric columns are ideal for the mean/median/std/sum operations; categorical columns
work well with "most frequent value" and "unique value count".
