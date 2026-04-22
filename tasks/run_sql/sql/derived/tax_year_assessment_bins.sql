CREATE OR REPLACE TABLE FUNCTION `{{ project_id }}.derived.tax_year_assessment_bins` (
    tax_years ARRAY<INT64>,
    envelope GEOGRAPHY
) AS (
    WITH

    config AS (
        SELECT
            -- Defines the width of the bins on a log10 scale
            0.1 AS log_bin_width,

            -- If no tax years are provided, use all distinct tax years from the assessments table;
            -- Supress the lint error that expects tax_years to be in the FROM clause
            COALESCE(tax_years, (SELECT ARRAY_AGG(DISTINCT YEAR) FROM `{{ project_id }}.core.opa_assessments`)) AS tax_years -- noqa: RF01
    ),

    -- Filter to only include properties that intersect with the envelope, if provided
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
        assessment.market_value > 0  -- Log of 0 is undefined
        AND assessment.year IN UNNEST(config.tax_years)
    GROUP BY
        -- Supress the lint errors that expects tax_year, lower_bound_exp, and upper_bound_exp to be in the FROM clause
        tax_year, -- noqa: RF01
        lower_bound_exp, -- noqa: RF01
        upper_bound_exp -- noqa: RF01
    ORDER BY
        tax_year DESC, -- noqa: RF01
        lower_bound_exp ASC -- noqa: RF01
);
