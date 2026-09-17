import { describe, expect, it } from "vitest";
import { trainLogisticRegression, predict } from "./logistic-regression";

describe("logistic regression", () => {
  it("learns a clearly separable single-feature relationship", () => {
    const features = [[0], [1], [2], [8], [9], [10]];
    const labels = [0, 0, 0, 1, 1, 1];
    const model = trainLogisticRegression(features, labels, { epochs: 500 });

    expect(predict(model, [0])).toBeLessThan(0.3);
    expect(predict(model, [10])).toBeGreaterThan(0.7);
  });

  it("outputs valid probabilities in [0, 1] for arbitrary inputs", () => {
    const features = [
      [0.1, 5],
      [0.9, 1],
      [0.4, 3],
      [0.7, 2],
    ];
    const labels = [0, 1, 0, 1];
    const model = trainLogisticRegression(features, labels);

    for (const p of [predict(model, [0.5, 3]), predict(model, [-5, 100]), predict(model, [5, -100])]) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
      expect(Number.isNaN(p)).toBe(false);
    }
  });

  it("higher risk feature values push probability toward 1 (monotonic on a dominant feature)", () => {
    const features = [[0], [2], [4], [6], [8], [10]];
    const labels = [0, 0, 0, 1, 1, 1];
    const model = trainLogisticRegression(features, labels, { epochs: 400 });

    const low = predict(model, [1]);
    const high = predict(model, [9]);
    expect(high).toBeGreaterThan(low);
  });
});
