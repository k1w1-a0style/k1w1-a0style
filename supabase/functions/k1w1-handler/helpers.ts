// supabase/functions/k1w1-handler/helpers.ts
// Facade for focused helper modules.

export { corsHeadersForRequest, handleCors } from "../_shared/cors.ts";
export {
  getRequestClientIp,
  getRequestRateLimitSubject,
  requireAiOperatorJwtRoleWithVerifiedActor,
  requireDurableRateLimit,
  rateLimit,
} from "../_shared/auth.ts";
export { parseJsonBody } from "../_shared/validation.ts";

export type { Role, ChatMessage, HandlerRequestBody } from "./helpers/types.ts";
export { DEFAULT_MODELS } from "./helpers/types.ts";

export {
  parseRequestBody,
  resolveProviderModelForRuntime,
  toGeminiContents,
  joinSystemMessages,
  resolveDefaultModelForQuality,
  toPlainPrompt,
} from "./helpers/request.ts";

export { readGeminiTextParts, readAnthropicTextParts } from "./helpers/textParts.ts";

export type { K1w1HandlerErrorCode, K1w1HandlerErrorPayload } from "./helpers/errors.ts";
export { providerHttpError, classifyK1w1HandlerError } from "./helpers/errors.ts";

export { callGroq, callGemini, callOpenAI, callAnthropic, callHuggingFace } from "./helpers/providers.ts";
