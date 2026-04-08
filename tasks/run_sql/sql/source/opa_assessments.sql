CREATE OR REPLACE EXTERNAL TABLE `{{ project_id }}.{{ dataset_name }}.opa_assessments`
(
    `parcel_number` STRING,
    `year` STRING,
    `market_value` STRING,
    `taxable_land` STRING,
    `taxable_building` STRING,
    `exempt_land` STRING,
    `exempt_building` STRING,
    `objectid` STRING
)
OPTIONS (
    format = "JSON",
    ignore_unknown_values = TRUE,
    uris = ["gs://{{ bucket_name }}/opa_assessments/data.jsonl"]
);
