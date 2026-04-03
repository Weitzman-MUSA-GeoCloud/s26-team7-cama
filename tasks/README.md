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