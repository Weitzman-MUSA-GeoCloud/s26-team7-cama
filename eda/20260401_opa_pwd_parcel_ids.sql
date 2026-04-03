-- I'm going to use DuckDB to explore the PWD and OPA CSV files. Even though
-- I don't want to use the PWD CSV (because it doesn't have polygons in it)
-- it should be good enough for exploration. And it's easy.
--
-- This code assumes you've downloaded the PWD and OPA CSV files to
-- ../scratch/PWD_PARCELS.csv and ../scratch/opa_properties_public.csv.

CREATE OR REPLACE TABLE pwd AS (
    SELECT
        *
    FROM read_csv('../scratch/PWD_PARCELS.csv')
);

CREATE OR REPLACE TABLE opa AS (
    SELECT
        *
    FROM read_csv('../scratch/opa_properties_public.csv')
);

-- The property ID (opa.parcel_number or pwd.brt_id) should be a consistent
-- length: 9 characters. Let's check.

SELECT
    len(parcel_number),
    count(*)
FROM opa
GROUP BY 1;  -- all 583557 records have 9 characters

SELECT
    len(brt_id),
    count(*)
FROM pwd
GROUP BY 1;  -- 1406 nulls, 545834 9-character ids, 11 10-character ids, 1 8-character id

-- There are a few PWD parcels that have longer or shorter IDs. Let's take
-- a look at them (along with the parcel_id and tencode, just to see whether
-- there's any correlation between them).

SELECT
    brt_id,
    tencode,
    parcel_id,
    address
FROM pwd
WHERE len(brt_id) IN (8, 10);

-- No correlation with parcel_id or tencode.
--
-- Let's take one of these addresses and look it up in the OPA data.

SELECT parcel_number FROM opa
WHERE
    street_name = 'OAK'
    AND house_number = '1260';

-- That looks the same as what we got in the PWD table. I thought all of
-- these in the OPA table were 9 characters. Ah! But it is 9 characters.
-- Then why did it come up in my query for 10 characters in the PWD table.
--
-- I think I have the answer:

SELECT
    concat('"', brt_id, '"'),
    tencode,
    parcel_id,
    address
FROM pwd
WHERE len(brt_id) IN (8, 10);

-- So I should trim the brt_id to get a value I can join on. What about the
-- 8-character ID address?

SELECT parcel_number FROM opa  -- expecting "24307281"
WHERE
    street_name = 'SHEDWICK'
    AND house_number = '714';

-- :-o ... There's a missing trailing 0. OMG. Maybe I can join where the
-- brt_id starts with the parcel_number?

SELECT parcel_number FROM opa
WHERE parcel_number LIKE '24307281%';

-- Turns out that works, but I am worried about parcel_numbers that don't
-- end in 0 (e.g. what if we had '243072810' and '243072819').

SELECT right(parcel_number, 1), count(*) FROM opa
GROUP BY 1;

-- Indeed, most end in 0, but not all end in 0, by a long shot. I say trim
-- the brt_id, and pad it to a 9-character string with 0 on the right.
-- Document why in the query.

CREATE OR REPLACE TABLE pwd AS (
    SELECT
        * REPLACE (rpad(trim(brt_id), 9, '0') AS brt_id)
    FROM read_csv('../scratch/PWD_PARCELS.csv')
);

SELECT
    len(brt_id),
    count(*)
FROM pwd
GROUP BY 1;

-- Great. Now what about the null values?

SELECT
    brt_id,
    address
FROM pwd
WHERE brt_id IS NULL;

-- Let's take one of these addresses and check whether it's in the OPA
-- data; after all, could be that the OPA just isn't tracking this parcel
-- for some reason.

SELECT parcel_number FROM opa
WHERE
    street_name = 'FAIRMOUNT'
    AND house_number = '1026'; -- Gives parcel_number=141330420

-- Is this brt_id in the PWD data?

SELECT address
FROM pwd
WHERE brt_id = '141330420';

-- Nope. How frustrating. I bet we could do some additional matching by
-- parsing the address, but address parsing isn't for the faint of heart.
-- Let's try something like this to start.

WITH pwd_decomposed_addresses AS (
    SELECT *, split(address, ' ') AS sadd
    FROM pwd
),

SELECT
    brt_id,
    address,
    sadd[1] AS house_number,
    CASE
        WHEN sadd[2] IN ('N', 'S', 'E', 'W') THEN sadd[3]
        ELSE sadd[2]
    END AS street_name,
    CASE
        WHEN sadd[2] IN ('N', 'S', 'E', 'W') THEN sadd[2]
        ELSE NULL
    END AS street_direction
FROM pwd_decomposed_addresses
WHERE brt_id IS NULL;

-- That's a place to start, but ultimately I'm going to have to consider
-- whether it's worth the effort to try and match these up. It really
-- depends on my use case, and the specifics of these properties. I'm
-- guessing that it's not worth it, but I'm going to have to do some more
-- research before I make a decision.
