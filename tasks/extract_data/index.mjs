import functions from '@google-cloud/functions-framework';
import { Storage } from '@google-cloud/storage';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import csv from 'csv-parser';
import stream from 'stream';

const storage = new Storage();

// Extract function: fetches CSV data from Carto and uploads to the raw GCS bucket.
functions.http('extract_opa_properties', async (req, res) => {
  const BUCKET_NAME = 'musa5090s26-team7-raw_data';
  const url = 'https://phl.carto.com/api/v2/sql?q=SELECT * FROM opa_properties_public&format=csv';

  console.log(`Fetching from ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const bucket = storage.bucket(BUCKET_NAME);
  const file = bucket.file('opa_properties/opa_properties.csv');

  // Convert Web ReadableStream to Node.js Readable stream
  const readResponse = Readable.fromWeb(response.body);
  const writeFile = file.createWriteStream();

  console.log(`Writing to gs://${BUCKET_NAME}/${file.name}`);
  await pipeline(readResponse, writeFile);

  res.send(`Successfully extracted opa_properties to gs://${BUCKET_NAME}/${file.name}`);
});

// Prepare function: downloads raw file, lowercases fields, converts to JSONL, and uploads to prepared bucket.
functions.http('prepare_opa_properties', async (req, res) => {
  const RAW_BUCKET_NAME = 'musa5090s26-team7-raw_data';
  const TABLE_BUCKET_NAME = 'musa5090s26-team7-prepared_data';

  const rawFile = storage.bucket(RAW_BUCKET_NAME).file('opa_properties/opa_properties.csv');
  const tableFile = storage.bucket(TABLE_BUCKET_NAME).file('opa_properties/data.jsonl');

  console.log(`Streaming gs://${RAW_BUCKET_NAME}/${rawFile.name} -> gs://${TABLE_BUCKET_NAME}/${tableFile.name}`);

  // Reader for the raw file
  const readRawFile = rawFile.createReadStream();

  // Parser for the raw file that normalizes the column headers to lowercase
  const parseCsv = csv({
    mapHeaders: ({ header }) => header.toLowerCase().trim()
  });

  // Stream transformer that outputs JSON lines
  const makeJsonl = new stream.Transform({
    objectMode: true,
    transform(chunk, encoding, callback) {
      // chunk is an object with row data.
      callback(null, JSON.stringify(chunk) + '\n');
    }
  });

  // Writer for the external table file; gzips to save space
  const writeTableFile = tableFile.createWriteStream({
    contentType: 'application/jsonl',
    gzip: true,
  });

  await pipeline(
    readRawFile,
    parseCsv,
    makeJsonl,
    writeTableFile
  );

  res.send(`Successfully prepared data at gs://${TABLE_BUCKET_NAME}/${tableFile.name}`);
});
