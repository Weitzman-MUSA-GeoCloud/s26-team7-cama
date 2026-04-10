import functions from '@google-cloud/functions-framework';
import { BigQuery } from '@google-cloud/bigquery';
import { Storage } from '@google-cloud/storage';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

const bigquery = new BigQuery();
const storage = new Storage();

// Use defaults matching the workflow
const BUCKET_NAME = process.env.TEMP_DATA_BUCKET || 'musa5090s26-team7-temp_data';
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'musa5090s26-team7';

/**
 * Creates an async iterable that yields chunked GeoJSON parts.
 */
async function* generateGeoJsonChunks(bqStream) {
  yield '{"type":"FeatureCollection","features":[\n';

  let isFirst = true;
  let buffer = '';

  for await (const row of bqStream) {
    if (!row.geometry) continue;

    let geom;
    try {
      geom = JSON.parse(row.geometry);
    } catch (e) {
      console.warn(`Failed to parse geometry for property ${row.property_id}`);
      continue;
    }

    const properties = { ...row };
    delete properties.geometry;

    const featureString = (isFirst ? '' : ',\n') + JSON.stringify({
      type: 'Feature',
      geometry: geom,
      properties
    });

    buffer += featureString;
    isFirst = false;

    // Yield ~1MB chunks to avoid stream overhead
    if (buffer.length >= 1024 * 1024) {
      yield buffer;
      buffer = '';
    }
  }

  if (buffer.length > 0) {
    yield buffer;
  }

  yield '\n]}';
}

functions.http('export_geojson', async (req, res) => {
  try {
    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file('property_tile_info.geojson');

    const writeStream = file.createWriteStream({
      contentType: 'application/geo+json',
      // We explicitly DO NOT gzip in this step because ogr2ogr will stream this out.
      // If we gzip, gcloud cp command correctly decompresses during download, but we
      // leave it uncompressed here to ensure direct GeoJSON streaming is as specified.
    });

    const query = `
      WITH recent_assessments AS (
        SELECT
          property_id,
          year,
          market_value,
          ROW_NUMBER() OVER (PARTITION BY property_id ORDER BY year DESC) as rn
        FROM \`${PROJECT_ID}.core.opa_assessments\`
      ),
      pivoted_assessments AS (
        SELECT
          property_id,
          MAX(CASE WHEN rn = 1 THEN market_value END) AS latest_market_value,
          MAX(CASE WHEN rn = 1 THEN year END) AS latest_market_value_year,
          MAX(CASE WHEN rn = 2 THEN market_value END) AS market_value_1_yr_ago,
          MAX(CASE WHEN rn = 3 THEN market_value END) AS market_value_2_yrs_ago
        FROM recent_assessments
        WHERE rn <= 3
        GROUP BY property_id
      )
      SELECT
        ST_ASGEOJSON(p.geometry) AS geometry,
        p.property_id,
        op.category_code_description,
        op.year_built,
        op.zoning,
        a.latest_market_value,
        a.latest_market_value_year,
        a.market_value_1_yr_ago,
        a.market_value_2_yrs_ago,
        ca.current_assessed_value AS predicted_market_value
      FROM \`${PROJECT_ID}.core.pwd_parcels\` p
      JOIN \`${PROJECT_ID}.derived.opa_residential_properties\` op ON p.property_id = op.property_id
      LEFT JOIN pivoted_assessments a ON p.property_id = a.property_id
      LEFT JOIN \`${PROJECT_ID}.derived.current_assessments\` ca ON p.property_id = ca.property_id
      WHERE p.geometry IS NOT NULL
    `;

    console.log('Querying BigQuery...');
    const bqStream = bigquery.createQueryStream({ query });

    const chunkItr = generateGeoJsonChunks(bqStream);

    console.log(`Writing to gs://${BUCKET_NAME}/${file.name}`);
    await pipeline(Readable.from(chunkItr), writeStream);

    console.log('Export completed successfully.');
    res.status(200).send('Successfully exported GeoJSON to GCS.');
  } catch (error) {
    console.error('Error exporting GeoJSON:', error);
    res.status(500).send('Error exporting GeoJSON: ' + error.message);
  }
});
