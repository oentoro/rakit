// Client-safe AI provider constants; settings.ts holds the DB-backed parts.
export const aiProviders=['gemini','deepseek'] as const;
export type AiProvider=typeof aiProviders[number];
export const providerLabels:Record<AiProvider,string>={gemini:'Gemini',deepseek:'DeepSeek'};
export type AiStatus={provider:AiProvider}&Record<AiProvider,{model:string;hasApiKey:boolean}>;
