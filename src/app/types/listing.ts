import { z } from 'zod';

export const ListingStatusSchema = z.enum(['active', 'pending', 'disabled']);
export type ListingStatus = z.infer<typeof ListingStatusSchema>;

export const ListingSchema = z.object({
  address: z.string().min(1, 'Token address required'),
  symbol: z.string().min(1, 'Symbol required'),
  name: z.string().min(1, 'Name required'),
  decimals: z.number().int().min(0).max(36),
  createdAt: z.string().datetime().optional(),
  status: ListingStatusSchema.default('active'),
});
export type Listing = z.infer<typeof ListingSchema>;

export const NewListingSchema = z.object({
  address: z.string().min(1),
  symbol: z.string().min(1),
  name: z.string().min(1),
  decimals: z.number().int().min(0).max(36),
});
export type NewListing = z.infer<typeof NewListingSchema>;

export const ListingsResponseSchema = z.object({
  listings: z.array(ListingSchema),
});
export type ListingsResponse = z.infer<typeof ListingsResponseSchema>;

export const CreateListingResponseSchema = z.object({
  ok: z.literal(true),
  listing: ListingSchema,
});
export type CreateListingResponse = z.infer<typeof CreateListingResponseSchema>;



