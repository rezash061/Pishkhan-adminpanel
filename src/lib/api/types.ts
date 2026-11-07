// DTOs of the AdminApi (backend/openapi/admin.v1.json in rezash061/pishkhan-backend).

export interface StaffSummary {
  id: string;
  username: string;
  roles: string[];
  status: string;
  totpEnabled: boolean;
  createdAt: string;
  /** Last sign-in or token refresh; null if never signed in (backend PR #52). */
  lastActiveAt?: string | null;
  /** Set while locked after 5 failed sign-ins. */
  lockedUntil?: string | null;
}

/** `GET /admin/v1/me/sessions`: one per sign-in. `current` is the session making the request. */
export interface StaffSession {
  id: string;
  startedAt: string;
  lastActiveAt: string;
  expiresAt: string;
  ip: string | null;
  userAgent: string | null;
  current: boolean;
}

export interface CreateStaffRequest {
  username: string;
  password: string;
  roles: string[];
}

export interface HealthReport {
  status: string;
  /** `detail` comes from `/admin/v1/platform/health` (broker count, signature age, lag); `/health/ready` has none. */
  checks: Record<string, { status: string; ms: number; detail?: string | null }>;
}

/** `GET /admin/v1/platform/health`: every dependency of the platform, worst status first in `status`. */
export type PlatformHealthReport = HealthReport;

/** `GET /admin/v1/audit`. Support staff only receive workspace-scoped entries. */
export interface AuditEntry {
  id: string;
  occurredAt: string;
  actorType: "staff" | "user" | "system";
  actorId: string | null;
  actorName: string;
  /** Set when a staff member acted while impersonating this user. */
  onBehalfOf: string | null;
  workspaceId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  reason: string | null;
  ip: string | null;
  before: unknown;
  after: unknown;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** `GET /admin/v1/leads` (SuperAdmin, Support): website waitlist and contact-form submissions. */
export interface Lead {
  id: string;
  type: "waitlist" | "contact" | string;
  phone: string;
  name: string | null;
  instagramHandle: string | null;
  vertical: string | null;
  monthlyDms: string | null;
  message: string | null;
  utm: Record<string, string>;
  /** How many times the same phone submitted this form. */
  submissions: number;
  createdAt: string;
  updatedAt: string;
}

/** `POST /admin/v1/workspaces/{workspaceId}/support-sessions` (Support, step-up). */
export interface StartSupportSessionRequest {
  reason: string;
  userId: string | null;
}

/** A one-time user-panel link. Never stored by the admin panel. */
export interface SupportSessionLink {
  url: string;
  expiresAt: string;
}

/** Workspace status names of `GET /admin/v1/workspaces` (backend PR #19). */
export const WORKSPACE_STATUSES = ["active", "suspended", "pending_deletion", "deleted"] as const;
export const WORKSPACE_INDUSTRIES = ["clothing", "cosmetics", "jewelry", "beauty_clinic", "courses", "other"] as const;

export interface AdminWorkspaceOwner {
  id: string;
  displayName: string | null;
  maskedPhone: string;
}

/** A connected account. `status`: connecting, active, token_expiring, reauth_required, disconnected. */
export interface AdminWorkspaceChannel {
  id: string;
  kind: string;
  username: string | null;
  status: string;
  statusReason: string | null;
  statusChangedAt: string | null;
  tokenExpiresAt: string | null;
  connectedAt: string;
}

/** A row of `GET /admin/v1/workspaces` (SuperAdmin, Support, Finance, ReadOnly). */
export interface AdminWorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  industry: string;
  status: string;
  createdAt: string;
  deletionScheduledFor: string | null;
  owner: AdminWorkspaceOwner | null;
  memberCount: number;
  channels: AdminWorkspaceChannel[];
}

export interface AdminWorkspaceMember {
  userId: string;
  displayName: string | null;
  maskedPhone: string | null;
  /** owner, admin, agent or viewer. */
  role: string;
  joinedAt: string;
}

