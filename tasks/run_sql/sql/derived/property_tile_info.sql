CREATE OR REPLACE VIEW `{{ project_id }}.derived.property_tile_info` AS (
  WITH recent_assessments AS (
    SELECT
      property_id,
      year,
      market_value,
      ROW_NUMBER() OVER (PARTITION BY property_id ORDER BY year DESC) as rn
    FROM `{{ project_id }}.core.opa_assessments`
  ),
  pivoted_assessments AS (
    SELECT
      property_id,
      market_value AS tax_year_assessed_value,
      year AS tax_year
    FROM recent_assessments
    WHERE rn = 1
  )
  SELECT
    ST_ASGEOJSON(p.geometry) AS geometry,
    p.property_id,
    op.category_code_description,
    op.year_built,
    op.zoning,
    a.tax_year_assessed_value,
    a.tax_year,
    -- ca.current_assessed_value
  FROM `{{ project_id }}.core.pwd_parcels` p
  JOIN `{{ project_id }}.derived.opa_residential_properties` op ON p.property_id = op.property_id
  LEFT JOIN pivoted_assessments a ON p.property_id = a.property_id
  -- LEFT JOIN `{{ project_id }}.derived.current_assessments` ca ON p.property_id = ca.property_id
  WHERE p.geometry IS NOT NULL
);
