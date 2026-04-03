CREATE OR REPLACE EXTERNAL TABLE \`{{dataset_name}}.opa_properties\`
OPTIONS(
  format = "JSON",
  uris = ["gs://{{bucket_name}}/opa_properties/data.jsonl"]
);