/** `GET /admin/v1/workspaces/{workspaceId}`. Deleted workspaces are still returned. */
export interface AdminWorkspaceDetail {
  id: string;
  name: string;
  slug: string;
  industry: string;
  timeZone: string;
  status: string;
  planId: string | null;
  /** The current plan (backend PR #24); missing on older backends. `source`: subscription, free or none. */
  plan?: { source: string; planId: string | null; code: string | null; name: string | null; version: number | null; trial: boolean; endsAt: string | null } | null;
  createdAt: string;
  deletionRequestedAt: string | null;
  deletionScheduledFor: string | null;
  deletedAt: string | null;
  owner: AdminWorkspaceOwner | null;
  members: AdminWorkspaceMember[];
  channels: AdminWorkspaceChannel[];
  pendingInvitations: number;
}

export const USER_STATUSES = ["active", "suspended"] as const;

/** A row of `GET /admin/v1/users` (SuperAdmin, Support, Finance, ReadOnly). Also returned by the user actions. */
export interface AdminUserSummary {
  id: string;
  displayName: string | null;
  maskedPhone: string;
  /** active or suspended (blocked). */
  status: string;
  totpEnabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  /** Signed-in devices; support sessions are not counted. */
  activeSessions: number;
}

/** One signed-in device. `id` is the session family, stable across refreshes. */
export interface AdminUserSession {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  ip: string | null;
  userAgent: string | null;
  /** For example otp or otp+totp. */
  authMethods: string;
}

export interface UserMembership {
  workspaceId: string;
  workspaceName: string;
  workspaceStatus: string;
  role: string;
  joinedAt: string;
}

/** `GET /admin/v1/users/{userId}`. */
export interface AdminUserDetail {
  id: string;
  displayName: string | null;
  maskedPhone: string;
  status: string;
  totpEnabled: boolean;
  hasPassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  workspaces: UserMembership[];
  sessions: AdminUserSession[];
}

/** `POST /admin/v1/users/{id}/sessions/revoke`, `/block`, `/unblock` (Support, step-up). */
export interface AdminUserActionRequest {
  reason: string;
}

/** Money in Rial; staff see and type Toman (Rial ÷ 10). */
export interface Money {
  amount: number;
  currency: "IRR";
}

export const PLAN_STATUSES = ["draft", "published", "archived"] as const;
/** Limit meters of a plan; a missing or null limit is unlimited. */
export const BILLING_METERS = ["ai_conversations", "ai_messages", "channel_accounts", "seats", "receipt_verifications", "sms"] as const;

/** One line of the pricing card. */
export interface PlanFeature {
  key: string;
  label: string;
  included: boolean;
  limit: string | null;
}

/** The editable content of a plan version (`PUT /admin/v1/plans/{id}`, and `plan` in `POST /admin/v1/plans`). */
export interface PlanRequest {
  name: string;
  tagline: string | null;
  description: string | null;
  monthly: Money;
  annual: Money | null;
  overagePerConversation: Money | null;
  limits: Record<string, number | null>;
  features: PlanFeature[];
  isPublic: boolean;
  isFree: boolean;
  highlighted: boolean;
  sortOrder: number;
}

