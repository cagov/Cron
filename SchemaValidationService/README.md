# Function Service for validating JSON

Expecting a POST with a body like so...

```json
{
  "body": {
    "input": [
      {
        "name": "File Name to identify",
        "schema_url": "https://someschema.org/testSchema.json",
        "content": {
          "mycontent": "content to validate"
        }
      }
    ]
  }
}
```
