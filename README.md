# Claims Checker

Claims Checker is an AI-assisted evidence tool for screening public Web3 project claims against the project record.

It helps users compare what a project says in public marketing with what its official terms, disclosures, or risk language actually support. The app then produces a readable claim report and prepares a compact X Layer proof package so the report can be anchored onchain without publishing the full pasted text.

Live demo: https://checklit.netlify.app/

Repository: https://github.com/Valorian0108/chasm

## Hackathon Fit

Claims Checker was built for the OKX AI Season Hackathon.

The project combines:

- AI-assisted claim analysis
- Human-readable evidence reporting
- X Layer testnet proof publishing
- Privacy-conscious onchain fingerprints instead of full document storage

The goal is simple: make unsupported or overstated crypto project claims easier to catch before users rely on them.

## Problem

Crypto and Web3 projects often publish persuasive claims in landing pages, tweets, pitch decks, or campaign posts. The official terms may say something narrower.

Examples:

- Marketing says users own an asset, while terms only promise economic exposure.
- Marketing says returns are guaranteed, while terms say rewards are variable.
- Marketing says value goes to holders, while terms say holders have no revenue rights.
- Marketing says liquidity is deep, while terms say liquidity depends on platform arrangements.
- Marketing says a project is community-owned, while terms disclaim governance rights.

Those gaps are easy to miss when the sources are read separately. Claims Checker puts both sides in one workflow and highlights the risk in plain language.

## How It Works

The user provides two source blocks.

Official terms:
Terms of service, disclosures, risk notes, token documentation, investor disclaimers, project docs, or any source that defines what the project is formally promising.

Public marketing:
Landing page copy, launch posts, campaign language, social posts, pitch deck claims, founder posts, or any source that users are likely to rely on before making a decision.

The app then:

1. Reads both text sources.
2. Detects strong claims, guarantees, ownership language, safety language, return language, liquidity claims, and revenue-sharing language.
3. Compares those claims against the official record.
4. Produces an evidence report with quotes from both sides.
5. Gives each issue a severity and confidence score.
6. Creates hashes/fingerprints for the report, terms, and marketing text.
7. Prepares an X Layer proof package for testnet publication.

Claims Checker is a screening tool. It is not legal, financial, investment, or compliance advice.

## Current Product Status

Built and working:

- Responsive React/Vite frontend
- Editorial evidence-room interface
- Side-by-side source input flow
- AI-compatible analysis endpoint
- Local fallback rules when AI is not configured
- Structured evidence report
- Finding severity and confidence
- Report fingerprint generation
- X Layer setup panel
- X Layer testnet contract deployed
- Wallet publishing flow tested
- Wallet publishing currently paused in the UI for controlled demos
- Manual transaction marking
- Research ledger UI
- Netlify deployment configuration

Current live X Layer details:

- Target network: X Layer Testnet
- Testnet chain ID: `1952`
- Mainnet chain ID: `196`
- Project wallet: `0xf52a8c9f07446604743ffe60b7fbf75e9d16d9ff`
- Testnet contract: `0xa3a9fFddE592AE2D889562d9ca2B05d9Ae5634b3`
- Testnet explorer: https://www.okx.com/web3/explorer/xlayer-test
- Faucet: https://www.okx.com/xlayer/faucet

## AI Analysis

The app is designed to use AI first when a server-side API key is configured.

On hosted deployments, the AI key must stay in server environment variables. It should not be exposed in browser code.

Supported environment variables:

```env
ANALYSIS_PROVIDER=ai
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=https://api.openai.com
```

Legacy aliases are also supported:

```env
AI_API_KEY=
AI_MODEL=
AI_BASE_URL=
```

If no AI key is configured, the app falls back to local deterministic rules. The fallback is useful for demos, but AI is expected to handle long and nuanced project text better.

## X Layer Proof Design

Claims Checker does not publish full pasted source text onchain.

Instead, it prepares a compact proof package:

- Report fingerprint
- Official terms fingerprint
- Public marketing fingerprint
- Findings count
- High-severity findings count
- Timestamp
- Network name

This lets a report be verified later without exposing the full terms or marketing copy directly onchain.

The contract used for the proof flow is `XLayerPublish`.

Wallet publishing has already been tested on X Layer Testnet. It is currently paused in the public UI so demos do not accidentally create new transactions.

## Example Use Case

Marketing claim:

> We are building a perpetual, community-owned engine that routes real protocol value directly back to the people holding and staking.

Official terms:

> Holders have zero equity rights, zero legal claims to revenue, and no governance voting rights.

Why this matters:

The public claim suggests value participation and community ownership. The terms say holders do not have enforceable revenue, equity, or governance rights. That is the type of mismatch Claims Checker is built to surface.

## Project Structure

```text
.
|-- artifacts/
|   |-- api-server/          # Express/API foundation for analysis routes
|   |-- claims-checker/      # Main React frontend
|   `-- mockup-sandbox/      # Design/mockup workspace
|-- lib/                     # Shared libraries
|-- netlify/functions/       # Serverless AI analysis route for Netlify
|-- scripts/                 # Workspace scripts
|-- .env.example             # Required environment variable template
|-- netlify.toml             # Current Netlify deployment config
|-- package.json             # Root workspace scripts
`-- pnpm-workspace.yaml      # Monorepo workspace config
```

## Local Development

Install dependencies:

```bash
pnpm install
```

Copy environment variables:

```bash
cp .env.example .env.local
```

Run typecheck:

```bash
pnpm run typecheck
```

Build production frontend:

```bash
pnpm run build
```

Run the frontend locally:

```bash
pnpm --filter @workspace/claims-checker run dev
```

## Deployment Notes

Current deployment target:

- Vercel
- Build command: `pnpm run build`
- Publish directory: `artifacts/claims-checker/dist/public`
- AI route: `/api/analysis/screen`

Netlify support still exists in the repo, but Vercel is the preferred deployment path now.

Required hosted environment variables:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=https://api.openai.com
VITE_X_LAYER_WALLET_ADDRESS=0xf52a8c9f07446604743ffe60b7fbf75e9d16d9ff
VITE_X_LAYER_CONTRACT_ADDRESS=0xa3a9fFddE592AE2D889562d9ca2B05d9Ae5634b3
```

The project can be migrated to Vercel next. The main thing to preserve during the migration is the server-side AI route so `OPENAI_API_KEY` remains private.

## Roadmap

Near-term:

- Move deployment from Netlify to Vercel if preferred
- Re-enable wallet publishing only when the demo flow is ready
- Improve onboarding copy so non-technical users understand official terms vs public marketing
- Add a clearer walkthrough graphic or step-by-step explainer in the UI
- Test AI analysis against multiple real project examples

Hackathon submission:

- Confirm live deployment URL
- Confirm X Layer testnet proof transaction
- Prepare demo screenshots or short recording
- Create/activate dedicated project X account
- Publish project post mentioning `@XLayerOfficial`
- Submit through the hackathon form before the deadline

Later:

- Launch on X Layer Mainnet after testnet flow is stable
- Add persistent report storage
- Add source URL capture and timestamping
- Add public report pages
- Add stronger verification UX around onchain proofs

## Security Notes

- Do not commit private keys, seed phrases, or API keys.
- Keep `OPENAI_API_KEY` in hosted environment variables only.
- The app should publish only hashes/fingerprints onchain, not private source text.
- Wallet publishing should remain manual and user-confirmed.

## License

MIT
