import { useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Check, CheckCircle2, ChevronDown, ClipboardCheck, FileText, Fingerprint, Info, Loader2, LockKeyhole, RotateCcw, Scale, ShieldCheck, Sparkles, TriangleAlert, X } from 'lucide-react';
import { buildXLayerPublication, type Finding, type AnalysisReport as Report, type Severity } from '@workspace/api-zod';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { listRecords, preparePublication, saveReport, screenClaims, type AnalysisRecord } from '@/lib/analysis-api';

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
    <header className="border-b border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]">
      <div className="mx-auto flex min-h-[76px] max-w-[1480px] items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center border border-[hsl(var(--sidebar-primary)/.55)] bg-[hsl(var(--sidebar-primary)/.12)] text-[hsl(var(--sidebar-primary))]" aria-hidden="true">
            <Fingerprint size={22} strokeWidth={1.8} />
          </div>
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[hsl(var(--sidebar-primary))]">Evidence room / 01</div>
            <div className="mt-0.5 font-serif text-[25px] leading-none tracking-tight">Claims Checker</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 border-l border-[hsl(var(--sidebar-border))] pl-4 text-[11px] uppercase tracking-[0.14em] text-[hsl(var(--sidebar-foreground)/.58)] sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--sidebar-primary))]" />
            Local analysis active
          </div>
          <button type="button" onClick={onReset} data-testid="button-reset-workspace" className="inline-flex items-center gap-2 border border-[hsl(var(--sidebar-border))] px-3 py-2 text-xs text-[hsl(var(--sidebar-foreground)/.72)] transition-colors hover:border-[hsl(var(--sidebar-primary)/.7)] hover:text-[hsl(var(--sidebar-primary))]">
            <RotateCcw size={14} />
            <span className="hidden sm:inline">New check</span>
          </button>
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

