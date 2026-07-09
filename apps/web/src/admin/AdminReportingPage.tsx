import AssessmentIcon from "@mui/icons-material/Assessment";
import DescriptionIcon from "@mui/icons-material/Description";
import DownloadIcon from "@mui/icons-material/Download";
import RefreshIcon from "@mui/icons-material/Refresh";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import {
  Alert,
  Box,
  Button,
  Container,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import type { AdminOverviewResponse, Invoice, Organization, OrganizationUsageResponse } from "@hhh/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createInvoice,
  downloadInvoiceReport,
  getAdminOverview,
  getOrganizationUsage,
  listInvoices,
  listOrganizations
} from "../api/client";
import { useAuth } from "../auth/AuthProvider";

type AdminTab = "overview" | "organization" | "invoices";

export function AdminReportingPage() {
  const { getAccessToken } = useAuth();
  const [tab, setTab] = useState<AdminTab>("overview");
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState(today());
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [organizationUsage, setOrganizationUsage] = useState<OrganizationUsageResponse | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const period = useMemo(() => dateRangeToIso(startDate, endDate), [startDate, endDate]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const accessToken = await getAccessToken();
      const [organizationResult, overviewResult, invoiceResult] = await Promise.all([
        listOrganizations(accessToken),
        getAdminOverview({ accessToken, ...period }),
        listInvoices(accessToken)
      ]);
      const nextOrganizations = organizationResult.organizations;
      const nextSelectedOrganizationId =
        selectedOrganizationId || overviewResult.organizations[0]?.organizationId || nextOrganizations[0]?.id || "";

      setOrganizations(nextOrganizations);
      setOverview(overviewResult);
      setInvoices(invoiceResult.invoices);
      setSelectedOrganizationId(nextSelectedOrganizationId);

      if (nextSelectedOrganizationId) {
        setOrganizationUsage(
          await getOrganizationUsage({
            accessToken,
            organizationId: nextSelectedOrganizationId,
            ...period
          })
        );
      } else {
        setOrganizationUsage(null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reporting data could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken, period, selectedOrganizationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function loadOrganizationUsage(organizationId: string) {
    setSelectedOrganizationId(organizationId);
    setError(null);

    try {
      const accessToken = await getAccessToken();
      setOrganizationUsage(await getOrganizationUsage({ accessToken, organizationId, ...period }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Organization usage could not be loaded.");
    }
  }

  async function onCreateInvoice(organizationId = selectedOrganizationId) {
    if (!organizationId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const accessToken = await getAccessToken();
      const invoice = await createInvoice(
        {
          organizationId,
          periodStart: period.from,
          periodEnd: period.to
        },
        accessToken
      );
      setInvoices((current) => [invoice, ...current]);
      setTab("invoices");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invoice could not be created.");
    } finally {
      setIsLoading(false);
    }
  }

  async function onDownloadInvoiceReport(invoiceId: string) {
    setDownloadingInvoiceId(invoiceId);
    setError(null);

    try {
      const accessToken = await getAccessToken();
      const report = await downloadInvoiceReport({ invoiceId, accessToken });
      triggerBlobDownload(report.blob, report.filename);
      const invoiceResult = await listInvoices(accessToken);
      setInvoices(invoiceResult.invoices);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invoice report could not be downloaded.");
    } finally {
      setDownloadingInvoiceId(null);
    }
  }

  return (
    <Box sx={{ py: { xs: 3, md: 5 } }}>
      <Container maxWidth="lg">
        <Stack spacing={3}>
          <Box>
            <Typography component="h1" variant="h4" sx={{ fontWeight: 700 }}>
              Admin Reporting
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              Request, token, session, and invoice reporting by organization.
            </Typography>
          </Box>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
              <TextField
                label="Start"
                type="date"
                size="small"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="End"
                type="date"
                size="small"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <Tooltip title="Refresh reports">
                <span>
                  <IconButton color="primary" disabled={isLoading} onClick={() => void refresh()}>
                    <RefreshIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Paper>

          {error ? <Alert severity="error">{error}</Alert> : null}

          <Paper variant="outlined">
            <Tabs value={tab} onChange={(_event, value: AdminTab) => setTab(value)} sx={{ px: 2, pt: 1 }}>
              <Tab icon={<AssessmentIcon />} iconPosition="start" label="Overview" value="overview" />
              <Tab icon={<DescriptionIcon />} iconPosition="start" label="Organization" value="organization" />
              <Tab icon={<ReceiptLongIcon />} iconPosition="start" label="Invoices" value="invoices" />
            </Tabs>
            <Box sx={{ p: 2 }}>
              {tab === "overview" && overview ? (
                <OverviewScreen
                  overview={overview}
                  isLoading={isLoading}
                  onSelectOrganization={(organizationId) => {
                    void loadOrganizationUsage(organizationId);
                    setTab("organization");
                  }}
                  onCreateInvoice={(organizationId) => void onCreateInvoice(organizationId)}
                />
              ) : null}
              {tab === "organization" ? (
                <OrganizationScreen
                  organizations={organizations}
                  selectedOrganizationId={selectedOrganizationId}
                  usage={organizationUsage}
                  isLoading={isLoading}
                  onSelectOrganization={(organizationId) => void loadOrganizationUsage(organizationId)}
                  onCreateInvoice={() => void onCreateInvoice()}
                />
              ) : null}
              {tab === "invoices" ? (
                <InvoicesScreen
                  invoices={invoices}
                  downloadingInvoiceId={downloadingInvoiceId}
                  onDownloadReport={(invoiceId) => void onDownloadInvoiceReport(invoiceId)}
                />
              ) : null}
            </Box>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}

function OverviewScreen({
  overview,
  isLoading,
  onSelectOrganization,
  onCreateInvoice
}: {
  overview: AdminOverviewResponse;
  isLoading: boolean;
  onSelectOrganization: (organizationId: string) => void;
  onCreateInvoice: (organizationId: string) => void;
}) {
  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Metric label="Requests" value={formatNumber(overview.totals.requestCount)} />
        <Metric label="Total Tokens" value={formatNumber(overview.totals.totalTokens)} />
        <Metric label="Failures" value={formatNumber(overview.totals.failedRequestCount)} />
      </Stack>
      <TableContainer>
        <Table size="small" aria-label="Organization usage overview">
          <TableHead>
            <TableRow>
              <TableCell>Organization</TableCell>
              <TableCell align="right">Requests</TableCell>
              <TableCell align="right">Input</TableCell>
              <TableCell align="right">Cache</TableCell>
              <TableCell align="right">Output</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">Invoice</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {overview.organizations.map((organization) => (
              <TableRow hover key={organization.organizationId}>
                <TableCell>
                  <Button variant="text" onClick={() => onSelectOrganization(organization.organizationId)}>
                    {organization.organizationName}
                  </Button>
                </TableCell>
                <TableCell align="right">{formatNumber(organization.requestCount)}</TableCell>
                <TableCell align="right">{formatNumber(organization.inputTokens)}</TableCell>
                <TableCell align="right">
                  {formatNumber(organization.cacheCreationInputTokens + organization.cacheReadInputTokens)}
                </TableCell>
                <TableCell align="right">{formatNumber(organization.outputTokens)}</TableCell>
                <TableCell align="right">{formatNumber(organization.totalTokens)}</TableCell>
                <TableCell align="right">
                  <Button size="small" disabled={isLoading} onClick={() => onCreateInvoice(organization.organizationId)}>
                    Create
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {overview.organizations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>No usage for this period.</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

function OrganizationScreen({
  organizations,
  selectedOrganizationId,
  usage,
  isLoading,
  onSelectOrganization,
  onCreateInvoice
}: {
  organizations: Organization[];
  selectedOrganizationId: string;
  usage: OrganizationUsageResponse | null;
  isLoading: boolean;
  onSelectOrganization: (organizationId: string) => void;
  onCreateInvoice: () => void;
}) {
  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
        <FormControl size="small" sx={{ minWidth: 260 }}>
          <InputLabel id="organization-select-label">Organization</InputLabel>
          <Select
            labelId="organization-select-label"
            label="Organization"
            value={selectedOrganizationId}
            onChange={(event) => onSelectOrganization(event.target.value)}
          >
            {organizations.map((organization) => (
              <MenuItem key={organization.id} value={organization.id}>
                {organization.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button variant="contained" disabled={!selectedOrganizationId || isLoading} onClick={onCreateInvoice}>
          Create Invoice
        </Button>
      </Stack>

      {usage ? (
        <>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Metric label="Requests" value={formatNumber(usage.totals.requestCount)} />
            <Metric label="Sessions" value={formatNumber(usage.sessions.length)} />
            <Metric label="Total Tokens" value={formatNumber(usage.totals.totalTokens)} />
          </Stack>
          <UsageTable title="Users" rows={usage.users} firstColumn="User" firstValue={(row) => row.username} />
          <UsageTable
            title="Sessions"
            rows={usage.sessions}
            firstColumn="Session"
            firstValue={(row) => `${row.username} / ${row.clientSessionId.slice(0, 12)}`}
          />
          <PromptTable usage={usage} />
        </>
      ) : (
        <Typography color="text.secondary">No organization selected.</Typography>
      )}
    </Stack>
  );
}

function UsageTable<T extends { requestCount: number; totalTokens: number }>({
  title,
  rows,
  firstColumn,
  firstValue
}: {
  title: string;
  rows: T[];
  firstColumn: string;
  firstValue: (row: T) => string;
}) {
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>
        {title}
      </Typography>
      <TableContainer>
        <Table size="small" aria-label={title}>
          <TableHead>
            <TableRow>
              <TableCell>{firstColumn}</TableCell>
              <TableCell align="right">Requests</TableCell>
              <TableCell align="right">Tokens</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={index}>
                <TableCell>{firstValue(row)}</TableCell>
                <TableCell align="right">{formatNumber(row.requestCount)}</TableCell>
                <TableCell align="right">{formatNumber(row.totalTokens)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3}>No rows for this period.</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function PromptTable({ usage }: { usage: OrganizationUsageResponse }) {
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Queries
      </Typography>
      <TableContainer>
        <Table size="small" aria-label="Prompt usage">
          <TableHead>
            <TableRow>
              <TableCell>Created</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Prompt</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Input</TableCell>
              <TableCell align="right">Output</TableCell>
              <TableCell align="right">Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {usage.prompts.map((prompt) => (
              <TableRow key={prompt.promptLogId}>
                <TableCell>{formatDateTime(prompt.createdAt)}</TableCell>
                <TableCell>{prompt.username ?? "Unknown"}</TableCell>
                <TableCell sx={{ maxWidth: 360 }}>{prompt.promptPreview}</TableCell>
                <TableCell>{prompt.status}</TableCell>
                <TableCell align="right">{formatNumber(prompt.inputTokens)}</TableCell>
                <TableCell align="right">{formatNumber(prompt.outputTokens)}</TableCell>
                <TableCell align="right">{formatNumber(prompt.totalTokens)}</TableCell>
              </TableRow>
            ))}
            {usage.prompts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>No queries for this period.</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function InvoicesScreen({
  invoices,
  downloadingInvoiceId,
  onDownloadReport
}: {
  invoices: Invoice[];
  downloadingInvoiceId: string | null;
  onDownloadReport: (invoiceId: string) => void;
}) {
  return (
    <TableContainer>
      <Table size="small" aria-label="Invoices">
        <TableHead>
          <TableRow>
            <TableCell>Invoice</TableCell>
            <TableCell>Organization</TableCell>
            <TableCell>Period</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Requests</TableCell>
            <TableCell align="right">Tokens</TableCell>
            <TableCell align="right">Report</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell>{invoice.invoiceNumber}</TableCell>
              <TableCell>{invoice.organizationName}</TableCell>
              <TableCell>
                {formatDate(invoice.periodStart)} - {formatDate(invoice.periodEnd)}
              </TableCell>
              <TableCell>{invoice.status}</TableCell>
              <TableCell align="right">{formatNumber(invoice.requestCount)}</TableCell>
              <TableCell align="right">{formatNumber(invoice.subtotalTokens)}</TableCell>
              <TableCell align="right">
                <Button
                  size="small"
                  startIcon={<DownloadIcon />}
                  disabled={downloadingInvoiceId === invoice.id}
                  onClick={() => onDownloadReport(invoice.id)}
                >
                  PDF
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {invoices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7}>No invoices have been created.</TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Paper variant="outlined" sx={{ px: 2, py: 1.5, minWidth: 160 }}>
      <Typography color="text.secondary" variant="body2">
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        {value}
      </Typography>
    </Paper>
  );
}

function dateRangeToIso(start: string, end: string) {
  const from = new Date(`${start}T00:00:00.000Z`);
  const to = new Date(`${end}T00:00:00.000Z`);
  to.setUTCDate(to.getUTCDate() + 1);

  return {
    from: from.toISOString(),
    to: to.toISOString()
  };
}

function monthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}
