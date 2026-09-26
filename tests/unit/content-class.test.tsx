import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ContentClassBadge, type ContentClass } from "@/components/ui/content-class";
import { ptBR } from "@/lib/i18n/pt-BR";

const CLASSES: ContentClass[] = ["mission", "maintenance", "curiosity", "leisure"];

/**
 * A mission, a maintenance task, a curiosity and leisure must never read as
 * equally urgent. That flattening — everything looking equally like it needs
 * doing now — is the failure the product exists to prevent, so the distinction
 * is asserted rather than left to whoever writes the next screen.
 */
describe("content classes", () => {
  it.each(CLASSES)("renders %s with its own label", (kind) => {
    render(<ContentClassBadge kind={kind} />);
    expect(screen.getByText(ptBR.contentClass[kind])).toBeInTheDocument();
  });

  it("gives each class a visually distinct treatment", () => {
    const classNames = CLASSES.map((kind) => {
      const { container } = render(<ContentClassBadge kind={kind} />);
      return container.firstElementChild?.className ?? "";
    });

    expect(new Set(classNames).size).toBe(CLASSES.length);
  });

  it("uses its own reserved colour token per class", () => {
    for (const kind of CLASSES) {
      const { container } = render(<ContentClassBadge kind={kind} />);
      expect(container.firstElementChild?.className).toContain(kind);
    }
  });
});
