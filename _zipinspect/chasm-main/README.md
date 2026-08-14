# Claims Checker

Claims Checker is a research tool for finding the gap between what a real-world-asset project says in public and what its official legal terms actually support.

It is designed for researchers, traders, journalists, compliance teams, and anyone who wants to look past confident marketing language before trusting a tokenized-asset project.

## The problem

Projects can describe a product in very strong language:

- “You own the underlying asset.”
- “Your assets are fully protected.”
- “Trade with public-market liquidity.”
- “Earn consistent returns.”
- “Anyone can participate with no experience.”

The legal terms may tell a much narrower story:

- The holder receives economic exposure, not ownership.
- The holder has no voting rights or delivery rights.
- Trading may depend on the platform’s own liquidity.
- The project does not guarantee returns.
- The user remains responsible for risk and suitability.

These differences are easy to miss when the marketing and legal terms are read separately. Claims Checker puts them beside each other and points out where the language does not line up.

## What the product does

The user provides two pieces of text:

1. **Official terms** — terms of use, disclosures, risk language, or product conditions.
2. **Public marketing** — website copy, campaign language, promotional posts, or pitch material.

Claims Checker then:

1. Reads both sources.
2. Looks for strong promises, certainty, ownership language, return language, protection language, and liquidity claims.
3. Compares those promises with the qualifications and limitations in the official terms.
4. Produces a report with the relevant quotes side by side.
5. Explains the possible mismatch in plain language.
6. Gives each finding a severity and confidence level.

The tool is a screening and research aid. It is not legal, financial, investment, or compliance advice.

## What has been built

### Working product interface

- A responsive single-page Claims Checker workspace.
- Separate text areas for official terms and public marketing.
- Character counts for both sources.
- Clear input validation.
- A one-click generic example loader.
- A primary **Check claims** action.
- A **New check** reset action.

### Working local analysis

The current version runs without an AI provider or API key. It uses a transparent, deterministic local ruleset to identify common mismatch patterns, including:

- Ownership language versus contractual economic exposure.
- Strong public-market liquidity language versus platform-managed liquidity.
- “Same upside” language that leaves out ownership and control rights.
- Protection, certainty, return, and hands-off investing language.

This local path exists so the product can be demonstrated and tested even when external AI access is unavailable.

Optional AI environment variables can enable the provider-backed path:

- `ANALYSIS_PROVIDER=ai`
- `AI_BASE_URL`
- `AI_API_KEY`
- `AI_MODEL`

### Shared screening contract

- The local analyzer now lives in a shared workspace package so the frontend and API server use the same screening logic.
- A `POST /api/analysis/screen` endpoint is available for future AI-backed analysis and X Layer workflows.
- A `POST /api/analysis/publish-prep` endpoint returns the compact X Layer payload that would be published on-chain.
- A `POST /api/analysis/records` endpoint saves reports to PostgreSQL when configured, with an in-memory fallback for local development.
- The request and response shapes are defined centrally so later persistence, chain publishing, and codegen can build on the same contract.
- Reports now carry provenance fields for source fingerprints, provider mode, and a future X Layer record shell.

### Working evidence report

The report includes:

- Overall alignment score.
- Total findings.
- High-severity finding count.
- Review status.
- Timestamp.
- Expandable evidence cards.
- Marketing quote.
- Terms quote.
- Plain-language investigator explanation.
- Rule confidence.
- Method disclosure.
- Research and legal-advice disclaimer.

### Research ledger

Saved reports now surface in a visible ledger so you can review recent checks, provider mode, compact hashes, and publication status from the app itself.

### Netlify deployment

This repo is prepared for a Netlify-hosted frontend build:

- Build command: `pnpm run build`
- Publish directory: `artifacts/claims-checker/dist/public`
- SPA fallback: all routes rewrite to `index.html`

If the API server is not deployed yet, the claims checker falls back to local analysis and browser-stored records so the Netlify site still works.

### Product design

The interface has been designed as a focused evidence room rather than a generic dashboard. It uses:

