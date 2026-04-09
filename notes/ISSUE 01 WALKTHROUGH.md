# OPA Properties Data Pipeline Walkthrough

* I used Google Gemini 3 Pro (via Antigravity) to help me build this pipeline. I took the markdown from [issue #1](https://github.com/Weitzman-MUSA-GeoCloud/s26-team7-cama/issues/1) and said the following:

  > Hey Gemini, I'm going to get started on this issue in s26-team7-cama:
  >
  > ```markdown
  > [...Issue #1 markdown here...]
  > ```

* From that, Gemini generated some initial files in the `tasks/` directory. It used Python, but I felt like using JS instead. I knew that the week08 folder in the course-info repository had some good examples of how to implement these functions in JS.

  In the initial code, Gemini gave me a folder for each function as well (understandable as that's what the issue asked for), but I wanted to be a little more terse, so I asked it to refactor the code into the folder structure I described below.

  Here is the prompt I gave it (note if I want it to refer to specific files for a code pattern, I tell it explicitly):

  > Instead of Python, I'm going to use JavaScript for my pipeline scripts for funzies. You can check out the mjs files in course-info/week08/explore_phila_data to get a sense for how these should be implemented.
  >
  > Also, I think I'd like to aim for something like the following folder structure:
  >
  > ```
  > s26-team7-cama/
  > tasks/
  >     extract_data/  # Code for extract and prepare functions
  >     index.mjs
  >     package.json
  >     run_sql/
  >     sql/
  >         source/
  >             opa_properties.sql
  >         core/
  >             opa_properties.sql
  >     index.mjs
  >     package.json
  > ```
  >
  > Rather than having a proliferation of different folders for the extract/prepare processes, I'd like to just define all of those functions within the extract_data folder, and then deploy the Cloud Functions individually (essentially, all the extract/prepare Cloud Functions will have the same code base, but use different entrypoints).

  After that I had something closer to what I wanted. The state of the code at this point is captured in commit [aea1320](https://github.com/Weitzman-MUSA-GeoCloud/s26-team7-cama/commit/aea13203bfe9a0b5210666a65ee7b6e6bcf4961c).

* **I then read through all of the code that Gemini generated!** I'm not kidding and I'm not just saying this because I want you to do it too. I always review the code that AI generates for me because it's often subtly wrong. To organize my review, I followed the path of the pipeline workflow, starting with the extract function.

  - I reviewed the extract function:
    - When calling `createWriteStream`, Gemini originally used an option called [`resumable` and set it to `false`](https://github.com/Weitzman-MUSA-GeoCloud/s26-team7-cama/blob/aea13203bfe9a0b5210666a65ee7b6e6bcf4961c/tasks/extract_data/index.mjs#L30). I had no idea what that option was for, and even though Gemini included an in-line comment I didn't have familiarity with it, so I had to look it up. Turns out having `resumable: false` is useful for reducing network overhead while uploading small files (under 10MB). But the files we're uploading aren't small (which Gemini didn't necessarily know, I guess), so I removed it (the default is `resumable: true`).

  - Next I reviewed the prepare function:
    - I re-arranged the stream transformers to be more readable. Node.js has the concept of a `pipeline` that can be used to chain together functions that read, modify, or write streams of data. I wanted the actual call to `pipeline` to be simple, so I defined the stream transformers as separate variables.
    - I found a bug in Gemini's code: Gemini originally used an extra backslash for the newline character in the `makeJsonl` function. I wasn't sure whether it was a bug or not, so I asked Gemini about it.

      > **Me:** In tasks/extract_data/index.mjs, should the newline appended to the data passed to the `callback` have an [escaped backslash (line 57)](https://github.com/Weitzman-MUSA-GeoCloud/s26-team7-cama/blob/aea13203bfe9a0b5210666a65ee7b6e6bcf4961c/tasks/extract_data/index.mjs#L57)? Why is the backslash escaped?

      > **Gemini:** Good catch! It absolutely should **not** be escaped.
      >
      > That was an escaping error on my part when I generated the file content. Since I wrote the JavaScript file using an internal tool string, the literal `\n` in the string was unintentionally rendered as an escaped `\\n` string in the underlying source file. This would have caused the script to output a literal backslash followed by an "n" (e.g. `{"foo": "bar"}\\n` ) instead of an actual newline character sequence in the file.
      >
      > I have just pushed a fix to remove the extra backslash!
    - I renamed some variables for clarity
    - I modified the options passed to the `createWriteStream` method, removing `resumable: false` and adding `gzip: true`.

  - In both the extract and prepare code, Gemini used a `try`/`catch` block around most of the function body. I want to make sure that any errors that arise get sent with a full traceback to the error logging tool in GCP, so I asked Gemini:

    > **Me:** TBH, I'm worried the try/catch blocks in s26-team7-cama/tasks/extract_data/index.mjs will be detrimental. I want to be sure that I get a full stack trace in the GCP error logging. Will console.error(error) give me the complete stacktrace with line numbers, or no?
    >
    > **Gemini:** You are totally spot-on to be worried about that.
    >
    > If you use `console.error(error)`, GCP Cloud Logging handles it fairly well, and it usually registers the `Error` object correctly. However, manually catching exceptions and returning `500` HTTP status codes can sometimes prevent perfectly structured logging to **GCP Error Reporting** because the Cloud Function framework itself doesn't crash or see the unhandled rejection—it thinks the function handled it gracefully due to the catch block!
    >
    > The absolute best practice for `async` Node.js Google Cloud Functions is actually not to use global `try/catch` blocks at all. If an `async` handler throws an error (or a Promise rejects), the `@google-cloud/functions-framework` will automatically:
    >
    > 1. Catch the error
    > 2. Format the stack trace perfectly for Google Cloud Logging & Error Reporting
    > 3. Return a clean `500 Internal Server Error` response back to the trigger that called it.
    >
    > I completely agree with your instinct here, so I've gone ahead and stripped out the `try/catch` blocks from **tasks/extract_data/index.mjs** altogether. Now any errors (HTTP fetch failures, pipeline stream failures) will bubble right up to GCP Error Reporting automatically!

    🙄 Sometimes I'm not a huge fan of Gemini's enthusiasm.

  - I then reviewed the run_sql function:

    - In the workflow yml itself I updated all the `call: http.get` to `call: http.post`. I think `POST` is the correct method for all of these Cloud Functions -- generally in HTTP, `GET` requests are used for retrieving data in a way that doesn't change the server state, while `POST` requests are used for sending data to the server or taking some action that changes some data on the server. Since the whole point of the data pipeline is to change the state of the data on the server, `POST` is the correct method.

      To use `POST` requests with the `run-sql` Cloud Function, I had to update the `args` to include a `data` field instead of a `query` field. Luckily, Gemini set up the `run_sql` function to handle both `query` and `data` fields in the request body.

    - Similar to the extract and prepare functions, I removed the `try`/`catch` block that just returns a `500` error.

    - Instead of using a custom template rendering function, I had Gemini use the `mustache` library to render the SQL query template.

      > **Me:** Instead of a custom `renderTemplate` in s26-team7-cama/tasks/run_sql/, let's use mustache.js (https://github.com/janl/mustache.js)

      > **Gemini:** Refactoring complete! I've updated `tasks/run_sql/index.mjs` to use `mustache.js`, added it to `package.json`, and updated your BigQuery SQL scripts to use `{{dataset_name}}` and `{{bucket_name}}` instead of ES6 template literals.
      >
      > This is much safer than the `eval`-based `renderTemplate` function! Let me know if there's anything else you'd like to adjust.

      Note that Gemini says this is safer than the `eval`-based `renderTemplate` function because it avoids any opportunity for code injection. In this case, since I have complete control over the SQL scripts, I don't think that's a major concern, but it's good to be aware of.
