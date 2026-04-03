## Folder Structure

extract_data/
    index.mjs
    package.json
run_sql/
    sql/
    source/
        opa_properties.sql
    core/
        opa_properties.sql
    index.mjs
    package.json

Rather than having a proliferation of different folders for the extract/prepare processes, all of those functions are defined within the `extract_data/` folder, and then deployed as individual Cloud Functions (essentially, all the extract/prepare Cloud Functions have the same code base, but use different entrypoints). This wa

## Testing Locally

Since these functions interact with Google Cloud Storage and BigQuery, you'll first need to make sure your local environment is authenticated with Google Cloud:

```bash
gcloud auth application-default login
```

### 1. Testing `extract_data` Functions

Navigate to the extract_data folder and install the dependencies:

```bash
cd tasks/extract_data
npm install
```

Start the **extract** function on port 8080:

```bash
npx @google-cloud/functions-framework --target=extract_opa_properties --port=8080
```

In a separate terminal, trigger it:

```bash
curl -X POST http://localhost:8080
```

To test the **prepare** function, just change the target:

```bash
npx @google-cloud/functions-framework --target=prepare_opa_properties --port=8080
```

And trigger it similarly with `curl`.

### 2. Testing the `run_sql` Function

Navigate to the `run_sql` directory and install dependencies:

```bash
cd tasks/run_sql
npm install
```

This function looks for environment variables for the target dataset and bucket (falling back to our project defaults) through `dotenv`. You can create a `.env` file in the `run_sql` directory if you prefer to test with custom dataset names.

Start it up:

```bash
npx @google-cloud/functions-framework --target=run_sql --port=8080
```

Since this function requires a `sql` payload, you can trigger it locally by passing the query argument via POST or GET:

```bash
# Test the source SQL execution
curl -X POST -H "Content-Type: application/json" -d '{"sql": "source/opa_properties.sql"}' http://localhost:8080

# Test the core SQL execution
curl -X POST -H "Content-Type: application/json" -d '{"sql": "core/opa_properties.sql"}' http://localhost:8080
```

## Deployment

To deploy the Cloud Functions and Workflow, use the following commands:

```bash
# Deploy the Cloud Functions
gcloud functions deploy extract-opa-properties \
  --gen2 --runtime=nodejs20 --region=us-east1 \
  --source=tasks/extract_data \
  --entry-point=extract_opa_properties \
  --trigger-http \
  --timeout=540s

gcloud functions deploy prepare-opa-properties \
  --gen2 --runtime=nodejs20 --region=us-east1 \
  --source=tasks/extract_data \
  --entry-point=prepare_opa_properties \
  --trigger-http \
  --timeout=540s

gcloud functions deploy run-sql \
  --gen2 --runtime=nodejs20 --region=us-east1 \
  --source=tasks/run_sql \
  --entry-point=run_sql \
  --trigger-http

# Deploy the Workflow
gcloud workflows deploy data-pipeline \
  --source=tasks/data_pipeline/workflow.yaml \
  --location=us-east1

# Trigger the Workflow
gcloud workflows run data-pipeline --location=us-east1
```