// @monitor/web-domain — pure domain layer for the web surface.
//
// This package holds framework-free code: domain types, timeline layout math,
// insight aggregation, event subtype classification, and formatting utilities.
// It must not depend on React, zustand, the DOM, or the network. Upstream layers
// (web-io, web-state, web) consume this package; nothing here reaches back out.
//
// Modules are registered here as they migrate from the retiring @monitor/web-core
// package during the S1–S6 stripes of the web blackbox redesign.
export {};
