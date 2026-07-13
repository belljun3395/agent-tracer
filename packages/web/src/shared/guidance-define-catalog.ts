import { isGuidanceMessage, type GuidanceMessage } from "~web/shared/guidance-message.js";

type CheckedCatalog<T> = T extends GuidanceMessage
  ? T
  : T extends (...args: infer _Arguments) => infer Result
    ? Result extends GuidanceMessage
      ? T
      : never
    : T extends object
      ? { readonly [Key in keyof T]: CheckedCatalog<T[Key]> }
      : never;

export function defineGuidanceCatalog<const Catalog extends object>(
  catalog: Catalog & CheckedCatalog<Catalog>,
): Catalog {
  freezeCatalogNode(catalog);
  return catalog;
}

function freezeCatalogNode(value: unknown): void {
  if (isGuidanceMessage(value)) {
    return;
  }

  if (typeof value === "function") {
    Object.freeze(value);
    return;
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(
      "Guidance catalogs may contain only messages, message factories, and namespaces.",
    );
  }

  for (const child of Object.values(value)) {
    freezeCatalogNode(child);
  }
  Object.freeze(value);
}
