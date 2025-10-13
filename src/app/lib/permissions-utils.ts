import type { BaseFlagName, BaseFlagNames } from '@keetanetwork/keetanet-client/lib/permissions';

const KNOWN_BASE_FLAGS = [
  'ACCESS',
  'OWNER',
  'ADMIN',
  'UPDATE_INFO',
  'SEND_ON_BEHALF',
  'TOKEN_ADMIN_CREATE',
  'TOKEN_ADMIN_SUPPLY',
  'TOKEN_ADMIN_MODIFY_BALANCE',
  'STORAGE_CREATE',
  'STORAGE_CAN_HOLD',
  'STORAGE_DEPOSIT',
  'PERMISSION_DELEGATE_ADD',
  'PERMISSION_DELEGATE_REMOVE',
  'MANAGE_CERTIFICATE',
  'MULTISIG_SIGNER',
] as const satisfies ReadonlyArray<BaseFlagName>;

const BASE_FLAG_SET = new Set<BaseFlagName>(KNOWN_BASE_FLAGS);

const isBaseFlagName = (value: unknown): value is BaseFlagName =>
  typeof value === 'string' && BASE_FLAG_SET.has(value as BaseFlagName);

export const toBaseFlagNames = (flags?: readonly string[] | null): BaseFlagNames => {
  if (!flags?.length) {
    return [] as BaseFlagNames;
  }

  const filtered = flags.filter(isBaseFlagName);
  return [...filtered] as BaseFlagNames;
};

export const toOptionalBaseFlagNames = (
  flags?: readonly string[] | null,
): BaseFlagNames | undefined => {
  const normalised = toBaseFlagNames(flags);
  return normalised.length ? normalised : undefined;
};

