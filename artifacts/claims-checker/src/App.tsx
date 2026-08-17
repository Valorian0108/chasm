import { useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { AlertTriangle, ArrowRight, Check, CheckCircle2, ChevronDown, ClipboardCheck, FileText, Fingerprint, Info, Loader2, LockKeyhole, RotateCcw, Scale, ShieldCheck, Sparkles, TriangleAlert, X } from 'lucide-react';
import { buildPublicationChecklist, buildXLayerPublication, type Finding, type AnalysisReport as Report, type Severity } from '@workspace/api-zod';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import {
  finalizePublishStatus,
  getDefaultSourceMetadata,
  getXLayerSetup,
  getXLayerReadiness,
  listRecords,
  preparePublication,
  preparePublishStatus,
  saveReport,
  screenClaims,
  type AnalysisRecord,
  type XLayerReadiness,
  type XLayerSetup,
} from '@/lib/analysis-api';
import { publishToXLayer } from '@/lib/xlayer-wallet';

const queryClient = new QueryClient();

const demoLegalTerms = `Tokenized Asset Terms & Disclosures
Product: Reference Equity Token

The token provides holders with contractual economic exposure to the performance of the referenced public-company share. Holding the token does not register the holder as a shareholder of the company. Holders do not receive voting rights, shareholder registration, or delivery of the underlying share.

The token is not a deposit, security, or ownership interest in the referenced asset. Availability, pricing, redemption, and trading are subject to the applicable product terms and platform conditions. The platform may use its own liquidity arrangements to facilitate trading.`;

const demoMarketingCopy = `Reference Equity Token — get public-market exposure on-chain.

Backed 1:1 by real shares. Own a piece of the company and access the same upside as holding the underlying stock.

Trade with the world's leading stock-market liquidity, right from your crypto wallet.`;

const demoFindings: Finding[] = [
  {
    title: '“Backed 1:1” implies ownership the terms withhold',
    severity: 'high',
    marketingQuote: 'Backed 1:1 by real shares. Own a piece of the company',
    termsQuote: 'Contractual economic exposure… does not register the holder as a shareholder. No voting rights or delivery of the underlying share.',
    explanation: 'The marketing compresses exposure into an ownership promise. The terms describe a contractual economic exposure and explicitly remove shareholder registration, voting rights, and delivery of the underlying share.',
    confidence: 98,
  },
  {
    title: 'Exchange-liquidity claim is undercut',
    severity: 'high',
    marketingQuote: 'Trade with leading public-market liquidity',
    termsQuote: 'The platform may use its own liquidity arrangements to facilitate trading.',
    explanation: 'Naming leading stock-market liquidity suggests access to live public-market order books. The disclosure instead points to the platform’s own liquidity arrangements, which is a materially narrower description.',
    confidence: 97,
  },
  {
    title: '“Same upside” leaves important rights unstated',
    severity: 'medium',
    marketingQuote: 'Access the same upside as holding the underlying stock.',
    termsQuote: 'The token is not an ownership interest in the referenced asset.',
    explanation: 'Economic performance may be similar in a narrow sense, but the marketing leaves out the legal and control rights that distinguish a tokenized exposure from holding the stock itself.',
    confidence: 88,
  },
];

function Header({ onReset }: { onReset: () => void }) {
  return (
    <header className="mx-auto max-w-[1480px] px-5 pt-5 sm:px-8 lg:px-12">
      <div className="border-y border-[hsl(var(--border))] py-5">
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-[hsl(var(--muted-foreground))]">
            No. 03 · AI Season · Claims dossier
          </p>
          <h1 className="mt-3 font-serif text-[clamp(2.8rem,6vw,5.8rem)] leading-[.9] tracking-tight text-[hsl(var(--foreground))]">
            Claims Checker
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-[hsl(var(--muted-foreground))] sm:text-[15px]">
            Screens public claims against the record, keeps the evidence visible, and preserves the path from source to publication.
          </p>
        </div>

        <nav className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
          <TypographicLink href="#sources">Sources</TypographicLink>
          <TypographicLink href="#report">Reading</TypographicLink>
          <TypographicLink href="#ledger">Ledger</TypographicLink>
          <TypographicLink onClick={onReset}>New check</TypographicLink>
        </nav>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[hsl(var(--border))] pt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
          <span>Editorial / Split studio / Newsprint</span>
          <span>AI screening, browser rules as backup</span>
        </div>
      </div>
    </header>
  );
}

function FieldLabel({ index, children, count }: { index: string; children: string; count: number }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <label className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
        <span className="text-[hsl(var(--secondary))]">{index}</span>
        {children}
      </label>
      <span className="font-mono text-[10px] tabular-nums text-[hsl(var(--muted-foreground)/.7)]">{count.toLocaleString()} chars</span>
    </div>
  );
}

