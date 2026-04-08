CREATE OR REPLACE TABLE `{{ project_id }}.core.pwd_parcels` AS (
    SELECT
        brt_id AS property_id,
        * REPLACE (ST_GEOGFROMGEOJSON(geometry) AS geometry)
    FROM `{{ project_id }}.{{ dataset_name }}.pwd_parcels`
);
