import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canTransitionOrderStatus } from "./orders.service";

describe("canTransitionOrderStatus", () => {
  it("allows the forward fulfilment path", () => {
    assert.equal(canTransitionOrderStatus("New", "Processing"), true);
    assert.equal(canTransitionOrderStatus("Processing", "Packed"), true);
    assert.equal(canTransitionOrderStatus("Packed", "Shipped"), true);
    assert.equal(canTransitionOrderStatus("Shipped", "Completed"), true);
  });

  it("allows cancelling before shipment only", () => {
    assert.equal(canTransitionOrderStatus("New", "Cancelled"), true);
    assert.equal(canTransitionOrderStatus("Processing", "Cancelled"), true);
    assert.equal(canTransitionOrderStatus("Packed", "Cancelled"), true);
    assert.equal(canTransitionOrderStatus("Shipped", "Cancelled"), false);
    assert.equal(canTransitionOrderStatus("Completed", "Cancelled"), false);
  });

  it("allows returns only after shipment", () => {
    assert.equal(canTransitionOrderStatus("Shipped", "Returned"), true);
    assert.equal(canTransitionOrderStatus("Completed", "Returned"), true);
    assert.equal(canTransitionOrderStatus("New", "Returned"), false);
    assert.equal(canTransitionOrderStatus("Packed", "Returned"), false);
  });

  it("treats Cancelled and Returned as terminal", () => {
    assert.equal(canTransitionOrderStatus("Cancelled", "New"), false);
    assert.equal(canTransitionOrderStatus("Cancelled", "Paid" as never), false);
    assert.equal(canTransitionOrderStatus("Returned", "Completed"), false);
  });

  it("rejects status moves that skip steps", () => {
    assert.equal(canTransitionOrderStatus("New", "Shipped"), false);
    assert.equal(canTransitionOrderStatus("New", "Completed"), false);
    assert.equal(canTransitionOrderStatus("Processing", "Completed"), false);
    assert.equal(canTransitionOrderStatus("Shipped", "Processing"), false);
  });

  it("allows a no-op transition to the same status", () => {
    assert.equal(canTransitionOrderStatus("New", "New"), true);
    assert.equal(canTransitionOrderStatus("Shipped", "Shipped"), true);
  });
});