function SectionHeading({
  index,
  title,
  lead,
}: {
  index: string;
  title: string;
  lead: string;
}) {
  return (
    <header className="grid gap-3 lg:grid-cols-[9rem_minmax(0,1fr)] lg:items-start">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[hsl(var(--muted-foreground))]">
        {index}
      </div>
      <div className="min-w-0">
        <h2 className="font-serif text-4xl leading-[.95] tracking-tight text-[hsl(var(--foreground))] sm:text-5xl">
          {title}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[hsl(var(--muted-foreground))] sm:text-[15px]">
          {lead}
        </p>
      </div>
    </header>
  );
}

function TypographicLink({
  children,
  onClick,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const className =
    'inline-flex items-center gap-2 text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))] underline decoration-[hsl(var(--primary)/.25)] underline-offset-[6px] transition-colors hover:decoration-[hsl(var(--primary))]';

  if (href) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}

function XLayerSetupPanel({
  setup,
  readiness,
}: {
  setup: XLayerSetup;
  readiness: XLayerReadiness | null;
}) {
  const testnet = setup.networks["xlayer-testnet"];
  const mainnet = setup.networks["xlayer-mainnet"];

  return (
    <div className="rounded-none border border-[hsl(var(--border))] bg-[hsl(var(--card)/.74)] p-4">
      <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">X Layer setup</div>
      <div className="mt-2 text-sm text-[hsl(var(--foreground))]">
        {setup.targetNetwork === "xlayer-mainnet" ? "Mainnet target" : "Testnet target"}
      </div>
      <div className="mt-1 text-xs leading-6 text-[hsl(var(--muted-foreground))]">
        Wallet: <span className="break-all">{setup.walletAddress || "Add your wallet address in .env.local"}</span>
      </div>
      <div className="mt-1 text-xs leading-6 text-[hsl(var(--muted-foreground))]">
        Contract: <span className="break-all">{setup.contractAddress || "Not deployed yet"}</span>
      </div>
      <div className="mt-3 grid gap-2 text-xs leading-6 text-[hsl(var(--muted-foreground))]">
        <div className="flex items-center justify-between gap-3">
          <span>Testnet chain</span>
          <span className="font-mono text-[hsl(var(--foreground))]">{testnet.chainId}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Mainnet chain</span>
          <span className="font-mono text-[hsl(var(--foreground))]">{mainnet.chainId}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Faucet</span>
          <a
            href={setup.faucetUrl}
            target="_blank"
            rel="noreferrer"
            className="truncate text-[hsl(var(--primary))] underline decoration-[hsl(var(--primary)/.25)] underline-offset-4"
          >
            Open faucet
          </a>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Readiness</span>
          <span className={`font-mono ${readiness?.ready ? 'text-[hsl(var(--secondary))]' : 'text-[hsl(var(--destructive))]'}`}>
            {readiness?.ready ? 'Ready' : 'Waiting'}
          </span>
        </div>
        <div className="text-[11px] leading-6 text-[hsl(var(--muted-foreground))]">
          {readiness?.nextStep ?? 'Loading readiness details…'}
        </div>
      </div>
    </div>
  );
}

function Workspace({
  onReport,
  xLayerSetup,
  xLayerReadiness,
}: {
  onReport: (report: Report) => void;
  xLayerSetup: XLayerSetup | null;
  xLayerReadiness: XLayerReadiness | null;
}) {
  const defaultSourceMetadata = useMemo(() => getDefaultSourceMetadata(), []);
  const [legalTerms, setLegalTerms] = useState('');
  const [marketingCopy, setMarketingCopy] = useState('');
  const [sourceLabel, setSourceLabel] = useState(defaultSourceMetadata.sourceLabel);
  const [sourceUrl, setSourceUrl] = useState(defaultSourceMetadata.sourceUrl);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState('');

  const canCheck = legalTerms.trim().length > 24 && marketingCopy.trim().length > 24;

  const loadDemo = () => {
    setLegalTerms(demoLegalTerms);
    setMarketingCopy(demoMarketingCopy);
    setSourceLabel('Demo research package');
    setSourceUrl(defaultSourceMetadata.sourceUrl);
    setError('');
  };

  const checkClaims = () => {
    if (!canCheck) {
      setError('Add at least 25 characters to both sources before running a check.');
      return;
    }
    setError('');
    setIsChecking(true);
    window.setTimeout(async () => {
      try {
        onReport(await screenClaims(legalTerms, marketingCopy, {
          sourceLabel,
          sourceUrl: sourceUrl.trim() || undefined,
          targetNetwork: xLayerSetup?.targetNetwork ?? 'xlayer-testnet',
        }));
      } finally {
        setIsChecking(false);
      }
    }, 950);
  };

  return (
    <main id="sources" className="mx-auto max-w-[1480px] px-5 pb-20 pt-10 sm:px-8 lg:px-12 lg:pt-14">
      <section className="grid gap-8 border-b border-[hsl(var(--border))] pb-10 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
        <SectionHeading
          index="01"
          title="Source dossier"
          lead="Paste the terms and the public copy. The app holds both versions in view so the comparison feels like reading a file, not filling a form."
        />

        <aside className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-none border border-[hsl(var(--border))] bg-[hsl(var(--card)/.74)] p-4">
            <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Analysis mode</div>
            <div className="mt-2 text-sm text-[hsl(var(--foreground))]">AI first, browser rules as backup</div>
            <div className="mt-1 text-xs leading-6 text-[hsl(var(--muted-foreground))]">The report says whether AI or the built-in checker produced the result.</div>
          </div>
          <div className="rounded-none border border-[hsl(var(--border))] bg-[hsl(var(--card)/.74)] p-4">
            <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Current source</div>
            <div className="mt-2 text-sm text-[hsl(var(--foreground))]">{sourceLabel}</div>
            <div className="mt-1 text-xs leading-6 text-[hsl(var(--muted-foreground))] break-all">{sourceUrl || 'No source URL recorded yet'}</div>
          </div>
          {xLayerSetup ? (
            <XLayerSetupPanel setup={xLayerSetup} readiness={xLayerReadiness} />
          ) : (
            <div className="rounded-none border border-[hsl(var(--border))] bg-[hsl(var(--card)/.74)] p-4">
              <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">X Layer setup</div>
              <div className="mt-2 text-sm text-[hsl(var(--foreground))]">Loading network details…</div>
              <div className="mt-1 text-xs leading-6 text-[hsl(var(--muted-foreground))]">The app will show your testnet wallet and contract slot here.</div>
            </div>
          )}
        </aside>
      </section>

      <section className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <article className="paper-panel">
          <FieldLabel index="01" count={legalTerms.length}>Official terms</FieldLabel>
          <textarea
            value={legalTerms}
            onChange={(event) => setLegalTerms(event.target.value)}
            data-testid="input-legal-terms"
            aria-label="Official legal terms"
            placeholder="Paste the project's terms of use, disclosures, or conditions here."
            className="min-h-[320px] w-full resize-none border-0 bg-transparent p-0 text-[15px] leading-8 text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground)/.54)] focus:ring-0"
          />
          <div className="mt-4 border-t border-[hsl(var(--border))] pt-3 text-xs leading-6 text-[hsl(var(--muted-foreground))]">
            <LockKeyhole size={13} className="mr-2 inline-block align-[-2px]" />
            Source stays in this browser until you save it.
          </div>
        </article>

        <article className="paper-panel">
          <FieldLabel index="02" count={marketingCopy.length}>Public marketing</FieldLabel>
          <textarea
            value={marketingCopy}
            onChange={(event) => setMarketingCopy(event.target.value)}
            data-testid="input-marketing-copy"
            aria-label="Public marketing copy"
            placeholder="Paste the landing page, campaign copy, pitch deck language, or social post here."
            className="min-h-[320px] w-full resize-none border-0 bg-transparent p-0 text-[15px] leading-8 text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground)/.54)] focus:ring-0"
          />
          <div className="mt-4 border-t border-[hsl(var(--border))] pt-3 text-xs leading-6 text-[hsl(var(--muted-foreground))]">
            <FileText size={13} className="mr-2 inline-block align-[-2px]" />
            Claims are quoted verbatim in the report.
          </div>
        </article>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <article className="paper-panel">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Source label</label>
              <input
                value={sourceLabel}
                onChange={(event) => setSourceLabel(event.target.value)}
                data-testid="input-source-label"
                aria-label="Source label"
                placeholder="Browser screening session"
                className="w-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground)/.34)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Source URL</label>
              <input
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                data-testid="input-source-url"
                aria-label="Source URL"
                placeholder="https://..."
                className="w-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground)/.34)]"
              />
            </div>
          </div>
          {error && (
            <div role="alert" data-testid="status-input-error" className="mt-4 flex items-center gap-2 border-l-2 border-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/.08)] px-4 py-3 text-sm text-[hsl(var(--destructive))]">
              <TriangleAlert size={16} />
              {error}
            </div>
          )}
        </article>

        <aside className="paper-panel flex flex-col justify-between">
          <div>
            <div className="mb-5 flex items-center justify-between gap-3">
              <Scale size={21} strokeWidth={1.6} className="text-[hsl(var(--secondary))]" />
              <span className="font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">POC / v0.1</span>
            </div>
            <h2 className="font-serif text-3xl leading-none text-[hsl(var(--foreground))]">A quiet second look.</h2>
            <p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">The reading checks absolute promises, implied certainty, and language that outpaces the terms.</p>
          </div>
          <div className="mt-7 space-y-3 border-t border-[hsl(var(--border))] pt-5">
            <button type="button" onClick={loadDemo} data-testid="button-load-demo" className="group flex w-full items-center justify-between text-left text-sm text-[hsl(var(--foreground))] transition-colors hover:text-[hsl(var(--secondary))]">
              <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em]"><Sparkles size={14} /> Load example</span>
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
            </button>
            <button type="button" onClick={checkClaims} disabled={isChecking} data-testid="button-check-claims" className="group flex w-full items-center justify-between border border-[hsl(var(--primary))] px-4 py-3 text-left text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))] disabled:cursor-wait disabled:opacity-70">
              <span>{isChecking ? 'Reading the record…' : 'Check claims'}</span>
              {isChecking ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />}
            </button>
            <div className="pt-2 text-xs leading-6 text-[hsl(var(--muted-foreground))]">
              The interface keeps the source visible, the action explicit, and the result readable to judges.
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-10 grid gap-4 border-y border-[hsl(var(--border))] py-5 text-xs text-[hsl(var(--muted-foreground))] sm:grid-cols-3">
        <div className="flex gap-3"><ShieldCheck className="shrink-0 text-[hsl(var(--secondary))]" size={17} /><span><strong className="font-medium text-[hsl(var(--foreground))]">Evidence-led</strong><br />Every flag includes the language behind it.</span></div>
        <div className="flex gap-3"><Fingerprint className="shrink-0 text-[hsl(var(--secondary))]" size={17} /><span><strong className="font-medium text-[hsl(var(--foreground))]">AI or browser rules</strong><br />AI runs when configured; otherwise the built-in checker keeps the demo working.</span></div>
        <div className="flex gap-3"><Info className="shrink-0 text-[hsl(var(--secondary))]" size={17} /><span><strong className="font-medium text-[hsl(var(--foreground))]">Not legal advice</strong><br />A screening layer for human investigators.</span></div>
      </section>
    </main>
  );
}

