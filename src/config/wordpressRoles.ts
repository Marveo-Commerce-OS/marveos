export type WordPressRoleKey =
  | 'owner'
  | 'administrator'
  | 'shop_manager'
  | 'editor'
  | 'author'
  | 'contributor'
  | 'subscriber';

export type WordPressRoleOption = {
  value: WordPressRoleKey;
  label: string;
  locked?: boolean;
};

export const WORDPRESS_ROLE_OPTIONS: WordPressRoleOption[] = [
  { value: 'owner', label: 'Owner / Super Admin', locked: true },
  { value: 'administrator', label: 'Administrator' },
  { value: 'shop_manager', label: 'Shop Manager' },
  { value: 'editor', label: 'Editor' },
  { value: 'author', label: 'Author' },
  { value: 'contributor', label: 'Contributor' },
  { value: 'subscriber', label: 'Subscriber' },
];

export const WORDPRESS_ROLE_VALUES = WORDPRESS_ROLE_OPTIONS.map((option) => option.value);