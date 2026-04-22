CREATE OR REPLACE TABLE `{{ project_id }}.core.opa_properties`
AS (
    SELECT
        parcel_number AS property_id,

        -- We can use the category code information from the metadata catalog entry linked from
        -- https://opendataphilly.org/datasets/philadelphia-properties-and-assessment-history/
        CASE
            WHEN category_code = '1' THEN 'Residential'
            WHEN category_code = '2' THEN 'Hotels and Apartments'
            WHEN category_code = '3' THEN 'Store with Dwelling'
            WHEN category_code = '4' THEN 'Commercial'
            WHEN category_code = '5' THEN 'Industrial'
            WHEN category_code = '6' THEN 'Vacant Land'
            WHEN category_code = '' THEN NULL
            -- Preserve unexpected values for debugging
            ELSE CONCAT('Unknown Category Code "', category_code, '"')
        END AS category,

        * REPLACE (
            CASE WHEN the_geom = '' THEN NULL ELSE ST_GEOGFROMWKB(the_geom) END AS the_geom,

            -- Dates are in the format "2024-05-31 01:05:37+00"
            CASE WHEN assessment_date = '' THEN NULL ELSE PARSE_DATETIME('%Y-%m-%d %H:%M:%S+00', assessment_date) END AS assessment_date,
            CASE WHEN date_exterior_condition = '' THEN NULL ELSE PARSE_DATETIME('%Y-%m-%d %H:%M:%S+00', date_exterior_condition) END AS date_exterior_condition,
            CASE WHEN market_value_date = '' THEN NULL ELSE PARSE_DATETIME('%Y-%m-%d %H:%M:%S+00', market_value_date) END AS market_value_date,
            CASE WHEN recording_date = '' THEN NULL ELSE PARSE_DATETIME('%Y-%m-%d %H:%M:%S+00', recording_date) END AS recording_date,
            CASE WHEN sale_date = '' THEN NULL ELSE PARSE_DATETIME('%Y-%m-%d %H:%M:%S+00', sale_date) END AS sale_date,

            CASE WHEN year_built = '' THEN NULL ELSE CAST(year_built AS INT64) END AS year_built,
            CASE WHEN exterior_condition = '' THEN NULL ELSE CAST(exterior_condition AS INT64) END AS exterior_condition,
            CASE WHEN market_value = '' THEN NULL ELSE CAST(market_value AS NUMERIC) END AS market_value,
            CASE WHEN sale_price = '' THEN NULL ELSE CAST(sale_price AS NUMERIC) END AS sale_price,
            CASE WHEN taxable_building = '' THEN NULL ELSE CAST(taxable_building AS NUMERIC) END AS taxable_building,
            CASE WHEN taxable_land = '' THEN NULL ELSE CAST(taxable_land AS NUMERIC) END AS taxable_land,
            CASE WHEN number_of_bathrooms = '' THEN NULL ELSE CAST(number_of_bathrooms AS NUMERIC) END AS number_of_bathrooms,
            CASE WHEN number_of_bedrooms = '' THEN NULL ELSE CAST(number_of_bedrooms AS NUMERIC) END AS number_of_bedrooms,
            CASE WHEN number_of_rooms = '' THEN NULL ELSE CAST(number_of_rooms AS NUMERIC) END AS number_of_rooms,
            CASE WHEN number_stories = '' THEN NULL ELSE CAST(number_stories AS NUMERIC) END AS number_stories,
            CASE WHEN garage_spaces = '' THEN NULL ELSE CAST(garage_spaces AS NUMERIC) END AS garage_spaces,
            CASE WHEN fireplaces = '' THEN NULL ELSE CAST(fireplaces AS NUMERIC) END AS fireplaces,
            CASE WHEN frontage = '' THEN NULL ELSE CAST(frontage AS NUMERIC) END AS frontage,
            CASE WHEN depth = '' THEN NULL ELSE CAST(depth AS NUMERIC) END AS depth,
            CASE WHEN total_area = '' THEN NULL ELSE CAST(total_area AS NUMERIC) END AS total_area,
            CASE WHEN total_livable_area = '' THEN NULL ELSE CAST(total_livable_area AS NUMERIC) END AS total_livable_area
        )
    FROM `{{ project_id }}.{{ dataset_name }}.opa_properties`
);
