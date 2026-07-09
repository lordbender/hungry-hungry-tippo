import { pool } from "../database/pool.js";
import type { AppUser, BillingActor, BillingContext, Organization, PromptSession } from "../models/billing.model.js";

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  billing_email: string | null;
  created_at: Date;
};

type AppUserRow = {
  id: string;
  organization_id: string;
  keycloak_subject: string;
  username: string;
  email: string | null;
  roles: string[];
};

type PromptSessionRow = {
  id: string;
  organization_id: string;
  user_id: string;
  client_session_id: string;
  started_at: Date;
  last_seen_at: Date;
};

function toOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    billingEmail: row.billing_email,
    createdAt: row.created_at
  };
}

function toAppUser(row: AppUserRow): AppUser {
  return {
    id: row.id,
    organizationId: row.organization_id,
    keycloakSubject: row.keycloak_subject,
    username: row.username,
    email: row.email,
    roles: row.roles
  };
}

function toPromptSession(row: PromptSessionRow): PromptSession {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    clientSessionId: row.client_session_id,
    startedAt: row.started_at,
    lastSeenAt: row.last_seen_at
  };
}

function requireRow<T>(row: T | undefined): T {
  if (!row) {
    throw new Error("Expected billing context row was not returned.");
  }

  return row;
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return slug || "default-organization";
}

export class BillingContextRepository {
  async resolve(input: { actor?: BillingActor; clientSessionId?: string }): Promise<BillingContext> {
    const actor = input.actor ?? {
      subject: "local-dev-user",
      username: "local-dev-user",
      roles: []
    };
    const organization = await this.upsertOrganization(actor);
    const user = await this.upsertUser({ actor, organizationId: organization.id });
    const session = await this.upsertSession({
      organizationId: organization.id,
      userId: user.id,
      clientSessionId: input.clientSessionId ?? "default-session"
    });

    return { organization, user, session };
  }

  private async upsertOrganization(actor: BillingActor): Promise<Organization> {
    const name = actor.organizationName ?? "Default Organization";
    const slug = actor.organizationSlug ? slugify(actor.organizationSlug) : slugify(name);
    const { rows } = await pool.query<OrganizationRow>(
      `
        insert into organizations (name, slug, billing_email)
        values ($1, $2, $3)
        on conflict (slug) do update
        set name = excluded.name,
            billing_email = coalesce(excluded.billing_email, organizations.billing_email),
            updated_at = now()
        returning id, name, slug, billing_email, created_at
      `,
      [name, slug, actor.billingEmail ?? null]
    );

    return toOrganization(requireRow(rows[0]));
  }

  private async upsertUser(input: { actor: BillingActor; organizationId: string }): Promise<AppUser> {
    const username = input.actor.username ?? input.actor.email ?? input.actor.subject;
    const { rows } = await pool.query<AppUserRow>(
      `
        insert into app_users (organization_id, keycloak_subject, username, email, roles)
        values ($1, $2, $3, $4, $5)
        on conflict (keycloak_subject) do update
        set organization_id = excluded.organization_id,
            username = excluded.username,
            email = excluded.email,
            roles = excluded.roles,
            updated_at = now()
        returning id, organization_id, keycloak_subject, username, email, roles
      `,
      [input.organizationId, input.actor.subject, username, input.actor.email ?? null, input.actor.roles]
    );

    return toAppUser(requireRow(rows[0]));
  }

  private async upsertSession(input: {
    organizationId: string;
    userId: string;
    clientSessionId: string;
  }): Promise<PromptSession> {
    const { rows } = await pool.query<PromptSessionRow>(
      `
        insert into prompt_sessions (organization_id, user_id, client_session_id)
        values ($1, $2, $3)
        on conflict (user_id, client_session_id) do update
        set organization_id = excluded.organization_id,
            last_seen_at = now()
        returning id, organization_id, user_id, client_session_id, started_at, last_seen_at
      `,
      [input.organizationId, input.userId, input.clientSessionId]
    );

    return toPromptSession(requireRow(rows[0]));
  }
}

export const billingContextRepository = new BillingContextRepository();
