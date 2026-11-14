import assert from "node:assert/strict";
import test from "node:test";
import { analyzeProductTextForModeration, isProductPubliclyVisible } from "./moderation.ts";

test("flags explicit high-risk weapon references for priority review", () => {
  const review = analyzeProductTextForModeration({
    title: "AK-47 de colección",
    description: "Rifle con cargador y munición para uso militar.",
    categoryName: "Armas",
    tags: ["arma", "cargador"],
  });

  assert.equal(review.moderationStatus, "flagged");
  assert.match(review.reason ?? "", /alto riesgo/i);
  assert.equal(review.signals.some((signal) => signal.category === "weapon"), true);
});

test("sends suspicious matches to manual review without automatically rejecting them", () => {
  const review = analyzeProductTextForModeration({
    title: "Cuchillo de cocina",
    description: "Acero inoxidable.",
  });

  assert.equal(review.moderationStatus, "pending_review");
  assert.equal(review.signals.some((signal) => signal.result === "matched"), true);
});

test("approves text with no risk matches for automatic publication", () => {
  const review = analyzeProductTextForModeration({
    title: "Laptop gaming",
    description: "Portátil para edición y videojuegos con teclado retroiluminado.",
    categoryName: "Tecnología",
    tags: ["laptop", "gaming"],
  });

  assert.equal(review.moderationStatus, "approved");
  assert.equal(review.reason?.includes("No se detectaron"), true);
});

test("does not flag educational book listings only because they mention risky terms", () => {
  const review = analyzeProductTextForModeration({
    title: "Libro sobre armas de fuego",
    description: "Historia de pistolas y rifles.",
    categoryName: "Libros",
  });

  assert.equal(review.moderationStatus, "approved");
});

test("uses whole terms instead of partial word matches", () => {
  const review = analyzeProductTextForModeration({
    title: "Armario de madera",
    description: "Mueble para el hogar.",
  });

  assert.equal(review.moderationStatus, "approved");
});

test("normalizes accents and punctuation in risk terms", () => {
  const review = analyzeProductTextForModeration({
    title: "Munición calibre 9 mm",
    description: "Cartuchos para pistola.",
  });

  assert.equal(review.moderationStatus, "flagged");
});

test("only approved products are public", () => {
  assert.equal(isProductPubliclyVisible({ status: "true", moderation_status: "approved" }), true);
  assert.equal(isProductPubliclyVisible({ status: "true", moderation_status: "pending_review" }), false);
  assert.equal(isProductPubliclyVisible({ status: "false", moderation_status: "approved" }), false);
});
