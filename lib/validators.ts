import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const pointCreateSchema = z.object({
  lat: z.number().min(-90, 'Latitude must be >= -90').max(90, 'Latitude must be <= 90'),
  lng: z.number().min(-180, 'Longitude must be >= -180').max(180, 'Longitude must be <= 180'),
  title: z.string().min(1, 'Title is required').max(80, 'Title must be at most 80 characters'),
  description: z.string().max(500, 'Description must be at most 500 characters').optional(),
  photoUrl: z.string().url('Photo URL must be a valid URL').optional(),
  category: z.enum(['PLACE', 'FOOD', 'STAY', 'ACTIVITY', 'OTHER']).default('PLACE'),
});

export const tripCreateSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(120, 'Title must be at most 120 characters'),
  description: z.string()
    .max(1000, 'Description must be at most 1000 characters')
    .optional(),
  visibility: z.enum(['PRIVATE', 'FRIENDS', 'UNLISTED']).default('PRIVATE'),
});

export const tripUpdateSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(120, 'Title must be at most 120 characters')
    .optional(),
  description: z.string()
    .max(1000, 'Description must be at most 1000 characters')
    .optional()
    .nullable(),
  visibility: z.enum(['PRIVATE', 'FRIENDS', 'UNLISTED']).optional(),
  coverImageUrl: z.string().url('Cover image URL must be a valid URL').optional().nullable(),
  removeCoverImage: z.boolean().optional(),
});

export const tripPointAddSchema = z.object({
  pointId: z.string().min(1, 'Point ID is required'),
  order: z.number().int().min(0).default(0).optional(),
  note: z.string()
    .max(500, 'Note must be at most 500 characters')
    .optional(),
});

export const tripPointUpdateSchema = z.object({
  order: z.number().int().min(0).optional(),
  note: z.string()
    .max(500, 'Note must be at most 500 characters')
    .optional()
    .nullable(),
});

export const pointUpdateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(80, 'Title must be at most 80 characters').optional(),
  description: z.string().max(500, 'Description must be at most 500 characters').optional().nullable(),
  category: z.enum(['PLACE', 'FOOD', 'STAY', 'ACTIVITY', 'OTHER']).optional(),
  photoUrl: z.string().url('Photo URL must be a valid URL').optional().nullable(),
  removePhoto: z.boolean().optional(),
});

export const profileUpdateSchema = z.object({
  firstName: z.string().max(50, 'First name must be at most 50 characters').optional().nullable(),
  lastName: z.string().max(50, 'Last name must be at most 50 characters').optional().nullable(),
  avatarUrl: z.string().url('Avatar URL must be a valid URL').optional().nullable(),
  removeAvatar: z.boolean().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PointCreateInput = z.infer<typeof pointCreateSchema>;
export type PointUpdateInput = z.infer<typeof pointUpdateSchema>;
export type TripCreateInput = z.infer<typeof tripCreateSchema>;
export type TripUpdateInput = z.infer<typeof tripUpdateSchema>;
export type TripPointAddInput = z.infer<typeof tripPointAddSchema>;
export type TripPointUpdateInput = z.infer<typeof tripPointUpdateSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
