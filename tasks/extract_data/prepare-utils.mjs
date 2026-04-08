import csv from 'csv-parser';
import stream from 'stream';
import { pipeline } from 'stream/promises';
import { Storage } from '@google-cloud/storage';
import JSONStream from 'JSONStream';

/**
 * Streams a raw compressed CSV from Google Cloud Storage, normalizes column
 * headers to lowercase, converts the rows to JSONL, and streams the output
 * back to another Google Cloud Storage bucket, compressed with gzip.
 *
 * @param {Storage} storage - An initialized Google Cloud Storage client.
 * @param {string} rawBucketName - The name of the bucket containing the raw CSV file.
 * @param {string} tableBucketName - The name of the bucket to write the prepared JSONL file to.
 * @param {string} sourceFile - The path to the source CSV file in the raw bucket.
 * @param {string} destFile - The path to the destination JSONL file in the prepared bucket.
 * @returns {Promise<string>} A success message indicating the completion.
 */
export async function prepareToGCS(storage, rawBucketName, tableBucketName, sourceFile, destFile) {
  const rawFile = storage.bucket(rawBucketName).file(sourceFile);
  const tableFile = storage.bucket(tableBucketName).file(destFile);

  console.log(`Streaming gs://${rawBucketName}/${rawFile.name} -> gs://${tableBucketName}/${tableFile.name}`);

  const [metadata] = await rawFile.getMetadata();
  const contentType = metadata.contentType;

  // Reader for the raw file; decompress because we gzipped in the extract function
  const readRawFile = rawFile.createReadStream({
    decompress: true,
  });

  // Writer for the external table file; gzips to save space
  const writeTableFile = tableFile.createWriteStream({
    contentType: 'application/jsonl',
    gzip: true,
  });

  if (contentType === 'application/geo+json') {
    const parseGeoJson = JSONStream.parse('features.*');

    const makeJsonl = new stream.Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        const record = {};
        if (chunk.properties) {
          for (const [k, v] of Object.entries(chunk.properties)) {
            record[k.toLowerCase()] = v;
          }
        }
        if (chunk.geometry) {
          record['geometry'] = JSON.stringify(chunk.geometry);
        }
        callback(null, JSON.stringify(record) + '\n');
      }
    });

    await pipeline(readRawFile, parseGeoJson, makeJsonl, writeTableFile);

  } else if (contentType === 'text/csv') {
    // Parser for the raw file that normalizes the column headers to lowercase
    const parseCsv = csv({
      mapHeaders: ({ header }) => header.toLowerCase().trim(),
    });

    // Stream transformer that outputs JSON lines
    const makeJsonl = new stream.Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        // chunk is an object with row data.
        callback(null, JSON.stringify(chunk) + '\n');
      },
    });

    await pipeline(readRawFile, parseCsv, makeJsonl, writeTableFile);
  } else {
    throw new Error(`Unsupported content type on source file "${sourceFile}": "${contentType}"`);
  }

  console.log(`Successfully prepared data at gs://${tableBucketName}/${tableFile.name}`);
  return `Successfully prepared data at gs://${tableBucketName}/${tableFile.name}`;
}