function SeverityMark({ severity }: { severity: Severity }) {
  return severity === 'high'
    ? <span className="inline-flex items-center gap-1.5 border border-[hsl(var(--destructive)/.28)] bg-[hsl(var(--destructive)/.09)] px-2 py-1 font-mono text-[10px] uppercase tracking-[.12em] text-[hsl(var(--destructive))]"><AlertTriangle size={12} /> High</span>
    : severity === 'medium'
      ? <span className="inline-flex items-center gap-1.5 border border-[hsl(28_67%_51%/.35)] bg-[hsl(28_67%_51%/.1)] px-2 py-1 font-mono text-[10px] uppercase tracking-[.12em] text-[hsl(28_67%_42%)]"><TriangleAlert size={12} /> Review</span>
      : <span className="inline-flex items-center gap-1.5 border border-[hsl(var(--secondary)/.3)] bg-[hsl(var(--secondary)/.1)] px-2 py-1 font-mono text-[10px] uppercase tracking-[.12em] text-[hsl(var(--secondary))]"><Check size={12} /> Low</span>;
}

function AnalysisProviderBadge({ provider }: { provider: string }) {
  const normalized = provider.toLowerCase();
  const styles =
    normalized === 'ai'
      ? 'border-[hsl(142_71%_45%/.28)] bg-[hsl(142_71%_45%/.1)] text-[hsl(142_71%_28%)]'
      : normalized === 'fallback'
        ? 'border-[hsl(28_67%_51%/.28)] bg-[hsl(28_67%_51%/.1)] text-[hsl(28_67%_35%)]'
        : 'border-[hsl(var(--secondary)/.28)] bg-[hsl(var(--secondary)/.1)] text-[hsl(var(--secondary))]';

  const label = normalized === 'ai'
    ? 'AI analysis'
    : normalized === 'fallback'
      ? 'Browser rules'
      : 'Local rules';

  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[10px] uppercase tracking-[.12em] ${styles}`}>
      <Sparkles size={12} />
      {label}
    </span>
  );
}

function ReportView({
  report,
  onReset,
  onRecordSaved,
  xLayerSetup,
  xLayerReadiness,
}: {
  report: Report;
  onReset: () => void;
  onRecordSaved: () => Promise<void>;
  xLayerSetup: XLayerSetup | null;
  xLayerReadiness: XLayerReadiness | null;
}) {
  const [openFinding, setOpenFinding] = useState<number | null>(0);
  const [showMethod, setShowMethod] = useState(false);
  const [publication, setPublication] = useState<ReturnType<typeof buildXLayerPublication> | null>(null);
  const [publishStatus, setPublishStatus] = useState<Awaited<ReturnType<typeof preparePublishStatus>> | null>(null);
  const [publishTxHash, setPublishTxHash] = useState('');
  const [publishExplorerUrl, setPublishExplorerUrl] = useState('');
  const [isPublishingToXLayer, setIsPublishingToXLayer] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const checkedAt = useMemo(() => new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(report.checkedAt)), [report.checkedAt]);
  const highCount = report.findings.filter((finding) => finding.severity === 'high').length;
  const publicationChecklist = useMemo(
    () => buildPublicationChecklist(report, publication),
    [report, publication],
  );
  const xLayerPayload = publication ?? publishStatus?.payload ?? null;

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: `${label} copied`,
        description: "Ready to paste into your testnet workflow.",
      });
    } catch (error) {
      console.warn("Unable to copy text", error);
      toast({
        title: `Couldn't copy ${label.toLowerCase()}`,
        description: "Your browser may have blocked clipboard access.",
      });
    }
  };

  const publishWithWallet = async () => {
    if (!xLayerSetup) {
      toast({
        title: "X Layer setup still loading",
        description: "Try again once the contract details appear.",
      });
      return;
    }

    setIsPublishingToXLayer(true);
    try {
      const payload = xLayerPayload ?? await preparePublication(report);
      setPublication(payload);
      setPublishStatus(await preparePublishStatus(report));

      const receipt = await publishToXLayer(payload, xLayerSetup);
      setPublishTxHash(receipt.txHash);
      setPublishExplorerUrl(receipt.explorerUrl);
      setPublishStatus(await finalizePublishStatus(report, {
        txHash: receipt.txHash,
        explorerUrl: receipt.explorerUrl,
        publishedAt: new Date().toISOString(),
      }));

      toast({
        title: "Published to X Layer testnet",
        description: `${receipt.txHash.slice(0, 10)}...${receipt.txHash.slice(-6)}`,
      });
    } catch (error) {
      console.warn("Unable to publish to X Layer", error);
      toast({
        title: "X Layer publish failed",
        description:
          error instanceof Error
            ? error.message
            : "The wallet rejected or could not broadcast the transaction.",
      });
    } finally {
      setIsPublishingToXLayer(false);
    }
  };

  return (
    <main id="report" className="mx-auto max-w-[1480px] px-5 pb-20 pt-10 sm:px-8 lg:px-12 lg:pt-14">
      <section className="grid gap-8 border-b border-[hsl(var(--border))] pb-10 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
        <SectionHeading
          index="02"
          title="Reading the record"
          lead={`${report.summary} The result is split into summary, evidence, and publication so the judging path stays visible.`}
        />

        <aside className="grid gap-3">
          <div className="paper-panel">
            <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Score</div>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div data-testid="text-report-score" className="font-serif text-6xl leading-none text-[hsl(var(--foreground))]">
                {report.score}
                <span className="text-2xl text-[hsl(var(--muted-foreground))]">/100</span>
              </div>
              <div className="text-right">
                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                  {report.status === 'flagged' ? 'Review required' : 'No flags found'}
                </div>
                <div className="mt-2 inline-flex items-center gap-2 border border-[hsl(var(--destructive)/.35)] bg-[hsl(var(--destructive)/.08)] px-3 py-2 font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--destructive))]">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {checkedAt}
                </div>
              </div>
            </div>
            <div className="mt-4 h-px bg-[hsl(var(--border))]" />
            <div className="mt-4 text-xs leading-6 text-[hsl(var(--muted-foreground))]">
              {report.score < 60 ? 'Material gaps in support.' : 'Some language needs context.'}
            </div>
          </div>

          <div className="paper-panel">
            <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Signals</div>
            <div className="mt-2 flex items-end gap-5">
              <div>
                <div data-testid="text-finding-count" className="font-serif text-5xl leading-none text-[hsl(var(--foreground))]">{report.findings.length}</div>
                <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">total findings</div>
              </div>
              <div className="mb-1 h-10 w-px bg-[hsl(var(--border))]" />
              <div>
                <div className="font-serif text-3xl leading-none text-[hsl(var(--destructive))]">{highCount}</div>
                <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">high severity</div>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,.88fr)_minmax(0,1.12fr)]">
        <article className="paper-panel">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">
            <ClipboardCheck size={14} className="text-[hsl(var(--secondary))]" />
            Next move
          </div>
          <p className="mt-4 text-sm leading-7 text-[hsl(var(--foreground))]">
            {highCount
              ? 'Preserve the quoted language, then ask the project to reconcile each promise with its terms.'
              : 'Keep the source text with your research notes and review implied claims manually.'}
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <TypographicLink onClick={() => setShowMethod((visible) => !visible)}>
              {showMethod ? 'Hide method' : 'How this works'}
            </TypographicLink>
            <TypographicLink
              onClick={async () => setPublication(await preparePublication(report))}
            >
              Prepare proof package
            </TypographicLink>
            <TypographicLink
              onClick={async () => setPublishStatus(await preparePublishStatus(report))}
            >
              Check publish readiness
            </TypographicLink>
            <TypographicLink
              onClick={async () => {
                setSaveStatus('saving');
                try {
                  await saveReport(report);
                  await onRecordSaved();
                  setSaveStatus('saved');
                } catch (error) {
                  console.warn(error);
                  setSaveStatus('error');
                }
              }}
            >
              Save research record
            </TypographicLink>
          </div>
          {showMethod && (
            <p className="mt-5 border-t border-[hsl(var(--border))] pt-4 text-xs leading-6 text-[hsl(var(--muted-foreground))]">
              The local ruleset looks for absolute certainty, return promises, protection language, and hands-off framing. It does not determine truth or replace counsel.
            </p>
          )}
          {saveStatus !== 'idle' && (
            <p className="mt-4 text-xs text-[hsl(var(--muted-foreground))]">
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Record saved for later review.' : 'Could not save record.'}
            </p>
          )}
        </article>

        <aside className="paper-panel">
          <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Screening method</div>
            <div className="mt-4 grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-4 border-b border-[hsl(var(--border))] pb-3">
              <span className="text-[hsl(var(--muted-foreground))]">Screening engine</span>
              <AnalysisProviderBadge provider={report.provenance?.provider ?? 'local'} />
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-[hsl(var(--border))] pb-3">
              <span className="text-[hsl(var(--muted-foreground))]">Target chain</span>
              <span className="font-medium text-[hsl(var(--foreground))]">
                {(report.provenance?.network ?? 'xlayer-testnet') === 'xlayer-testnet' ? 'X Layer Testnet' : report.provenance?.network}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-[hsl(var(--border))] pb-3">
              <span className="text-[hsl(var(--muted-foreground))]">Source</span>
              <span className="max-w-[14rem] truncate font-medium text-[hsl(var(--foreground))]">{report.provenance?.sourceLabel ?? 'Browser session'}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[hsl(var(--muted-foreground))]">Onchain status</span>
              <span className="font-mono text-[11px] text-[hsl(var(--foreground))]">
                {publishStatus?.status === 'published' ? 'published' : publishStatus?.status === 'ready' ? 'ready to publish' : 'not published yet'}
              </span>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-10 grid gap-8">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,.7fr)]">
          <div className="paper-panel">
            <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Onchain proof package</div>
            <div className="mt-3 text-sm leading-6 text-[hsl(var(--foreground))]">
              {publishStatus?.status === 'published'
                ? 'Report fingerprint published on X Layer testnet'
                : publishStatus?.status === 'ready'
                  ? 'Ready for wallet signature'
                  : 'Click Prepare proof package or Publish with wallet to create the fingerprints.'}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="border border-[hsl(var(--border))] p-3">
                <div className="font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Report fingerprint</div>
                <div className="mt-2 break-all font-mono text-[11px] text-[hsl(var(--foreground))]">{publishStatus?.payload.reportHash ?? publication?.reportHash ?? 'Not created yet'}</div>
              </div>
              <div className="border border-[hsl(var(--border))] p-3">
                <div className="font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Terms fingerprint</div>
                <div className="mt-2 break-all font-mono text-[11px] text-[hsl(var(--foreground))]">{publishStatus?.payload.officialTermsHash ?? publication?.officialTermsHash ?? 'Not created yet'}</div>
              </div>
              <div className="border border-[hsl(var(--border))] p-3">
                <div className="font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Marketing fingerprint</div>
                <div className="mt-2 break-all font-mono text-[11px] text-[hsl(var(--foreground))]">{publishStatus?.payload.publicMarketingHash ?? publication?.publicMarketingHash ?? 'Not created yet'}</div>
              </div>
              <div className="border border-[hsl(var(--border))] p-3">
                <div className="font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Findings</div>
                <div className="mt-2 text-sm text-[hsl(var(--foreground))]">
                  {publishStatus
                    ? `${publishStatus.payload.findingsCount} total / ${publishStatus.payload.highSeverityCount} high`
                    : publication
                      ? `${publication.findingsCount} total / ${publication.highSeverityCount} high`
                      : 'Awaiting proof'}
                </div>
                <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                  {publishStatus?.payload.timestamp ?? publication?.timestamp ?? 'Timestamp pending'}
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={async () => {
                  if (!xLayerPayload) {
                    toast({
                      title: "Nothing to copy yet",
                      description: "Prepare the proof package first.",
                    });
                    return;
                  }

                  await copyText(JSON.stringify(xLayerPayload, null, 2), "proof package");
                }}
                className="inline-flex items-center justify-center gap-2 border border-[hsl(var(--primary))] px-4 py-2 text-xs font-medium text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))]"
              >
                Copy proof JSON
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!xLayerSetup) {
                    toast({
                      title: "X Layer setup still loading",
                      description: "Try again in a moment.",
                    });
                    return;
                  }

                  await copyText(JSON.stringify(xLayerSetup, null, 2), "X Layer setup");
                }}
                className="inline-flex items-center justify-center gap-2 border border-[hsl(var(--border))] px-4 py-2 text-xs font-medium text-[hsl(var(--foreground))] transition-colors hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]"
              >
                Copy setup JSON
              </button>
            </div>
          </div>

          <div className="paper-panel">
            <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Publish proof</div>
            <p className="mt-2 text-xs leading-6 text-[hsl(var(--muted-foreground))]">
              This sends only fingerprints to X Layer, not the full pasted text. The transaction proves this report existed at publish time.
            </p>
            <div className="mt-3 space-y-3">
              <button
                type="button"
                onClick={publishWithWallet}
                disabled={isPublishingToXLayer || !xLayerReadiness?.ready}
                className="inline-flex w-full items-center justify-between gap-3 border border-[hsl(var(--primary))] px-4 py-3 text-left text-xs font-medium text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{isPublishingToXLayer ? 'Waiting for wallet confirmation' : 'Publish with wallet'}</span>
                {isPublishingToXLayer ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
              </button>
              <input
                value={publishTxHash}
                onChange={(event) => setPublishTxHash(event.target.value)}
                data-testid="input-publish-tx-hash"
                aria-label="Publish transaction hash"
                placeholder="0x..."
                className="w-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground)/.34)]"
              />
              <input
                value={publishExplorerUrl}
                onChange={(event) => setPublishExplorerUrl(event.target.value)}
                data-testid="input-publish-explorer-url"
                aria-label="Publish explorer URL"
                placeholder="https://..."
                className="w-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground)/.34)]"
              />
              <TypographicLink
                onClick={async () => setPublishStatus(await finalizePublishStatus(report, {
                  txHash: publishTxHash.trim(),
                  explorerUrl: publishExplorerUrl.trim() || undefined,
                  publishedAt: new Date().toISOString(),
                }))}
              >
                Mark published on testnet
              </TypographicLink>
            </div>
            <div className="mt-4">
              {xLayerSetup ? (
                <XLayerSetupPanel setup={xLayerSetup} readiness={xLayerReadiness} />
              ) : (
                <div className="rounded-none border border-[hsl(var(--border))] bg-[hsl(var(--card)/.74)] p-4 text-xs leading-6 text-[hsl(var(--muted-foreground))]">
                  Loading X Layer details…
                </div>
              )}
            </div>
          </div>
        </div>

        {publishStatus && (
          <div className="paper-panel">
            <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Publish state</div>
            <div className="mt-2 text-sm font-medium text-[hsl(var(--foreground))]">{publishStatus.nextAction}</div>
            <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
              {publishStatus.status}
              {publishStatus.txHash ? ` / ${publishStatus.txHash}` : ''}
            </div>
          </div>
        )}
      </section>

      <section className="mt-12">
        <SectionHeading
          index="03"
          title="Evidence ledger"
          lead="Each finding is split into claim, counter-record, and plain-language explanation. The order alternates so the page keeps moving without becoming a wall of identical cards."
        />
        <div className="mt-8 space-y-10">
          {report.findings.map((finding, index) => {
            const reversed = index % 2 === 1;
            return (
              <article
                key={`${finding.title}-${index}`}
                data-testid={`card-finding-${index}`}
                className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
              >
                <div className={reversed ? 'xl:order-2' : ''}>
                  <div className="font-mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--muted-foreground))]">
                    0{index + 1} · {finding.severity}
                  </div>
                  <h3 className="mt-2 font-serif text-3xl leading-[1.02] tracking-tight text-[hsl(var(--foreground))] sm:text-[2.25rem]">
                    {finding.title}
                  </h3>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-[hsl(var(--muted-foreground))]">
                    {finding.explanation}
                  </p>
                  <div className="mt-4">
                    <SeverityMark severity={finding.severity} />
                  </div>
                </div>

                <div className={`grid gap-4 ${reversed ? 'xl:order-1' : ''}`}>
                  <div className="border-l-2 border-[hsl(var(--destructive))] pl-4">
                    <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--destructive))]">Marketing says</div>
                    <blockquote className="mt-2 text-sm leading-7 text-[hsl(var(--foreground))]">“{finding.marketingQuote}”</blockquote>
                  </div>
                  <div className="border-l-2 border-[hsl(var(--secondary))] pl-4">
                    <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--secondary))]">Terms say</div>
                    <blockquote className="mt-2 text-sm leading-7 text-[hsl(var(--foreground))]">“{finding.termsQuote}”</blockquote>
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">
                    Rule confidence {finding.confidence}%
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="mt-12 flex flex-col justify-between gap-4 border-t border-[hsl(var(--border))] pt-6 sm:flex-row sm:items-center">
        <p className="max-w-xl text-xs leading-6 text-[hsl(var(--muted-foreground))]">
          <strong className="font-medium text-[hsl(var(--foreground))]">Screening note.</strong> This report is generated by local rules and is intended to focus human review. It is not legal, financial, or investment advice.
        </p>
        <button type="button" onClick={onReset} data-testid="button-run-another" className="inline-flex items-center justify-center gap-2 border border-[hsl(var(--primary))] px-4 py-2.5 text-xs font-medium text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))]">
          <RotateCcw size={14} /> Run another check
        </button>
      </div>
    </main>
  );
}

