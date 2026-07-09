export interface Organization {
  id: string;
  name: string;
  slug: string;
  billingEmail: string | null;
  createdAt: Date;
}

export interface AppUser {
  id: string;
  organizationId: string;
  keycloakSubject: string;
  username: string;
  email: string | null;
  roles: string[];
}

export interface PromptSession {
  id: string;
  organizationId: string;
  userId: string;
  clientSessionId: string;
  startedAt: Date;
  lastSeenAt: Date;
}

export interface BillingActor {
  subject: string;
  username?: string;
  email?: string;
  roles: string[];
  organizationName?: string;
  organizationSlug?: string;
  billingEmail?: string;
}

export interface BillingContext {
  organization: Organization;
  user: AppUser;
  session: PromptSession;
}
