# Walkthrough for Issue 07 - Develop a table for tax year assessment value distributions

## My initial input to Gemini

> I would like to take on this task within the s26-team7-cama folder. Can you take a first stab at it?
>
> ````markdown
> [...Issue #7 markdown here...]
> ````

## Gemini's plan

Here's the plan (slightly corrected by me) that Gemini put together. It uses this to seed its own context for what it should do.

> # Implementation Plan: Pre-aggregate Assessment Data into Bins
>
> ## Goal Description
> Create a SQL query to pre-aggregate property assessment data into log-scale bins by tax year. This will create a derived table `derived.tax_year_assessment_bins` that the UI can query efficiently without processing the full dataset. The query will be triggered by the existing `run_sql` Cloud Function and orchestrated by the Cloud Workflow.
>
> ## Proposed Changes
>
> ### SQL Aggregation (Derived Data)
> #### [NEW] `tasks/run_sql/sql/derived/tax_year_assessment_bins.sql`
> - Add a new SQL file that creates or replaces the `derived.tax_year_assessment_bins` table.
> - Calculate bins for the assessment values using `market_value` from `core.opa_assessments`.
> - Use a logarithmic or linear binning approach (e.g. intervals of $50,000 for linear scaling or powers of 10/log rounding for log scale).
>    Linear binning is easiest: `FLOOR(market_value / 50000) * 50000`.
>
> ### Data Pipeline Workflow
> #### [MODIFY] [tasks/data_pipeline/workflow.yaml](file:///home/mjumbewu/Code/MUSA/MUSA5090/Spring2026/s26-team7-cama/tasks/data_pipeline/workflow.yaml)
> - Add a step to `assessments_branch` to invoke the `run-sql` cloud function, parsing `derived/tax_year_assessment_bins.sql`.
>
> ### README
> #### [MODIFY] [tasks/README.md](file:///home/mjumbewu/Code/MUSA/MUSA5090/Spring2026/s26-team7-cama/tasks/README.md)
> - Provide information on the new derived SQL file.
>
> ## Verification
> - We can trigger the `run_sql` cloud function via local curl to verify the sql executes without errors.
> - Test the new step in the workflow.

## Verification and modifications

Running this plan resulted in the code in commit [4bf7c07](https://github.com/Weitzman-MUSA-GeoCloud/s26-team7-cama/commit/4bf7c07f94903712e34b5d9a5372438ba5017fe8). To test the results, I ran the query from [tax_year_assessment_bins.sql](https://github.com/Weitzman-MUSA-GeoCloud/s26-team7-cama/blob/4bf7c07f94903712e34b5d9a5372438ba5017fe8/tasks/run_sql/sql/derived/tax_year_assessment_bins.sql) in the BigQuery UI and got ouput that looked like the following:

![Initial query results](img/Screenshot%20from%202026-04-09%2015-06-37.png)

I was pretty dissatisfied with the linear binning approach, knowing that there's such a long tail, so I asked the following:

> Also, can you switch to logarithmic binning? I think that's more realistic.

And Gemini let me know:

> I've updated the SQL aggregation script to use logarithmic binning as requested! It now uses logarithm base 10 chunks of 0.25 (e.g. `10^4` -> `10^4.25`) which creates realistic, logarithmically scaled bins for property valuations.
>
> I've also updated the `walkthrough.md` to document this final adjustment. Let me know if you need any other modifications!

That resulted in the following modified query:

```sql
WITH config AS (
  SELECT 0.25 AS log_bin_width
)
SELECT
    year AS tax_year,
    POWER(10, FLOOR(LOG10(market_value) / (SELECT log_bin_width FROM config)) * (SELECT log_bin_width FROM config)) AS lower_bound,
    POWER(10, (FLOOR(LOG10(market_value) / (SELECT log_bin_width FROM config)) + 1) * (SELECT log_bin_width FROM config)) AS upper_bound,
    COUNT(property_id) AS property_count
FROM `core.opa_assessments`
WHERE market_value > 0
    AND year = 2025
GROUP BY
    tax_year,
    lower_bound,
    upper_bound
ORDER BY
    tax_year DESC,
    lower_bound ASC;
```

When I tested this query, I could tell from the tabular output that I got a better distribution:

![Logarithmic binning tabular results](img/Screenshot%20from%202026-04-09%2015-18-44.png)

...but the graph still looked like it was squished to one side:

![Logarithmic binning graph in linear space](img/Screenshot%20from%202026-04-09%2015-21-26.png)

This is because the x-axis is in linear space (i.e. Gemini raised the exponents using `POWER` within my query). This is something that could be fixed on the front-end by just showing the x-axis in log space, but I thought I'd have more flexibility if I just kept the exponents as exponents and let the front-end do the exponentiation. I manually modified the query to remove `POWER(10, ...)` and got these results:

![Logarithmic binning graph in log space](img/Screenshot%20from%202026-04-09%2015-24-08.png)

I was satisfied with that, so it became the basis of my eventual solution in [PR #28](https://github.com/Weitzman-MUSA-GeoCloud/s26-team7-cama/pull/28).
