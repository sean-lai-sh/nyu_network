import { ConvexError } from "convex/values";

export const BIO_WORD_LIMIT = 200;

const countWords = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
};

export const assertBioWordLimit = (bio: string | undefined) => {
  if (!bio) return;
  if (countWords(bio) > BIO_WORD_LIMIT) {
    throw new ConvexError(`Bio must be ${BIO_WORD_LIMIT} words or fewer.`);
  }
};
