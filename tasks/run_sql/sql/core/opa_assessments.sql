CREATE OR REPLACE TABLE `{{ project_id }}.core.opa_assessments`
CLUSTER BY year
AS (
    SELECT
        parcel_number AS property_id,
        * REPLACE (
            CASE WHEN year = '' THEN NULL ELSE CAST(year AS INT64) END AS year,
            CASE WHEN market_value = '' THEN NULL ELSE CAST(market_value AS NUMERIC) END AS market_value,
            CASE WHEN taxable_land = '' THEN NULL ELSE CAST(taxable_land AS NUMERIC) END AS taxable_land,
            CASE WHEN taxable_building = '' THEN NULL ELSE CAST(taxable_building AS NUMERIC) END AS taxable_building,
            CASE WHEN exempt_land = '' THEN NULL ELSE CAST(exempt_land AS NUMERIC) END AS exempt_land,
            CASE WHEN exempt_building = '' THEN NULL ELSE CAST(exempt_building AS NUMERIC) END AS exempt_building,
            CASE WHEN objectid = '' THEN NULL ELSE CAST(objectid AS INT64) END AS objectid
        )
    FROM `{{ project_id }}.{{ dataset_name }}.opa_assessments`
);
