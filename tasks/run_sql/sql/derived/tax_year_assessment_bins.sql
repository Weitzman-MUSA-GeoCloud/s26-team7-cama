CREATE OR REPLACE TABLE `{{ project_id }}.derived.tax_year_assessment_bins` AS
WITH bin_size AS (
  SELECT 50000 AS width
)
SELECT
    year AS tax_year,
    FLOOR(market_value / (SELECT width FROM bin_size)) * (SELECT width FROM bin_size) AS lower_bound,
    FLOOR(market_value / (SELECT width FROM bin_size)) * (SELECT width FROM bin_size) + (SELECT width FROM bin_size) AS upper_bound,
    COUNT(property_id) AS property_count
FROM `{{ project_id }}.core.opa_assessments`
WHERE market_value IS NOT NULL
GROUP BY
    tax_year,
    lower_bound,
    upper_bound
ORDER BY
    tax_year DESC,
    lower_bound ASC;
