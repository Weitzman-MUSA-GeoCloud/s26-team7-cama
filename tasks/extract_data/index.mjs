import functions from '@google-cloud/functions-framework';
import { Storage } from '@google-cloud/storage';
import { extractToGCS } from './extract-utils.mjs';
import { prepareToGCS } from './prepare-utils.mjs';

const storage = new Storage();

// Extract function: fetches CSV data from Carto and uploads to the raw GCS bucket.
functions.http('extract_opa_properties', async (req, res) => {
  const url = 'https://phl.carto.com/api/v2/sql?q=SELECT * FROM opa_properties_public&format=csv';
  const msg = await extractToGCS(url, storage, 'musa5090s26-team7-raw_data', 'opa_properties/opa_properties.csv');
  res.send(msg);
});

// Prepare function: downloads raw file, lowercases fields, converts to JSONL, and uploads to prepared bucket.
functions.http('prepare_opa_properties', async (req, res) => {
  const msg = await prepareToGCS(
    storage,
    'musa5090s26-team7-raw_data',
    'musa5090s26-team7-prepared_data',
    'opa_properties/opa_properties.csv',
    'opa_properties/data.jsonl'
  );
  res.send(msg);
});

// Extract function: fetches CSV data from S3 and uploads to the raw GCS bucket.
functions.http('extract_opa_assessments', async (req, res) => {
  const url = 'https://opendata-downloads.s3.amazonaws.com/assessments.csv';
  const msg = await extractToGCS(url, storage, 'musa5090s26-team7-raw_data', 'opa_assessments/opa_assessments.csv');
  res.send(msg);
});

// Prepare function: downloads raw file, lowercases fields, converts to JSONL, and uploads to prepared bucket.
functions.http('prepare_opa_assessments', async (req, res) => {
  const msg = await prepareToGCS(
    storage,
    'musa5090s26-team7-raw_data',
    'musa5090s26-team7-prepared_data',
    'opa_assessments/opa_assessments.csv',
    'opa_assessments/data.jsonl'
  );
  res.send(msg);
});

// Extract function: fetches GeoJSON data for PWD parcels and uploads to the raw GCS bucket.
functions.http('extract_pwd_parcels', async (req, res) => {
  const url = 'https://hub.arcgis.com/api/v3/datasets/84baed491de44f539889f2af178ad85c_0/downloads/data?format=geojson&spatialRefId=4326&where=1%3D1';
  const msg = await extractToGCS(url, storage, 'musa5090s26-team7-raw_data', 'pwd_parcels/data.geojson');
  res.send(msg);
});

// Prepare function: downloads raw file, extracts GeoJSON features, and uploads JSON-L to prepared bucket.
functions.http('prepare_pwd_parcels', async (req, res) => {
  const msg = await prepareToGCS(
    storage,
    'musa5090s26-team7-raw_data',
    'musa5090s26-team7-prepared_data',
    'pwd_parcels/data.geojson',
    'pwd_parcels/data.jsonl'
  );
  res.send(msg);
});