function Workspace({ onReport }: { onReport: (report: Report) => void }) {
  const [legalTerms, setLegalTerms] = useState('');
  const [marketingCopy, setMarketingCopy] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState('');

  const canCheck = legalTerms.trim().length > 24 && marketingCopy.trim().length > 24;

  const loadDemo = () => {
    setLegalTerms(demoLegalTerms);
    setMarketingCopy(demoMarketingCopy);
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
        onReport(await screenClaims(legalTerms, marketingCopy));
      } finally {
        setIsChecking(false);
      }
    }, 950);
  };

  return (
    <main className="mx-auto max-w-[1480px] px-5 pb-20 pt-10 sm:px-8 lg:px-12 lg:pt-14">
      <section className="max-w-4xl reveal">
        <div className="mb-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--secondary))]">
          <span className="h-px w-7 bg-[hsl(var(--secondary))]" />
          Compare public language to the record
        </div>
        <h1 className="max-w-3xl font-serif text-5xl leading-[.94] tracking-tight text-[hsl(var(--foreground))] sm:text-7xl">
          Find the promise<br />
          <em className="text-[hsl(var(--destructive))]">behind the promise.</em>
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-[hsl(var(--muted-foreground))] sm:text-lg">
          Put marketing copy beside the official terms. Claims Checker surfaces language that the legal record does not clearly support — before it becomes a research note, a trade, or a headline.
        </p>
      </section>

      <section className="mt-10 grid gap-5 lg:grid-cols-[1fr_1fr_240px] reveal reveal-delay-1">
        <div className="flex min-h-[370px] flex-col border border-[hsl(var(--card-border))] bg-[hsl(var(--card)/.68)] p-5 shadow-[0_8px_30px_hsl(190_28%_16%/.04)] sm:p-6">
          <FieldLabel index="01" count={legalTerms.length}>Official terms</FieldLabel>
          <textarea value={legalTerms} onChange={(event) => setLegalTerms(event.target.value)} data-testid="input-legal-terms" aria-label="Official legal terms" placeholder="Paste the project's terms of use, risk disclosures, or legal conditions here." className="min-h-[280px] flex-1 resize-none border-0 bg-transparent p-0 text-[15px] leading-7 text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground)/.58)] focus:ring-0" />
          <div className="mt-4 flex items-center gap-2 border-t border-dashed border-[hsl(var(--border))] pt-3 text-[11px] text-[hsl(var(--muted-foreground))]">
            <LockKeyhole size={13} />
            Source stays in this browser
          </div>
        </div>
        <div className="flex min-h-[370px] flex-col border border-[hsl(var(--card-border))] bg-[hsl(var(--card)/.68)] p-5 shadow-[0_8px_30px_hsl(190_28%_16%/.04)] sm:p-6">
          <FieldLabel index="02" count={marketingCopy.length}>Public marketing</FieldLabel>
          <textarea value={marketingCopy} onChange={(event) => setMarketingCopy(event.target.value)} data-testid="input-marketing-copy" aria-label="Public marketing copy" placeholder="Paste the landing page, campaign copy, pitch deck language, or social post here." className="min-h-[280px] flex-1 resize-none border-0 bg-transparent p-0 text-[15px] leading-7 text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground)/.58)] focus:ring-0" />
          <div className="mt-4 flex items-center gap-2 border-t border-dashed border-[hsl(var(--border))] pt-3 text-[11px] text-[hsl(var(--muted-foreground))]">
            <FileText size={13} />
            Claims are quoted in the report
          </div>
        </div>
        <aside className="flex flex-col justify-between border border-[hsl(var(--border))] bg-[hsl(var(--primary))] p-5 text-[hsl(var(--primary-foreground))] sm:p-6">
          <div>
            <div className="mb-7 flex items-center justify-between">
              <Scale size={21} strokeWidth={1.6} className="text-[hsl(var(--accent))]" />
              <span className="font-mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary-foreground)/.46)]">POC / v0.1</span>
            </div>
            <h2 className="font-serif text-3xl leading-none">A quiet<br />second look.</h2>
            <p className="mt-4 text-sm leading-6 text-[hsl(var(--primary-foreground)/.64)]">A local ruleset checks absolute promises, implied certainty, and terms that qualify risk.</p>
          </div>
          <div className="mt-8">
            <button type="button" onClick={loadDemo} data-testid="button-load-demo" className="group mb-3 flex w-full items-center justify-between border border-[hsl(var(--primary-foreground)/.25)] px-3 py-3 text-left text-xs text-[hsl(var(--primary-foreground)/.82)] transition-colors hover:border-[hsl(var(--accent)/.8)] hover:text-[hsl(var(--accent))]">
              <span className="flex items-center gap-2"><Sparkles size={14} /> Load example</span>
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
            </button>
            <button type="button" onClick={checkClaims} disabled={isChecking} data-testid="button-check-claims" className="group flex w-full items-center justify-between bg-[hsl(var(--accent))] px-3 py-3.5 text-left text-sm font-semibold text-[hsl(var(--accent-foreground))] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-80">
              <span>{isChecking ? 'Reading the record…' : 'Check claims'}</span>
              {isChecking ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />}
            </button>
          </div>
        </aside>
      </section>

      {error && <div role="alert" data-testid="status-input-error" className="mt-4 flex items-center gap-2 border-l-2 border-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/.08)] px-4 py-3 text-sm text-[hsl(var(--destructive))]"><TriangleAlert size={16} />{error}</div>}

      <div className="mt-9 grid gap-4 border-y border-[hsl(var(--border))] py-5 text-xs text-[hsl(var(--muted-foreground))] sm:grid-cols-3">
        <div className="flex gap-3"><ShieldCheck className="shrink-0 text-[hsl(var(--secondary))]" size={17} /><span><strong className="font-medium text-[hsl(var(--foreground))]">Evidence-led</strong><br />Every flag includes the language behind it.</span></div>
        <div className="flex gap-3"><Fingerprint className="shrink-0 text-[hsl(var(--secondary))]" size={17} /><span><strong className="font-medium text-[hsl(var(--foreground))]">Local by default</strong><br />No provider, API key, or upload required.</span></div>
        <div className="flex gap-3"><Info className="shrink-0 text-[hsl(var(--secondary))]" size={17} /><span><strong className="font-medium text-[hsl(var(--foreground))]">Not legal advice</strong><br />A screening layer for human investigators.</span></div>
      </div>
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

function ReportView({
  report,
  onReset,
  onRecordSaved,
}: {
  report: Report;
  onReset: () => void;
  onRecordSaved: () => Promise<void>;
}) {
  const [openFinding, setOpenFinding] = useState<number | null>(0);
  const [showMethod, setShowMethod] = useState(false);
  const [publication, setPublication] = useState<ReturnType<typeof buildXLayerPublication> | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const checkedAt = useMemo(() => new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(report.checkedAt)), [report.checkedAt]);
  const highCount = report.findings.filter((finding) => finding.severity === 'high').length;

  return (
    <main className="mx-auto max-w-[1480px] px-5 pb-20 pt-10 sm:px-8 lg:px-12 lg:pt-14">
      <section className="flex flex-col justify-between gap-6 border-b border-[hsl(var(--border))] pb-9 sm:flex-row sm:items-end reveal">
        <div>
          <div className="mb-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--secondary))]"><span className="h-px w-7 bg-[hsl(var(--secondary))]" />Screening report / completed</div>
          <h1 className="font-serif text-5xl leading-[.94] tracking-tight sm:text-7xl">The record<br /><em className="text-[hsl(var(--destructive))]">does not agree.</em></h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[hsl(var(--muted-foreground))]">{report.summary} Read each evidence pair before making a judgment.</p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <div data-testid="status-report" className="flex items-center gap-2 border border-[hsl(var(--destructive)/.35)] bg-[hsl(var(--destructive)/.08)] px-3 py-2 font-mono text-[11px] uppercase tracking-[.14em] text-[hsl(var(--destructive))]"><span className="h-1.5 w-1.5 rounded-full bg-current" />{report.status === 'flagged' ? 'Review required' : 'No flags found'}</div>
          <span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">Checked {checkedAt}</span>
        </div>
      </section>

      <section className="grid gap-5 py-8 sm:grid-cols-[220px_1fr_1fr] reveal reveal-delay-1">
        <div className="border border-[hsl(var(--card-border))] bg-[hsl(var(--card)/.68)] p-5">
          <div className="font-mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Alignment score</div>
          <div data-testid="text-report-score" className="mt-3 font-serif text-7xl leading-none text-[hsl(var(--foreground))]">{report.score}<span className="text-3xl text-[hsl(var(--muted-foreground))]">/100</span></div>
          <div className="mt-5 h-1.5 bg-[hsl(var(--muted))]"><div className="h-full bg-[hsl(var(--destructive))] transition-all duration-700" style={{ width: `${report.score}%` }} /></div>
          <div className="mt-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{report.score < 60 ? 'Material gaps in support.' : 'Some language needs context.'}</div>
        </div>
        <div className="border border-[hsl(var(--card-border))] bg-[hsl(var(--card)/.68)] p-5 sm:p-6">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]"><AlertTriangle size={14} className="text-[hsl(var(--destructive))]" /> Signals found</div>
          <div className="mt-5 flex items-end gap-5">
            <div><div data-testid="text-finding-count" className="font-serif text-5xl leading-none">{report.findings.length}</div><div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">total findings</div></div>
            <div className="mb-1 h-10 w-px bg-[hsl(var(--border))]" />
            <div><div className="font-serif text-3xl leading-none text-[hsl(var(--destructive))]">{highCount}</div><div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">high severity</div></div>
          </div>
        </div>
        <div className="border border-[hsl(var(--card-border))] bg-[hsl(var(--primary))] p-5 text-[hsl(var(--primary-foreground))] sm:p-6">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary-foreground)/.55)]"><ClipboardCheck size={14} className="text-[hsl(var(--accent))]" /> Next move</div>
          <p className="mt-5 text-sm leading-6 text-[hsl(var(--primary-foreground)/.76)]">{highCount ? 'Preserve the quoted language, then ask the project to reconcile each promise with its terms.' : 'Keep the source text with your research notes and review implied claims manually.'}</p>
          <button type="button" onClick={() => setShowMethod((visible) => !visible)} data-testid="button-toggle-method" className="mt-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--accent))]">{showMethod ? 'Hide method' : 'How this works'}<ChevronDown size={14} className={showMethod ? 'rotate-180 transition-transform' : 'transition-transform'} /></button>
          <button type="button" onClick={async () => setPublication(await preparePublication(report))} data-testid="button-prepare-publication" className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--accent))]">Prepare X Layer payload</button>
          <button type="button" onClick={async () => {
            setSaveStatus('saving');
            try {
              await saveReport(report);
              await onRecordSaved();
              setSaveStatus('saved');
            } catch (error) {
              console.warn(error);
              setSaveStatus('error');
            }
          }} data-testid="button-save-report" className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--accent))]">Save research record</button>
          {showMethod && <p className="mt-3 border-t border-[hsl(var(--primary-foreground)/.15)] pt-3 text-xs leading-5 text-[hsl(var(--primary-foreground)/.56)]">The local ruleset looks for absolute certainty, return promises, protection language, and hands-off framing. It does not determine truth or replace counsel.</p>}
          {saveStatus !== 'idle' && <p className="mt-3 text-xs text-[hsl(var(--primary-foreground)/.7)]">{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Record saved for later review.' : 'Could not save record.'}</p>}
        </div>
      </section>

      {report.provenance && <section className="grid gap-4 rounded-none border border-[hsl(var(--border))] bg-[hsl(var(--card)/.72)] p-5 reveal reveal-delay-2 sm:grid-cols-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Analysis mode</div>
          <div className="mt-2 text-sm text-[hsl(var(--foreground))]">{report.provenance.provider.toUpperCase()}</div>
          <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Network: {report.provenance.network}</div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Source fingerprint</div>
          <div className="mt-2 text-sm text-[hsl(var(--foreground))]">{report.provenance.sourceLabel ?? 'Browser session'}</div>
          <div className="mt-2 font-mono text-[11px] text-[hsl(var(--foreground))]">Terms {report.provenance.hashes.officialTerms.slice(0, 12)}…</div>
          <div className="mt-1 font-mono text-[11px] text-[hsl(var(--foreground))]">Marketing {report.provenance.hashes.publicMarketing.slice(0, 12)}…</div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">X Layer record</div>
          <div className="mt-2 text-sm text-[hsl(var(--foreground))]">{report.provenance.chainRecord.status === 'published' ? 'Published' : 'Pending'}</div>
          <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{report.provenance.chainRecord.txHash ? report.provenance.chainRecord.txHash.slice(0, 12) + '…' : 'No transaction yet'}</div>
          <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{report.provenance.sourceUrl ?? 'No source URL recorded'}</div>
        </div>
      </section>}

      {publication && <section className="mt-5 border border-[hsl(var(--border))] bg-[hsl(var(--card)/.72)] p-5 reveal reveal-delay-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">X Layer payload</div>
            <div className="mt-2 text-sm text-[hsl(var(--foreground))]">Ready for testnet signing</div>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{publication.network}</div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="border border-[hsl(var(--border))] p-3">
            <div className="font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Report hash</div>
            <div className="mt-2 font-mono text-[11px] break-all text-[hsl(var(--foreground))]">{publication.reportHash}</div>
          </div>
          <div className="border border-[hsl(var(--border))] p-3">
            <div className="font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Terms hash</div>
            <div className="mt-2 font-mono text-[11px] break-all text-[hsl(var(--foreground))]">{publication.officialTermsHash}</div>
          </div>
          <div className="border border-[hsl(var(--border))] p-3">
            <div className="font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Marketing hash</div>
            <div className="mt-2 font-mono text-[11px] break-all text-[hsl(var(--foreground))]">{publication.publicMarketingHash}</div>
          </div>
          <div className="border border-[hsl(var(--border))] p-3">
            <div className="font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Findings</div>
            <div className="mt-2 text-sm text-[hsl(var(--foreground))]">{publication.findingsCount} total / {publication.highSeverityCount} high</div>
            <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{publication.timestamp}</div>
          </div>
        </div>
      </section>}

      <section className="reveal reveal-delay-2">
        <div className="mb-4 flex items-end justify-between">
          <div><div className="font-mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--secondary))]">Evidence ledger</div><h2 className="mt-2 font-serif text-3xl">Where the language breaks</h2></div>
          <div className="hidden font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))] sm:block">Quote / qualify / explain</div>
        </div>
        <div className="space-y-3">
          {report.findings.map((finding, index) => {
            const isOpen = openFinding === index;
            return (
              <article key={`${finding.title}-${index}`} data-testid={`card-finding-${index}`} className={`border bg-[hsl(var(--card)/.72)] transition-colors ${isOpen ? 'border-[hsl(var(--secondary)/.55)]' : 'border-[hsl(var(--card-border))]'}`}>
                <button type="button" onClick={() => setOpenFinding(isOpen ? null : index)} data-testid={`button-toggle-finding-${index}`} className="flex w-full items-center gap-4 p-4 text-left sm:p-5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-[hsl(var(--muted))] font-mono text-xs text-[hsl(var(--muted-foreground))]">0{index + 1}</span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[hsl(var(--foreground))] sm:text-base">{finding.title}</span><span className="mt-1 block truncate text-xs text-[hsl(var(--muted-foreground))]">{finding.marketingQuote}</span></span>
                  <SeverityMark severity={finding.severity} />
                  <ChevronDown size={17} className={`shrink-0 text-[hsl(var(--muted-foreground))] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && <div className="grid gap-4 border-t border-[hsl(var(--border))] px-4 pb-5 pt-4 sm:grid-cols-2 sm:px-[4.5rem]">
                  <div className="border-l-2 border-[hsl(var(--destructive))] pl-4"><div className="font-mono text-[10px] uppercase tracking-[.15em] text-[hsl(var(--destructive))]">Marketing says</div><blockquote className="mt-2 text-sm leading-6 text-[hsl(var(--foreground))]">“{finding.marketingQuote}”</blockquote></div>
                  <div className="border-l-2 border-[hsl(var(--secondary))] pl-4"><div className="font-mono text-[10px] uppercase tracking-[.15em] text-[hsl(var(--secondary))]">Terms say</div><blockquote className="mt-2 text-sm leading-6 text-[hsl(var(--foreground))]">“{finding.termsQuote}”</blockquote></div>
                  <div className="sm:col-span-2"><div className="font-mono text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Investigator's read</div><p className="mt-2 max-w-4xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">{finding.explanation}</p><div className="mt-4 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--secondary))]" /> Rule confidence {finding.confidence}%</div></div>
                </div>}
              </article>
            );
          })}
        </div>
      </section>

      <div className="mt-10 flex flex-col justify-between gap-4 border-t border-[hsl(var(--border))] pt-6 sm:flex-row sm:items-center">
        <p className="max-w-xl text-xs leading-5 text-[hsl(var(--muted-foreground))]"><strong className="font-medium text-[hsl(var(--foreground))]">Screening note.</strong> This report is generated by local rules and is intended to focus human review. It is not legal, financial, or investment advice.</p>
        <button type="button" onClick={onReset} data-testid="button-run-another" className="inline-flex items-center justify-center gap-2 border border-[hsl(var(--primary))] px-4 py-2.5 text-xs font-medium text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))]"><RotateCcw size={14} /> Run another check</button>
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
    <section className="mx-auto max-w-[1480px] px-5 pb-10 sm:px-8 lg:px-12">
      <div className="flex flex-col justify-between gap-4 border-t border-[hsl(var(--border))] pt-6 sm:flex-row sm:items-end">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--secondary))]">Research ledger</div>
          <h2 className="mt-2 font-serif text-3xl text-[hsl(var(--foreground))]">Saved records and publication shells</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">
            These entries show what the app has saved locally or in PostgreSQL, including the compact hashes prepared for an X Layer publication.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center justify-center gap-2 border border-[hsl(var(--primary))] px-4 py-2.5 text-xs font-medium text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))]"
          data-testid="button-refresh-records"
        >
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
          Refresh ledger
        </button>
      </div>

      {visibleRecords.length === 0 ? (
        <div className="mt-5 border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card)/.55)] p-6 text-sm text-[hsl(var(--muted-foreground))]">
          No saved records yet. Run a check and save it to populate the ledger.
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {visibleRecords.map((record) => (
            <article key={record.id} className="border border-[hsl(var(--card-border))] bg-[hsl(var(--card)/.68)] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">
                    {record.provider} / {record.network}
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-[hsl(var(--foreground))]">
                    {record.summary}
                  </h3>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">
                    Score
                  </div>
                  <div className="mt-1 font-serif text-3xl leading-none text-[hsl(var(--foreground))]">
                    {record.score}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="border border-[hsl(var(--border))] p-3">
                  <div className="font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Findings</div>
                  <div className="mt-2 text-sm text-[hsl(var(--foreground))]">
                    {record.findingsCount} total / {record.highSeverityCount} high
                  </div>
                  <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                    {record.status}
                  </div>
                </div>
                <div className="border border-[hsl(var(--border))] p-3">
                  <div className="font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Chain</div>
                  <div className="mt-2 text-sm text-[hsl(var(--foreground))]">
                    {record.publishedAt ? 'Published' : 'Not published'}
                  </div>
                  <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                    {record.txHash ? `${record.txHash.slice(0, 12)}...` : 'No transaction yet'}
                  </div>
                </div>
                <div className="border border-[hsl(var(--border))] p-3 sm:col-span-2">
                  <div className="font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Hashes</div>
                  <div className="mt-2 grid gap-2 text-[11px] font-mono text-[hsl(var(--foreground))]">
                    <div className="break-all">report {record.reportHash}</div>
                    <div className="break-all">terms {record.officialTermsHash}</div>
                    <div className="break-all">marketing {record.publicMarketingHash}</div>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Home() {
  const [report, setReport] = useState<Report | null>(null);
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
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

  useEffect(() => {
    void refreshRecords();
  }, []);

  return (
    <div className="noise claims-shell min-h-[100dvh]">
      <Header onReset={reset} />
      <div className="relative">
        {report ? <ReportView report={report} onReset={reset} onRecordSaved={refreshRecords} /> : <Workspace onReport={setReport} />}
      </div>
      <RecordsLedger records={records} isLoading={isLoadingRecords} onRefresh={refreshRecords} />
      <footer className="mx-auto flex max-w-[1480px] items-center justify-between border-t border-[hsl(var(--border))] px-5 py-5 font-mono text-[9px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))] sm:px-8 lg:px-12">
        <span>Claims Checker / Open evidence, clearer judgment</span>
        <span className="hidden sm:inline">Ruleset: local / deterministic</span>
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
