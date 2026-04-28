/**
 * DI tokens for cross-module access to the session module.
 * Other modules import these tokens (and the matching port interfaces)
 * to inject implementations provided by SessionModule.
 */
export const SESSION_LIFECYCLE = "SESSION_LIFECYCLE";
export const RUNTIME_BINDING_LOOKUP = "RUNTIME_BINDING_LOOKUP";
