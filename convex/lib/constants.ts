export const CORE_SOCIAL_PLATFORMS = ["x", "linkedin", "email", "github"] as const;
export const ALL_SOCIAL_PLATFORMS = [...CORE_SOCIAL_PLATFORMS] as const;

export type SocialPlatform = (typeof ALL_SOCIAL_PLATFORMS)[number];
