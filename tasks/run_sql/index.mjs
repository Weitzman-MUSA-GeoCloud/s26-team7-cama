import dotenv from 'dotenv';
import findConfig from 'find-config';
dotenv.config({ path: findConfig('.env') });

import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

import functions from '@google-cloud/functions-framework';
import { BigQuery } from '@google-cloud/bigquery';
import Mustache from 'mustache';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQL_DIR_NAME = path.join(__dirname, 'sql');


functions.http('run_sql', async (req, res) => {
  // Read SQL file specified in the request query args (e.g. ?sql=source/opa_properties.sql)
  // or as JSON in the request body (e.g. '{ "sql": "source/opa_properties.sql" }')
  const sqlParam = req.query['sql'] || req.body['sql'];
  if (!sqlParam) {
    res.status(400).send('Missing sql parameter');
    return;
  }

  const sqlPath = path.join(SQL_DIR_NAME, sqlParam);

  // Check that the file exists
  try {
    await fs.access(sqlPath);
  } catch (err) {
    res.status(404).send(`SQL file ${sqlPath} not found: ${err}`);
    return;
  }

  // Read the SQL file
  const sqlQueryTemplate = await fs.readFile(sqlPath, 'utf8');

  // Setup the context for template rendering
  const context = {
    "bucket_name": process.env.DATA_LAKE_BUCKET || 'musa5090s26-team7-prepared_data',
    "project_id": process.env.DATA_LAKE_PROJECT_ID || 'musa5090s26-team7',
    "dataset_name": process.env.DATA_LAKE_DATASET || 'source',
    "location": process.env.DATA_LAKE_LOCATION || 'us-east4',
  };

  const sqlQuery = Mustache.render(sqlQueryTemplate, context);

  // Run the query
  console.log(`Running the SQL file ${sqlPath}`);
  console.log(sqlQuery);
  const bigqueryClient = new BigQuery();
  await bigqueryClient.query({
    query: sqlQuery,
    location: context.location,
  });
  console.log(`Ran the SQL file ${sqlPath}`);
  res.send(`Ran the SQL file ${sqlPath}`);
});
