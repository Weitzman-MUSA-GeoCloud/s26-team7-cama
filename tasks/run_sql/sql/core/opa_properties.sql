CREATE OR REPLACE TABLE `{{project_id}}.core.opa_properties`
AS (
    SELECT
        parcel_number AS property_id,
        *
    FROM `{{project_id}}.{{dataset_name}}.opa_properties`
);