- A memorable evidence-oriented visual identity.
- Clear separation between source text and findings.
- Strong red-flag treatment for potentially unsupported promises.
- Responsive behavior for desktop and mobile.
- Loading, empty, error, and reset states.
- Accessible labels and controls.
- Reduced-motion support.

### Project foundation

- React and Vite frontend.
- Shared API server foundation.
- PostgreSQL and Drizzle workspace foundation available for future persistence.
- OpenAPI and generated client libraries available for future backend endpoints.
- A running development preview.
- Successful frontend typecheck.

## What remains

### 1. Add AI-assisted analysis

The current local rules are useful for the first proof of concept, but they cannot understand every subtle claim.

The next analysis layer should use AI to detect:

- Implied claims.
- Carefully worded exaggerations.
- Meaningful omissions.
- Contradictions that depend on context.
- Project-specific language.
- Relationships between multiple clauses in the terms.

The AI should return structured findings with:

- Marketing quote.
- Terms quote.
- Explanation.
- Severity.
- Confidence.

The local ruleset should remain available as a fallback. AI should improve the analysis, not make the basic product unusable.

### 2. Add permanent X Layer records

After a report is generated, the app should be able to publish a tamper-evident record to X Layer.

The record should contain only a compact, privacy-conscious payload such as:

- Hash of the official terms.
- Hash of the marketing text.
- Hash of the report.
- Timestamp.
- Finding count.
- Severity summary.
- Network name.

The full source documents should not be written directly on-chain.

After publication, the app should show:

- Network.
- Transaction hash.
- Timestamp.
- Confirmation state.
- Block-explorer link.

The first version should target X Layer Testnet. Mainnet can follow after the testnet flow is stable.

### 3. Test against a live X Layer ecosystem project

For hackathon relevance, the product should be run against a real project in the target ecosystem.

The research package should include:

- Official terms URL.
- Official marketing URL.
- Relevant promotional copy.
- Date and source of each document.
- The final Claims Checker report.

The product UI should remain generic. The analyzed project belongs in the research record, not in the Claims Checker brand.

### 4. Add source and report persistence

The current first build is intentionally local and does not yet save checks permanently in an application database.

Later, users should be able to save:

- Source names.
- Source URLs.
- Document timestamps.
- Input hashes.
- Report results.
- On-chain transaction details.

The system should avoid storing sensitive full documents unless the user explicitly chooses to save them.

### 5. Prepare the hackathon launch

The project still needs:

- X Layer Testnet deployment.
- X Layer Mainnet launch.
- A project wallet and testnet funds.
- A dedicated project X account.
- A public project identity and announcement.
- Final screenshots or demo recording.
- Hackathon submission form.
- Final announcement tagging the required organizer account.

## Recommended build order

1. Confirm the generic example produces the expected evidence report.
2. Connect a supported AI provider securely.
3. Add the AI-assisted analysis endpoint.
4. Keep the local ruleset as a fallback.
5. Create the X Layer Testnet publishing flow.
6. Store only hashes and compact summaries on-chain.
7. Test the tool against a live ecosystem project.
8. Add report persistence and source metadata.
9. Deploy to Testnet.
10. Prepare the public account, demo, and submission.
11. Move to Mainnet when the testnet flow is reliable.

## What is needed from the owner

No private keys, seed phrases, API keys, or credentials should be shared in chat.

When the next phase begins, the owner will need to provide or authorize these securely:

- An AI provider connection, if AI-assisted analysis is being added.
- A public X Layer Testnet wallet address.
- Testnet funds from the official faucet.
- Official source URLs for the real project selected for research.
- The dedicated project X account.

The owner should keep all private wallet credentials and provider credentials private.

## Current status

Claims Checker is a working local proof of concept with a polished user interface and an evidence-led report flow.

The main product idea has been validated at the interaction level:

> Put public claims and official terms side by side, then make the unsupported gap impossible to ignore.

The remaining work is to add deeper AI reasoning, permanent on-chain records, a live ecosystem test case, and final hackathon launch preparation.
