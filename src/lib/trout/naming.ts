import { Filter } from "bad-words";

const NAME_REGEX = /^[a-zA-Z0-9_\-.]+$/;
const NAME_MAX_LENGTH = 20;
const NAME_MIN_LENGTH = 1;

const profanityFilter = new Filter();

export interface NameValidationResult {
  valid: boolean;
  error?: string;
}

export function validateDisplayName(name: string): NameValidationResult {
  if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `Name must be ${NAME_MIN_LENGTH}-${NAME_MAX_LENGTH} characters`,
    };
  }

  if (!NAME_REGEX.test(name)) {
    return {
      valid: false,
      error: "Only letters, numbers, underscores, hyphens, and dots allowed",
    };
  }

  if (profanityFilter.isProfane(name)) {
    return {
      valid: false,
      error: "Name contains inappropriate content",
    };
  }

  return { valid: true };
}