function RecordsLedger({
  records,
  isLoading,
  onRefresh,
}: {
  records: AnalysisRecord[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
}) {
  const visibleRecords = records.slice(0, 6);

  return (
    <section id="ledger" className="mx-auto max-w-[1480px] px-5 pb-10 sm:px-8 lg:px-12">
      <SectionHeading
        index="04"
        title="Research ledger"
        lead="These records show what the app saved locally or in PostgreSQL, plus the compact hashes prepared for an X Layer publication."
      />

      <div className="mt-8 flex items-center justify-between gap-4 border-b border-[hsl(var(--border))] pb-4">
        <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Latest entries first</div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]"
          data-testid="button-refresh-records"
        >
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
          Refresh ledger
        </button>
      </div>

      {visibleRecords.length === 0 ? (
        <div className="mt-5 paper-panel text-sm text-[hsl(var(--muted-foreground))]">
          No saved records yet. Run a check and save it to populate the ledger.
        </div>
      ) : (
        <>
          <div className="mt-5 hidden overflow-hidden border border-[hsl(var(--border))] md:block">
            <table className="w-full border-collapse">
              <thead className="bg-[hsl(var(--card)/.82)] text-left font-mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="px-4 py-3 font-medium">Session</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Findings</th>
                  <th className="px-4 py-3 font-medium">Chain</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((record) => (
                  <tr key={record.id} className="border-t border-[hsl(var(--border))] align-top">
                    <td className="px-4 py-4">
                      <div className="font-mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">
                        {record.provider} / {record.network}
                      </div>
                      <div className="mt-2 max-w-[34rem] text-sm font-medium text-[hsl(var(--foreground))]">{record.summary}</div>
                      <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{record.checkedAt}</div>
                    </td>
                    <td className="px-4 py-4 font-serif text-3xl leading-none text-[hsl(var(--foreground))]">{record.score}</td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-[hsl(var(--foreground))]">{record.findingsCount} total / {record.highSeverityCount} high</div>
                      <div className="mt-2 text-xs uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">{record.status}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-[hsl(var(--foreground))]">{record.publishedAt ? 'Published' : 'Not published'}</div>
                      <div className="mt-2 break-all text-xs text-[hsl(var(--muted-foreground))]">{record.txHash ? `${record.txHash.slice(0, 12)}...` : 'No transaction yet'}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-4 md:hidden">
            {visibleRecords.map((record) => (
              <article key={record.id} className="paper-panel">
                <div className="font-mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">
                  {record.provider} / {record.network}
                </div>
                <div className="mt-2 text-lg font-semibold text-[hsl(var(--foreground))]">{record.summary}</div>
                <div className="mt-4 grid gap-3">
                  <div className="border border-[hsl(var(--border))] p-3">
                    <div className="font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Score</div>
                    <div className="mt-2 font-serif text-3xl leading-none text-[hsl(var(--foreground))]">{record.score}</div>
                  </div>
                  <div className="border border-[hsl(var(--border))] p-3">
                    <div className="font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Findings</div>
                    <div className="mt-2 text-sm text-[hsl(var(--foreground))]">{record.findingsCount} total / {record.highSeverityCount} high</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Home() {
  const [report, setReport] = useState<Report | null>(null);
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [xLayerSetup, setXLayerSetup] = useState<XLayerSetup | null>(null);
  const [xLayerReadiness, setXLayerReadiness] = useState<XLayerReadiness | null>(null);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const reset = () => setReport(null);

  const refreshRecords = async () => {
    setIsLoadingRecords(true);
    try {
      setRecords(await listRecords());
    } catch (error) {
      console.warn("Unable to load saved records", error);
    } finally {
      setIsLoadingRecords(false);
    }
  };

  const refreshXLayerSetup = async () => {
    try {
      setXLayerSetup(await getXLayerSetup());
    } catch (error) {
      console.warn("Unable to load X Layer setup", error);
    }
  };

  const refreshXLayerReadiness = async () => {
    try {
      setXLayerReadiness(await getXLayerReadiness());
    } catch (error) {
      console.warn("Unable to load X Layer readiness", error);
    }
  };

  useEffect(() => {
    void refreshRecords();
    void refreshXLayerSetup();
    void refreshXLayerReadiness();
  }, []);

  return (
    <div className="noise claims-shell min-h-[100dvh]">
      <Header onReset={reset} />
      <div className="relative">
        {report ? (
          <ReportView
            report={report}
            onReset={reset}
            onRecordSaved={refreshRecords}
            xLayerSetup={xLayerSetup}
            xLayerReadiness={xLayerReadiness}
          />
        ) : (
          <Workspace
            onReport={setReport}
            xLayerSetup={xLayerSetup}
            xLayerReadiness={xLayerReadiness}
          />
        )}
      </div>
      <RecordsLedger records={records} isLoading={isLoadingRecords} onRefresh={refreshRecords} />
      <footer className="mx-auto max-w-[1480px] px-5 pb-8 pt-10 sm:px-8 lg:px-12">
        <div className="border-t border-[hsl(var(--border))] pt-6">
          <p className="max-w-4xl font-serif text-2xl leading-[1.1] text-[hsl(var(--foreground))] sm:text-3xl">
            Claims Checker keeps the record visible, the source explicit, and the publication path legible.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">
            <span>Claims Checker · Open evidence, clearer judgment</span>
            <span className="hidden sm:inline">Ruleset: local / deterministic</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function RoutedErrorBoundary({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <RoutedErrorBoundary><Router /></RoutedErrorBoundary>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
