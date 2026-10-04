import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { financeStyles } from '../../(workspace)/finance/components/FinanceUI';
import { parseAuthorizationRequest } from '@/lib/oauth/authorize';
import { OAUTH_MODULES, type OAuthModule } from '@/lib/oauth/tokens';
import { ConsentButtons } from './ConsentButtons';
import { decideAuthorization } from './actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Authorize access', robots: { index: false, follow: false } };

const MODULE_NAMES: Record<OAuthModule, string> = {
  finance: 'Finance',
  personal: 'Personal',
  tbo: 'The Byte Office',
};

const SCOPE_COPY: Record<string, { label: string; caution?: string }> = {
  'finance:read': { label: 'Read your portfolio, snapshots and monthly ledgers' },
  'finance:write': {
    label: 'Add, edit and remove holdings and ledger entries',
    caution: 'Changes apply immediately, with no confirmation step.',
  },
  'personal:read': { label: 'Read your missed prayer counts and health readings' },
  'personal:write': {
    label: 'Add, edit and remove prayer counts and health readings',
    caution: 'Changes apply immediately, with no confirmation step.',
  },
  'tbo:read': { label: 'Read public company information' },
};

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const query = new URLSearchParams(
    Object.entries(resolved).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, Array.isArray(value) ? (value[0] ?? '') : value] as [string, string]]
    )
  );

  const parsed = await parseAuthorizationRequest(query, await headers());
  if (parsed.status === 'redirect') redirect(parsed.url);
  if (parsed.status === 'error') return <AuthorizeError message={parsed.message} />;

  const { clientName, scopes } = parsed.request;
  const modules = OAUTH_MODULES.map((module) => ({
    module,
    granted: scopes.filter((scope) => scope.startsWith(`${module}:`)),
  })).filter((entry) => entry.granted.length);

  const approve = decideAuthorization.bind(null, true);
  const deny = decideAuthorization.bind(null, false);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-20">
      <div className="w-full max-w-3xl rounded-2xl border border-white/8 bg-slate-900/75 p-7 shadow-2xl backdrop-blur-xl sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Authorize access</p>
        <h1 className="mt-3 text-2xl font-bold text-white">{clientName}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          This application is asking to connect to your workspace through the MCP server. Approving grants exactly what
          is listed below.
        </p>

        <form>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {modules.map(({ module, granted }) => (
              <ModuleConsent key={module} module={module} granted={granted} />
            ))}
          </div>

          <input type="hidden" name="query" value={query.toString()} />
          <ConsentButtons approve={approve} deny={deny} />
        </form>
      </div>
    </div>
  );
}

function ModuleConsent({ module, granted }: { module: OAuthModule; granted: string[] }) {
  return (
    <div className={`${financeStyles.inset} flex flex-col gap-3 p-4`}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{MODULE_NAMES[module]}</p>
      {granted.map((scope) => {
        const copy = SCOPE_COPY[scope];
        const writes = scope.endsWith(':write');
        return (
          <p key={scope} className="flex gap-2.5 text-sm leading-6 text-slate-300">
            <span className={`shrink-0 ${writes ? 'text-rose-300' : 'text-cyan-300'}`}>{writes ? '!' : '•'}</span>
            <span>
              {copy?.label ?? scope}
              {copy?.caution ? (
                <span className="mt-1 block text-xs leading-5 text-rose-300">{copy.caution}</span>
              ) : null}
            </span>
          </p>
        );
      })}
    </div>
  );
}

function AuthorizeError({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-20">
      <div className="w-full max-w-md rounded-2xl border border-rose-400/20 bg-slate-900/75 p-7 shadow-2xl backdrop-blur-xl">
        <h1 className="text-xl font-bold text-white">Cannot authorize this request</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">{message}</p>
        <p className="mt-3 text-xs leading-5 text-slate-600">
          Nothing was sent back to the application: an unverified redirect would leak the request.
        </p>
      </div>
    </div>
  );
}
