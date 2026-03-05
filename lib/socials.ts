export const CORE_SOCIALS = ["x", "linkedin", "email", "github"] as const;
export const ALL_SOCIALS = [...CORE_SOCIALS] as const;

export type SocialPlatform = (typeof ALL_SOCIALS)[number];

export type SocialInput = {
  platform: SocialPlatform;
  url: string;
};

export const emptySocial = (): SocialInput => ({
  platform: "x",
  url: ""
});
