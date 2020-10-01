# Q&A scraper

This project scrapes the www.covid19.ca.gov website to create sets of questions and answers we can populate a database with and present to users on the search result page when they query for something closely related to that Q&A pair. This is helpful when the answer to a specific question is available somewhere on a larger page.

## Content Authors

The authors of the site content can help the scraper find question and answer pairs by adding classes to the elements on the site. The scraper successfully scrapes things using our accordions without additional help. Content we want to include outside of accordions should use these classes:

- Every Quick Answer question or answer content needs to have the ```js-qa``` class
- Every Quick Answer question should also have the ```js-qa-question``` class
- Every Quick Answer answer should also have the ```js-qa-answer``` class
- The order of the elements on the page is important, all js-qa-answer elements will be associated with the nearest js-qa-question element above them. We often have multiple elements that comprise a single answer which is fine: Add the class js-qa-answer to each separate WordPress block element
- Using invisible elements for questions or answers is fine you can use code like ```<div style="display:none;" class="js-qa js-qa-question">The text of the desired question</div>```
- Accordion elements created in WordPress only find directly adjacent siblings for their interior content so nesting invisible alternate questions between a visible question and answer is not yet supported.
- If you want to exclude an accordion from being turned into a quick answer add the class ```js-qa-exclude``` to it
- If you need a quick answer to come up for words that cannot be included in the visible question or answer you can also use a comment element. Since accordions are already turned into Q&A paris automatically you might want to add another block elemen tin the WordPress post with some keywords that is not visible, you can do so with: ```<div class="wp-accordion-content"><!-- weddings, wedding, travel, small social gathering, tourism, funeral, funerals --></div>```

## Run scraper

```
node index.js
```

This will write a new qna.tsv file which is the expected format of the Microsoft azure knowledge base. The internal search service on covid19.ca.gov currently points at the API provided by this knowledge base: <a href="https://www.qnamaker.ai/Edit/KnowledgeBase?kbId=714baa2f-18e8-4849-9d7d-6645e954aea0">call-center</a>

We have a couple manually created quick answers like the Larry David Easter egg. Run the following commands to merge those:

```
node merge-editorial.js
node excel.js
```

<!--
The output merged.tsv is the new knowledge base for azure qnamaker.ai
-->

The output merged.xlsx is the new knowledge base for azure qnamaker.ai. We used to us the tsv file but Azure introduced a bug which started causing line breaks with out line break symbols, switching to the xlsx import avoids the issue

## Data collection

We've created this data studio dashboard to collect user interaction, searches which came up with quick answers, ones which had none associated and which accordions were interacted with throughout the site: <a href="https://datastudio.google.com/u/0/reporting/b20a976f-f191-48e1-a750-ba45e46bb9cc/page/dcWOB">https://datastudio.google.com/u/0/reporting/b20a976f-f191-48e1-a750-ba45e46bb9cc/page/dcWOB</a>
