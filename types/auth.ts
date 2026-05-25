export type AuthSource = 'native' | 'wordpress_bridge';

export interface AuthIdentity {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  authSource: AuthSource;
}

export interface AuthSessionModel {
  token: string;
  identity: AuthIdentity;
  expiresAt?: string;
}
