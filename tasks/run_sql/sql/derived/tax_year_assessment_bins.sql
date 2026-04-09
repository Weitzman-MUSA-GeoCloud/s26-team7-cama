CREATE OR REPLACE TABLE FUNCTION `{{ project_id }}.derived.tax_year_assessment_bins`(
    tax_years ARRAY<INT64>,
    envelope GEOGRAPHY
) AS (
    WITH config AS (
        -- Defines the width of the bin on a log10 scale
        SELECT 0.15 AS log_bin_width
    ),

    properties AS (
        SELECT property_id
        FROM `{{ project_id }}.core.opa_properties`
        WHERE
            envelope IS NULL
            OR ST_INTERSECTS(the_geom, envelope)
    )

    SELECT
        assessment.year AS tax_year,
        ROUND(FLOOR(LOG10(assessment.market_value) / config.log_bin_width) * config.log_bin_width, 2) AS lower_bound_exp,
        ROUND((FLOOR(LOG10(assessment.market_value) / config.log_bin_width) + 1) * config.log_bin_width, 2) AS upper_bound_exp,
        COUNT(assessment.property_id) AS property_count
    FROM `{{ project_id }}.core.opa_assessments` AS assessment
    INNER JOIN properties USING (property_id)
    CROSS JOIN config
    WHERE
        assessment.market_value > 0
        AND (
            tax_years IS NULL
            OR ARRAY_LENGTH(tax_years) = 0
            OR assessment.year IN UNNEST(tax_years)
        )
    GROUP BY
        tax_year,
        lower_bound_exp,
        upper_bound_exp
    ORDER BY
        tax_year DESC,
        lower_bound_exp ASC
);