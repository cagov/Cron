# Q&A scraper

This project scrapes the www.covid19.ca.gov website to create sets of questions and answers we can populate a database with and present to users on the search result page when they query for something closely related to that Q&A pair. This is helpful when the answer to a specific question is available somewhere on a larger page.

## Run scraper

```
node index.js
```

This will write a new qna.tsv file which is the expected format of the Microsoft azure knowledge base. The internal search service on covid19.ca.gov currently points at the API provided by this knowledge base: <a href="https://www.qnamaker.ai/Edit/KnowledgeBase?kbId=714baa2f-18e8-4849-9d7d-6645e954aea0">call-center</a>

The data collected in the scraper is put into a google sheet <a href="https://docs.google.com/spreadsheets/d/1ecR3d15c-zxF8ayjNdoQoOZRVej400I4sxaAB3n_EXo/edit#gid=1359512648">here</a> so the content team can review it. This google sheet is also included in the data studio linked below

Run the following commands to create a dataset with the metadata the content team has provided:

```
node compare.js
npx json2csv -i all.json -o all.csv
```

## Data collection

We've created this data studio dashboard to collect user interaction, searches which came up with quick answers, ones which had none associated and which accordions were interacted with throughout the site: <a href="https://datastudio.google.com/u/0/reporting/b20a976f-f191-48e1-a750-ba45e46bb9cc/page/dcWOB">https://datastudio.google.com/u/0/reporting/b20a976f-f191-48e1-a750-ba45e46bb9cc/page/dcWOB</a>