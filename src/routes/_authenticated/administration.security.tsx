import { createFileRoute, Link } from "@tanstack/react-router";

import { SettingsForm } from "@/components/administration/SettingsForm";
import { Panel } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { KeyRound, ScrollText, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/administration/security")({
  component: SecuritySettingsPage,
});

function SecuritySettingsPage() {
  return (
    <div className="space-y-4">
      <SettingsForm
        section="security"
        groups={[
          {
            title: "Password policy",
            description: "Enforced at sign-up, password change and directory provisioning",
            fields: [
              {
                key: "password_min_length",
                label: "Minimum length",
                type: "number",
                min: 8,
                max: 64,
              },
              {
                key: "password_expiry_days",
                label: "Expiry (days)",
                type: "number",
                min: 0,
                max: 365,
                hint: "0 disables rotation",
              },
              { key: "password_require_symbol", label: "Require a symbol", type: "switch" },
              { key: "password_require_number", label: "Require a number", type: "switch" },
            ],
          },
          {
            title: "Multi-factor and sessions",
            description: "Identity assurance and idle-session handling",
            fields: [
              { key: "mfa_required", label: "Require MFA", type: "switch" },
              {
                key: "mfa_method",
                label: "Preferred MFA method",
                type: "select",
                options: [
                  { value: "totp", label: "Authenticator app (TOTP)" },
                  { value: "sms", label: "SMS one-time code" },
                  { value: "passkey", label: "Passkey / WebAuthn" },
                ],
              },
              {
                key: "session_timeout_minutes",
                label: "Session timeout (minutes)",
                type: "number",
                min: 5,
                max: 1440,
              },
              {
                key: "idle_lock_minutes",
                label: "Idle lock (minutes)",
                type: "number",
                min: 1,
                max: 120,
              },
            ],
          },
          {
            title: "Network and directory",
            description: "Restrict where the console can be reached from and how identity is federated",
            fields: [
              {
                key: "ip_allowlist",
                label: "IP restrictions",
                type: "textarea",
                placeholder: "203.0.113.0/24\n198.51.100.17",
                hint: "One CIDR or address per line. Empty allows all networks.",
              },
              {
                key: "sso_enforced",
                label: "Enforce SSO",
                type: "switch",
                hint: "Block password sign-in once SAML/OIDC mapping is verified",
              },
            ],
          },
          {
            title: "Audit settings",
            description: "How long administrative evidence is retained and how deeply it is captured",
            fields: [
              {
                key: "audit_retention_days",
                label: "Audit retention (days)",
                type: "number",
                min: 30,
                max: 3650,
              },
              {
                key: "log_reads",
                label: "Log read access",
                type: "switch",
                hint: "Record every transcript and credential view, not only changes",
              },
            ],
          },
        ]}
      />

      <Panel title="Related controls" description="Deep governance surfaces live in their own modules">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin/roles">
              <ShieldCheck className="mr-2 size-4" /> Role permissions
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/settings">
              <KeyRound className="mr-2 size-4" /> SSO role mapping
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/audit-logs">
              <ScrollText className="mr-2 size-4" /> Audit logs
            </Link>
          </Button>
        </div>
      </Panel>
    </div>
  );
}
