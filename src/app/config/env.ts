import { z } from 'zod';

const EnvSchema = z.object({
  NEXT_PUBLIC_LISTING_FEE_KTA: z.string().regex(/^\d+(\.\d+)?$/, 'Numeric string value'),
  NEXT_PUBLIC_LISTING_FEE_RECIPIENT: z.string().min(1),
  NEXT_PUBLIC_KTA_TOKEN_PUBKEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export const env = EnvSchema.parse({
  NEXT_PUBLIC_LISTING_FEE_KTA: process.env.NEXT_PUBLIC_LISTING_FEE_KTA ?? '1',
  NEXT_PUBLIC_LISTING_FEE_RECIPIENT: process.env.NEXT_PUBLIC_LISTING_FEE_RECIPIENT ?? 'keeta_aab54c5hvzaam3d47sqk36p2nskzenlnyz5mbwehzqkv33emcphtcurc65fcw4a',
  NEXT_PUBLIC_KTA_TOKEN_PUBKEY: process.env.NEXT_PUBLIC_KTA_TOKEN_PUBKEY,
});


