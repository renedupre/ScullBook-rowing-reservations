export * from "./generated/api";
export * from "./generated/types";
// Orval names both the path validator and query type CancelReservationParams.
// Keep the validator's existing public name and alias the query-only type.
export { CancelReservationParams } from "./generated/api";
export type { CancelReservationParams as CancelReservationQueryParameters } from "./generated/types";
