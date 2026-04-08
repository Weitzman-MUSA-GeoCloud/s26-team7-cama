CREATE OR REPLACE EXTERNAL TABLE `{{ project_id }}.{{ dataset_name }}.pwd_parcels`
OPTIONS (
    format = 'JSON',
    uris = ['gs://musa5090s26-team7-prepared_data/pwd_parcels/data.jsonl']
);
