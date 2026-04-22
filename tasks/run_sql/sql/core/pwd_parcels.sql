CREATE OR REPLACE TABLE `{{ project_id }}.core.pwd_parcels`
AS (
    SELECT
        -- The BRT ID is stored as an integer, but we want to normalize it to a 9-digit
        -- string with leading zeros to match the OPA property_number format.
        LPAD(CAST(brt_id AS STRING), 9, '0') AS property_id,
        * REPLACE (ST_GEOGFROMGEOJSON(geometry) AS geometry)
    FROM `{{ project_id }}.{{ dataset_name }}.pwd_parcels`
);