/** One version of a plan (backend PR #22). `status`: draft, published, archived. */
export interface Plan extends PlanRequest {
  id: string;
  code: string;
  version: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

/** A subscription. `state`: active, trialing, expired, ended. */
export interface SubscriptionInfo {
  id: string;
  planId: string;
  planCode: string;
  planVersion: number;
  state: string;
  trial: boolean;
  startsAt: string;
  endsAt: string | null;
  endedAt: string | null;
  endReason: string | null;
}

/** The workspace's plan now. `source`: subscription, free (the published free plan) or none (nothing limited). */
export interface CurrentPlan {
  source: string;
  planId: string | null;
  planCode: string | null;
  planName: string | null;
  planVersion: number | null;
  trial: boolean;
  endsAt: string | null;
  limits: Record<string, number | null>;
  subscription: SubscriptionInfo | null;
}

export interface UsageMeter {
  meter: string;
  used: number;
  limit: number | null;
}

/** `GET /admin/v1/workspaces/{id}/billing` (backend PR #23). History is newest first. */
export interface AdminWorkspaceBilling {
  current: CurrentPlan;
  usage: { periodStart: string; periodEnd: string; meters: UsageMeter[] };
  history: SubscriptionInfo[];
}

/** `POST /admin/v1/workspaces/{id}/subscription`: `endsAt` or `days` (1 to 1095) or neither (until cancelled; not for a trial). */
export interface GrantPlanRequest {
  planId: string;
  trial: boolean;
  endsAt: string | null;
  days: number | null;
  reason: string;
}

// ---- AI operations (backend PR #24, /admin/v1/ai) ----

/** A provider in effect. `source`: configuration or database. `kind`: openai (any OpenAI-compatible API) or fake. */
export interface AiProvider {
  name: string;
  kind: string;
  baseUrl: string | null;
  hasApiKey: boolean;
  enabled: boolean;
  source: string;
  lastTestError: string | null;
  lastTestedAt: string | null;
}

/** `PUT /ai/providers/{name}` (SuperAdmin, step-up). `apiKey` null keeps the stored key. */
export interface AiProviderRequest {
  kind: string;
  baseUrl: string | null;
  apiKey: string | null;
  clearApiKey: boolean;
  enabled: boolean;
  reason: string;
}

export interface AiProviderTestResult {
  ok: boolean;
  error: string | null;
  latencyMs: number;
}

/** One step of a task's fallback chain. Prices are Rial per million tokens. */
export interface AiRouteStep {
  provider: string;
  model: string;
  temperature: number | null;
  maxOutputTokens: number | null;
  timeoutSeconds: number;
  inputPricePerMillion: number | null;
  outputPricePerMillion: number | null;
}

/** `source`: database, configuration or none. */
export interface AiTaskRoutes {
  task: string;
  source: string;
  routes: AiRouteStep[];
}

export const AI_TASKS = ["classify", "generate_reply", "extract_receipt", "transcribe", "embed", "summarize", "content"] as const;

export interface PromptKey {
  key: string;
  activeVersion: string;
  activeSource: string;
  versionCount: number;
}

/** `finglish_gap` (BE-2.3) is present only when the set has both Finglish and Persian-script cases. */
export interface EvalGateCheck {
  name: string;
  required: number;
  actual: number | null;
  passed: boolean;
}

/** `status`: running, completed or failed. */
export interface EvalRun {
  id: string;
  setId: string;
  setName: string;
  task: string;
  promptKey: string;
  promptVersion: string;
  route: string | null;
  status: string;
  caseCount: number;
  errorCount: number;
  intentAccuracy: number | null;
  inputTokens: number;
  outputTokens: number;
  startedAt: string;
  finishedAt: string | null;
  gate: { passed: boolean; checks: EvalGateCheck[] };
  /** Cases the backend read as Finglish (backend PR #44, BE-2.3); missing on older backends. */
  finglishCaseCount?: number;
  /** Intent accuracy over the Finglish cases; null when there were none. */
  finglishIntentAccuracy?: number | null;
  /** Intent accuracy over the Persian-script (non-Finglish) cases; null when there were none. */
  scriptIntentAccuracy?: number | null;
}

export interface PromptVersion {
  key: string;
  version: string;
  text: string;
  source: string;
  baseVersion: string | null;
  active: boolean;
  createdAt: string | null;
  latestRun: EvalRun | null;
}

export interface EvalResult {
  caseId: string;
  ref: string;
  vertical: string | null;
  input: string;
  expectedIntent: string | null;
  predictedIntent: string | null;
  correct: boolean | null;
  route: string | null;
  latencyMs: number;
  error: string | null;
}

export interface EvalRunDetail {
  run: EvalRun;
  results: EvalResult[];
}

export interface EvalSet {
  id: string;
  name: string;
  description: string | null;
  caseCount: number;
  updatedAt: string;
}

export interface EvalImportReport {
  imported: number;
  updated: number;
  errors: string[];
}

/** The prompt the eval runner can score (backend PR #24). */
export const EVAL_PROMPT_KEY = "intent.classify";

// ---- Website CMS (backend PR #31, /admin/v1/content) ----

export const CONTENT_KINDS = ["page", "post", "help", "case_study", "legal", "faq"] as const;
export const CONTENT_STATUSES = ["draft", "published", "archived"] as const;

/** A body block: an object with an allowed `type`; strings are plain text. */
export type ContentBlock = { type: string } & Record<string, unknown>;

export interface ContentEntrySummary {
  id: string;
  kind: string;
  slug: string;
  status: string;
  title: string;
  category: string | null;
  revision: number;
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  scheduledAt: string | null;
  updatedAt: string;
}

/** The fields are the draft; `hasUnpublishedChanges` says whether it differs from the published copy. */
export interface ContentEntry extends ContentEntrySummary {
  description: string | null;
  author: string | null;
  body: ContentBlock[];
  data: Record<string, unknown>;
  publishedRevision: number | null;
  firstPublishedAt: string | null;
  createdAt: string;
}

export interface ContentEntryRequest {
  kind?: string;
  slug: string;
  title: string;
  description: string | null;
  category: string | null;
  author: string | null;
  body: ContentBlock[];
  data: Record<string, unknown>;
  revision?: number;
}

export interface ContentCategory {
  id: string;
  kind: string;
  slug: string;
  title: string;
  description: string | null;
  sortOrder: number;
}

export interface ContentRedirect {
  id: string;
  from: string;
  to: string;
  permanent: boolean;
  createdAt: string;
}

// ---- Industry templates (backend PR #40, /admin/v1/industry-templates) ----

export const TEMPLATE_STATUSES = ["draft", "published", "archived"] as const;
/** Workspace industries a template can be made for (Tenancy `Workspace.Industries`). */
export const TEMPLATE_INDUSTRIES = WORKSPACE_INDUSTRIES;
/** The AI agent's tones (Agent module). */
export const AGENT_TONES = ["friendly", "formal", "playful"] as const;

/** A fact every shop of the industry should give the AI (knowledge score). */
export interface TemplateRequiredFact {
  key: string;
  label: string;
  prompt: string;
}

/** Answers may hold blanks such as «[مبلغ] تومان» for the owner to fill in. */
export interface TemplateFaq {
  key: string;
  question: string;
  answer: string;
}

/** `graph` is in the flows API's shape (`start`, `nodes`, `edges`). */
export interface TemplateFlow {
  key: string;
  name: string;
  graph: unknown;
}

/** In the rules API's shape, except that `start_flow` names its flow with `flowKey`. */
export interface TemplateRule {
  key: string;
  name: string;
  triggerKind: string;
  trigger: unknown;
  actions: unknown;
  priority: number;
}

export interface TemplateAgentProfile {
  name: string;
  /** friendly, formal or playful. */
  tone: string;
  brandVoice: string | null;
  neverSay: string[];
  handoffKeywords: string[];
}

export interface TemplateContent {
  requiredFacts: TemplateRequiredFact[];
  faqs: TemplateFaq[];
  flows: TemplateFlow[];
  rules: TemplateRule[];
  agentProfile: TemplateAgentProfile | null;
}

/** `PUT /industry-templates/{id}` and `template` in `POST /industry-templates`. */
export interface TemplateRequest {
  name: string;
  description: string | null;
  content: TemplateContent;
}

/**
 * One version of an industry template. `status`: draft, published, archived. `issues` are content problems such as
 * `rules[size-keyword]: template.flow_key_unknown`; a draft with issues can be saved but not published.
 */
export interface IndustryTemplate {
  id: string;
  industry: string;
  version: number;
  status: string;
  name: string;
  description: string | null;
  content: TemplateContent;
  issues: string[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

// ---- Instagram outage mode (backend PR #47, BE-2.7 part 1, /admin/v1/platform/outage) ----

/** auto: the detector decides; forced_down: staff declared Instagram down; forced_up: staff cancelled the alarm. */
export const OUTAGE_MODES = ["auto", "forced_down", "forced_up"] as const;

/** `GET /admin/v1/platform/outage`. `status`: up or down. `ok` and `failed` are Graph API calls over the last `windowMinutes`. */
export interface AdminOutage {
  kind: string;
  status: string;
  mode: string;
  since: string;
  modeReason: string | null;
  ok: number;
  failed: number;
  windowMinutes: number;
}

/** `PUT /admin/v1/platform/outage` (Support or SuperAdmin, step-up). `reason`: 5 to 300 characters. */
export interface OutageModeRequest {
  mode: string;
  reason: string;
}

// ---- File quarantine (AD-1.6, /admin/v1/files) ----

/** Filters of `GET /admin/v1/files/quarantine`; "" is the default view (infected, scan_failed and stuck pending files). */
export const QUARANTINE_FILTERS = ["infected", "scan_failed", "pending", "rejected"] as const;

/** A file that is not usable. There is never a download link. `stuck`: pending for more than 10 minutes. */
export interface QuarantineFile {
  id: string;
  workspaceId: string;
  workspaceName: string | null;
  purpose: string;
  status: string;
  contentType: string;
  size: number;
  originalName: string | null;
  signature: string | null;
  scanEngineVersion: string | null;
  rejectReason: string | null;
  scanAttempts: number;
  createdAt: string;
  scannedAt: string | null;
  falsePositiveAt: string | null;
  stuck: boolean;
}

/** `GET /admin/v1/files/quarantine/summary`; `pending` counts stuck files only. */
export interface QuarantineSummary {
  infected: number;
  scanFailed: number;
  pending: number;
  rejected: number;
}

// ---- Kafka, dead letters, workers (AD-1.7, /admin/v1/platform) ----

export interface KafkaTopic {
  name: string;
  exists: boolean;
  partitions: number;
  messages: number;
  retentionDays: number;
  keyDescription: string;
  isDlq: boolean;
}

export interface KafkaPartitionLag {
  partition: number;
  committed: number | null;
  end: number;
  lag: number;
}

export interface KafkaGroupTopicLag {
  topic: string;
  lag: number;
  partitions: KafkaPartitionLag[];
}

/** A worker group (Kafka consumer group). `state` as Kafka reports it: Stable, Empty, Dead, PreparingRebalance... */
export interface KafkaGroup {
  group: string;
  state: string;
  members: number;
  lag: number;
  topics: KafkaGroupTopicLag[];
}

/** `GET /admin/v1/platform/kafka` (cached 15 s by the backend; 503 `platform.kafka_unavailable`). */
export interface KafkaOverview {
  at: string;
  topics: KafkaTopic[];
  groups: KafkaGroup[];
}

export const DEAD_LETTER_STATUSES = ["open", "replayed", "discarded", "all"] as const;

export interface DeadLetter {
  id: string;
  messageId: string;
  topic: string;
  group: string;
  consumer: string;
  key: string;
  type: string;
  workspaceId: string | null;
  exceptionType: string;
  exceptionMessage: string;
  attempts: number;
  failedAt: string;
  status: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionReason: string | null;
  replayMessageId: string | null;
}

export interface DeadLetterDetail {
  deadLetter: DeadLetter;
  envelope: unknown;
}

export interface DeadLetterGroupCount {
  group: string;
  open: number;
  oldestOpenAt: string | null;
}

/** `POST /admin/v1/platform/dead-letters/{replay|discard}`: `skipped` holds ids that were unknown or no longer open. */
export interface DeadLetterActionResponse {
  done: number;
  skipped: string[];
}

export interface WorkerInstance {
  instanceId: string;
  lastCheckinAt: string;
  checkinIntervalSeconds: number;
  alive: boolean;
}

/** `state` as Quartz keeps it: WAITING, ACQUIRED, EXECUTING, BLOCKED, PAUSED, ERROR. */
export interface RecurringJob {
  name: string;
  cron: string | null;
  state: string;
  nextFireAt: string | null;
  previousFireAt: string | null;
}

export interface WorkersOverview {
  instances: WorkerInstance[];
  jobs: RecurringJob[];
  groups: { group: string; state: string; members: number; lag: number }[];
}

// ---- Feature flags (AD-1.8, /admin/v1/feature-flags) ----

export interface FeatureFlag {
  key: string;
  description: string | null;
  enabled: boolean;
  rolloutPercent: number;
  plans: string[];
  overrides: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

export interface FeatureFlagRequest {
  key?: string;
  description: string | null;
  enabled: boolean;
  rolloutPercent: number;
  plans: string[];
  reason: string;
}

/** `source`: override, rollout, plan (not on the workspace's plan), off (flag disabled) or rollout_excluded. */
export interface WorkspaceFeatureFlag {
  key: string;
  description: string | null;
  effective: boolean;
  source: string;
  override: boolean | null;
  overrideReason: string | null;
  overriddenAt: string | null;
  overriddenBy: string | null;
}

/** `GET /admin/v1/ai/traces`: a trace without customer content. */
export interface AdminTraceSummary {
  id: string;
  workspaceId: string;
  conversationId: string;
  intent: string | null;
  language: string | null;
  outcome: string;
  handoffReason: string | null;
  confidence: number | null;
  threshold: number;
  prompts: string | null;
  models: string | null;
  inputTokens: number;
  outputTokens: number;
  costIrr: number;
  latencyMs: number;
  toolCallCount: number;
  guardIssueCount: number;
  createdAt: string;
}

export interface TraceFact {
  chunkId: string;
  sourceId: string;
  sourceKind: string;
  title: string;
  score: number;
  similarity: number | null;
}

/** Content fields are null while `redacted`; `POST .../reveal` with a reason fills them and is audited. */
export interface AdminTraceDetail {
  trace: AdminTraceSummary;
  redacted: boolean;
  messageId: string;
  flowRunId: string | null;
  goal: string | null;
  input: string | null;
  reply: string | null;
  sentiment: string | null;
  classifierConfidence: number | null;
  selfConfidence: number | null;
  facts: TraceFact[];
  toolCalls: { name: string; arguments: string | null; result: string | null; error: string | null }[];
  guardIssues: { attempt: number; kind: string; detail: string }[];
}

export interface AdminTraceStats {
  from: string;
  total: number;
  outcomes: Record<string, number>;
  lowConfidence: number;
  withGuardIssues: number;
  costIrr: number;
}

export const TRACE_OUTCOMES = ["sent", "handed_off", "failed"] as const;

/** `GET /admin/v1/dashboard`. A null number means its source could not be read. Money in Rial. */
export interface DashboardKpis {
  activeWorkspaces: number | null;
  signupsToday: number | null;
  signups7d: number | null;
  payingWorkspaces: number | null;
  mrrRial: number | null;
  aiRepliesToday: number | null;
  handoffRateToday: number | null;
  quarantinedFiles: number | null;
  openDeadLetters: number | null;
  maxConsumerLag: number | null;
  channelsNeedingReauth: number | null;
  instagramStatus: string | null;
}

export interface DashboardAlert {
  code: "instagram_down" | "kafka_unavailable" | "consumer_lag" | "dead_letters" | "workers_down" | "quarantine" | "channels_reauth" | "ai_failures" | (string & {});
  severity: "warning" | "danger";
  count: number | null;
  subject: string | null;
}

export interface DashboardResponse {
  at: string;
  kpis: DashboardKpis;
  alerts: DashboardAlert[];
}

// Billing across workspaces (`/admin/v1/billing`, backend PR #54). Amounts in Rial.

export const SUBSCRIPTION_STATES = ["current", "trialing", "scheduled", "ended", "all"] as const;
export const PAYMENT_STATUSES = ["paid", "pending", "failed", "expired", "all"] as const;
export const CHECKOUT_KINDS = ["new", "renewal", "upgrade", "downgrade"] as const;

/** A subscription as the billing endpoints return it: `state` active, trialing, scheduled, expired or ended. */
export interface BillingSubscription extends SubscriptionInfo {
  cycle: string | null;
  checkoutId: string | null;
}

export interface AdminSubscriptionRow {
  subscription: BillingSubscription;
  workspaceId: string;
  workspaceName: string | null;
}

/** A Zarinpal checkout and its invoice once paid. `refunded` is the sum of its refunds. `status`: pending, paid, failed or expired. */
export interface AdminPayment {
  id: string;
  workspaceId: string;
  workspaceName: string | null;
  kind: string;
  planCode: string;
  planName: string;
  planVersion: number;
  cycle: string | null;
  price: number;
  credit: number;
  amount: number;
  refunded: number;
  status: string;
  referenceId: string | null;
  cardMask: string | null;
  error: string | null;
  invoiceNumber: number | null;
  subscriptionId: string | null;
  createdAt: string;
  paidAt: string | null;
  /** Coupon discount, Rial. */
  discount: number;
  couponCode: string | null;
  /** Paid from the workspace's wallet, Rial. */
  walletUsed: number;
  /** The wallet part was given back (failed, expired or refunded). */
  walletReleased: boolean;
}

export interface AdminRefund {
  id: string;
  checkoutId: string;
  amount: number;
  reason: string;
  referenceId: string | null;
  endedSubscription: boolean;
  /** Staff username. */
  createdBy: string | null;
  createdAt: string;
  /** Paid into the workspace's wallet instead of through Zarinpal. */
  toWallet: boolean;
  /** The checkout's wallet part given back with it, Rial. */
  walletReturned: number;
}

export interface AdminPaymentDetail {
  payment: AdminPayment;
  refunds: AdminRefund[];
  subscription: BillingSubscription | null;
}

/** `POST /admin/v1/billing/payments/{id}/refunds` (Finance, step-up): records money paid back in Zarinpal's panel. */
export interface RefundRequest {
  amount: number;
  reason: string;
  referenceId?: string | null;
  endSubscription: boolean;
  toWallet?: boolean;
}

export interface BillingSummary {
  days: number;
  paidCount: number;
  paidAmount: number;
  refundCount: number;
  refundedAmount: number;
  netAmount: number;
  failedCount: number;
  pendingCount: number;
}

// Coupons and wallets (backend PR #55).

export const COUPON_KINDS = ["percent", "fixed"] as const;
export const COUPON_STATES = ["active", "scheduled", "expired", "used_up", "disabled"] as const;

/** `value`: percent (1 to 100) or Rial. `planCodes` empty means every plan. */
export interface AdminCoupon {
  id: string;
  code: string;
  description: string | null;
  kind: string;
  value: number;
  planCodes: string[];
  firstPurchaseOnly: boolean;
  maxRedemptions: number | null;
  maxPerWorkspace: number;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
  state: string;
  redemptions: number;
  /** Rial. */
  discountTotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface CouponRedemption {
  checkoutId: string;
  workspaceId: string;
  workspaceName: string | null;
  discount: number;
  invoiceNumber: number | null;
  createdAt: string;
}

export interface AdminCouponDetail {
  coupon: AdminCoupon;
  redemptions: CouponRedemption[];
}

/** Everything but `code`, `kind` and `value` can change later. */
export interface CouponRequest {
  code?: string;
  kind?: string;
  value?: number;
  description: string | null;
  planCodes: string[];
  firstPurchaseOnly: boolean;
  maxRedemptions: number | null;
  maxPerWorkspace: number;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
}

/** `kind`: top_up, adjustment, refund, checkout or released. `amount` is signed Money. */
export interface WalletEntry {
  id: string;
  kind: string;
  amount: Money;
  balanceAfter: Money;
  reason: string | null;
  checkoutId: string | null;
  actorKind: string;
  createdAt: string;
}

export interface WalletInfo {
  balance: Money;
  entries: WalletEntry[];
}

// Support tickets and announcements (backend /admin/v1/support/tickets, /admin/v1/announcements; AD-2.6).

export const TICKET_STATUSES = ["open", "answered", "closed"] as const;
export const TICKET_CATEGORIES = ["billing", "technical", "instagram", "ai", "other"] as const;

/** `status` open (waiting on Pishkhan), answered (waiting on the seller) or closed. `lastMessageBy` seller or staff. */
export interface AdminTicket {
  id: string;
  number: number;
  workspaceId: string;
  workspaceName: string | null;
  subject: string;
  category: string;
  status: string;
  lastMessageBy: string;
  messageCount: number;
  assignedTo: string | null;
  assignedToName: string | null;
  createdBy: string;
  lastMessageAt: string;
  createdAt: string;
  closedAt: string | null;
}

export interface AdminTicketMessage {
  id: string;
  authorKind: "seller" | "staff" | string;
  authorId: string;
  authorName: string | null;
  body: string;
  createdAt: string;
}

export interface AdminTicketDetail {
  ticket: AdminTicket;
  messages: AdminTicketMessage[];
}

export interface TicketCounts {
  open: number;
  answered: number;
  closed: number;
  unassigned: number;
  mine: number;
}

export const ANNOUNCEMENT_SEVERITIES = ["info", "warning", "critical"] as const;
export const ANNOUNCEMENT_STATES = ["scheduled", "active", "ended"] as const;

export interface AdminAnnouncement {
  id: string;
  title: string;
  body: string | null;
  severity: string;
  link: string | null;
  startsAt: string;
  endsAt: string | null;
  state: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** `startsAt` null means now. */
export interface AnnouncementRequest {
  title: string;
  body: string | null;
  severity: string;
  link: string | null;
  startsAt: string | null;
  endsAt: string | null;
}

// SMS provider, SMS log and Bale bots (backend /admin/v1/platform/messaging, /sms, /bale; AD-2.4).

export const SMS_PURPOSES = ["otp", "invitation", "notification", "campaign", "test", "other"] as const;

export interface SmsProviderStatus {
  provider: string;
  configured: boolean;
  otpTemplate: string | null;
  /** Rial, when the provider reports it. */
  credit: number | null;
  error: string | null;
}

export interface MessagingOverview {
  sms: { provider: SmsProviderStatus; last24Hours: { sent: number; failed: number; byPurpose: Record<string, number> } };
  bale: { apiBaseUrl: string; webhookBaseUrl: string; webhookSecretSet: boolean; bots: Record<string, number> };
}

/** The text is never kept; `phone` is masked. */
export interface SmsLogItem {
  id: string;
  createdAt: string;
  purpose: string;
  workspaceId: string | null;
  workspaceName: string | null;
  phone: string;
  provider: string;
  status: "sent" | "failed" | string;
  error: string | null;
  segments: number;
  template: string | null;
}

export interface AdminBaleBot {
  id: string;
  workspaceId: string;
  workspaceName: string | null;
  botId: string;
  username: string | null;
  displayName: string | null;
  status: string;
  statusReason: string | null;
  statusChangedAt: string | null;
  createdAt: string;
}

/** `result`: ok, invalid_token or unavailable. */
export interface BaleCheckResult {
  bot: AdminBaleBot;
  result: string;
}

/** GET /admin/v1/platform/meta-app: the Meta app's settings (secrets only as set or not), webhook deliveries and accounts. */
export interface MetaApp {
  appId: string;
  apiVersion: string;
  graphBaseUrl: string;
  redirectUri: string;
  appSecretSet: boolean;
  webhookVerifyTokenSet: boolean;
  scopes: string[];
  webhookFields: string[];
  /** Deliveries by result over the last 24 hours (accepted, duplicate, ignored, bad_signature, bad_json, too_large, produce_failed), and when each was last seen. */
  webhooks: { last24Hours: Record<string, number>; lastSeen: Record<string, string> };
  /** Instagram accounts by status. */
  accounts: Record<string, number>;
  tokensExpiringSoon: number;
}
