import dotenv from 'dotenv';
import findConfig from 'find-config';
dotenv.config({ path: findConfig('.env') });

import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

import functions from '@google-cloud/functions-framework';
import { BigQuery } from '@google-cloud/bigquery';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQL_DIR_NAME = path.join(__dirname, 'sql');


functions.http('run_sql', async (req, res) => {
  // Read SQL file specified in the request query args (e.g. ?sql=source/opa_properties.sql)
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
    bucket_name: process.env.DATA_LAKE_BUCKET || 'musa5090s26-team7-prepared_data',
    dataset_name: process.env.DATA_LAKE_DATASET || 'source',
  };

  const sqlQuery = renderTemplate(sqlQueryTemplate, context);

  // Run the query
  const bigqueryClient = new BigQuery();
  try {
      await bigqueryClient.query({
          query: sqlQuery
      });
      console.log(`Ran the SQL file ${sqlPath}`);
      res.send(`Ran the SQL file ${sqlPath}`);
  } catch (err) {
      console.error(err);
      res.status(500).send(`Failed to run SQL: ${err.message}`);
  }
});


function renderTemplate(sqlQueryTemplate, context) {
  const cleanTemplate = sqlQueryTemplate.replace(/`/g, '\\`');
  return eval(`
    (function() {
      ${Object.entries(context).map(
        ([key, value]) => `const ${key} = '${value}';`
      ).join('\\n')}
      return \`${cleanTemplate}\`;
    })()`
  );
}
