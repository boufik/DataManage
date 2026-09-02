# CSV Data Analyzer

A lightweight, browser-based tool for exploring CSV data. Upload a file and instantly preview it, compute statistics across rows and columns, and run SQL-style operations. All operations are client-side, with no server or upload of your data anywhere.

## 1. Features

- **Dataframe preview**: Sortable table view of the uploaded CSV.
- **(1) Stats across a single column**: Most frequent value, mean, median, standard deviation, sum and unique value count per column.
- **(2) Stats across a single row**: Compares one row's numeric values against the same
  columns across all other rows.
- **(3) SQL operations**: `COUNT(*)` and `SELECT` with `WHERE`, `ORDER BY` and `LIMIT`.

## 2. Running locally

It is a static site, without a build step. Either:

- Open `index.html` directly in your browser or
- Serve the folder statically and run `python -m http.server 8000`

The application is also configured for deployment on Vercel (see `vercel.json`).

## 3. Sample data for local experiments

The [`CSVs/`](./CSVs) folder contains example files so you can test the analyzer right away. Each CSV has 10 rows and 8 columns, mixing numeric and categorical data:

- **`cars.csv`**: Car models with `cc`, `hp`, `torque_nm`, `weight_kg` `top_speed_kph` (numeric) plus `body_type` and `fuel` (categorical).
- **`laptops.csv`**: Laptop models with `ram_gb`, `storage_gb`, `screen_inch` `battery_wh`, `price_usd` (numeric) plus `brand` and `os` (categorical).

Numeric columns are ideal for the mean/median/std/sum operations. Categorical columns work well with "Most Frequent Value" and "Unique Value Count" options.
