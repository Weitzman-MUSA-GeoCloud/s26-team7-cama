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

  try {
    console.log(`Fetching from ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file('opa_properties/opa_properties.csv');

    // Convert Web ReadableStream to Node.js Readable stream
    const nodeStream = Readable.fromWeb(response.body);

    console.log(`Writing to gs://${BUCKET_NAME}/${file.name}`);
    await pipeline(nodeStream, file.createWriteStream({
      resumable: false, // For streams < 10MB it is better, but this could be large, so we just use default or non-resumable for simple streaming
    }));

    res.send(`Successfully extracted opa_properties to gs://${BUCKET_NAME}/${file.name}`);
  } catch (error) {
    console.error(error);
    res.status(500).send(error.toString());
  }
});

// Prepare function: downloads raw file, lowercases fields, converts to JSONL, and uploads to prepared bucket.
functions.http('prepare_opa_properties', async (req, res) => {
  const RAW_BUCKET_NAME = 'musa5090s26-team7-raw_data';
  const PREP_BUCKET_NAME = 'musa5090s26-team7-prepared_data';

  const rawFile = storage.bucket(RAW_BUCKET_NAME).file('opa_properties/opa_properties.csv');
  const prepFile = storage.bucket(PREP_BUCKET_NAME).file('opa_properties/data.jsonl');

  try {
    console.log(`Streaming gs://${RAW_BUCKET_NAME}/${rawFile.name} -> gs://${PREP_BUCKET_NAME}/${prepFile.name}`);

    // Create a transform stream that maps headers to lowercase and outputs JSON lines
    const toJsonl = new stream.Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        // csv-parser handles header mapping using mapHeaders option below.
        // chunk is an object with row data.
        callback(null, JSON.stringify(chunk) + '\\n');
      }
    });

    await pipeline(
      rawFile.createReadStream(),
      csv({
        mapHeaders: ({ header }) => header.toLowerCase().trim()
      }),
      toJsonl,
      prepFile.createWriteStream({
        contentType: 'application/jsonl',
        resumable: false
      })
    );

    res.send(`Successfully prepared data at gs://${PREP_BUCKET_NAME}/${prepFile.name}`);
  } catch (error) {
    console.error(error);
    res.status(500).send(error.toString());
  }
});
