CREATE OR REPLACE TABLE `{{ project_id }}.derived.opa_residential_properties`
AS (
    SELECT *
    FROM `{{ project_id }}.core.opa_properties`
    WHERE zoning LIKE 'R%'
);
