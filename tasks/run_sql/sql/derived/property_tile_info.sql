CREATE OR REPLACE VIEW `{{ project_id }}.derived.property_tile_info` AS (
  WITH recent_assessments AS (
    SELECT
      property_id,
      year,
      market_value,
      ROW_NUMBER() OVER (PARTITION BY property_id ORDER BY year DESC) as rn
    FROM `{{ project_id }}.core.opa_assessments`
  )
  SELECT
    ST_ASGEOJSON(parcel.geometry) AS geometry,
    parcel.property_id,
    property.category_code_description,
    property.year_built,
    property.zoning,
    assessment.market_value AS tax_year_assessed_value,
    assessment.year AS tax_year,
    -- prediction.current_assessed_value
  FROM `{{ project_id }}.core.pwd_parcels` parcel
  JOIN `{{ project_id }}.derived.opa_residential_properties` property ON parcel.property_id = property.property_id
  LEFT JOIN recent_assessments assessment ON parcel.property_id = assessment.property_id
  -- LEFT JOIN `{{ project_id }}.derived.current_assessments` prediction ON parcel.property_id = prediction.property_id
  WHERE parcel.geometry IS NOT NULL
    AND assessment.rn = 1
);
