import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import path from 'path';

/**
 * Fetches data from a given URL and streams the content directly to a file
 * in a Google Cloud Storage bucket, compressing it with gzip.
 *
 * @param {string} url - The URL to fetch the file contents from.
 * @param {Storage} storage - An initialized Google Cloud Storage client.
 * @param {string} bucketName - The name of the raw GCS bucket.
 * @param {string} fileDest - The destination path for the saved file inside the bucket.
 * @returns {Promise<string>} A success message indicating the completion.
 */
export async function extractToGCS(url, storage, bucketName, fileDest) {
  console.log(`Fetching from ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const bucket = storage.bucket(bucketName);
  const file = bucket.file(fileDest);

  // Convert Web ReadableStream to Node.js Readable stream
  const readResponse = Readable.fromWeb(response.body);

  const extMap = {
    '.geojson': 'application/geo+json',
    '.csv': 'text/csv',
  };
  const ext = path.extname(fileDest).toLowerCase();
  const contentType = extMap[ext];

  if (!contentType) {
    throw new Error(`Unsupported file extension: "${ext}"; expected one of "${Object.keys(extMap).join('", "')}"`);
  }

  const writeFile = file.createWriteStream({
    contentType: contentType,
    gzip: true,
  });

  console.log(`Writing to gs://${bucketName}/${file.name}`);
  await pipeline(readResponse, writeFile);

  console.log(`Successfully extracted to gs://${bucketName}/${file.name}`);
  return `Successfully extracted to gs://${bucketName}/${file.name}`;
}
