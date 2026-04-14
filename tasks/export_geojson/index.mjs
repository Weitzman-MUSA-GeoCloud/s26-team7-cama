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
      console.warn(`Failed to parse geometry for property ${row.property_id}: ${e}`);
      continue;
    }

    const properties = { ...row };
    delete properties.geometry;

    const featureString = (isFirst ? '' : ',\n') + JSON.stringify({
      type: 'Feature',
      geometry: geom,
      properties,
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
      gzip: true,
    });

    const query = `
      SELECT *
      FROM \`${PROJECT_ID}.derived.property_tile_info\`
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
