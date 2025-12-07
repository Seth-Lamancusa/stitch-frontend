# Wikipedia Scraping POC - Frontend

## UI Components
- **Bot Only**: No dedicated UI pages.
- **Interaction**: Users trigger scraping and queries purely through the chat interface.

## Flow
1. **Trigger Scrape**:
   - User types: `@wikibot scrape "Artificial Intelligence"`
   - Bot Service parses command -> Runs scrape -> Replies "Done. Scraped 5 articles."
2. **Query**:
   - User types: `@wikibot What is AI?`
   - Bot Service performs RAG -> Replies with answer + citations.

## Justification
- Keeps Frontend code zero-touch.
- Leverages existing Chat UI.
- "Minimum viable" means using what we have (chat) instead of building new views.
