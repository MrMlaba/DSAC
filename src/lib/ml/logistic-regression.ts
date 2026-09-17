/**
 * Minimal logistic regression — batch gradient descent, no dependencies.
 * Small enough to train on-demand (a few hundred rows, a handful of
 * features) in well under a second, which is what the early-warning engine
 * needs: predicting P(miss target) and P(late submission) from this
 * platform's own synthetic history, not a hosted ML service.
 */
export interface TrainedModel {
  weights: number[];
  bias: number;
  featureMeans: number[];
  featureStdDevs: number[];
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

function standardize(features: number[][]): { normalized: number[][]; means: number[]; stdDevs: number[] } {
  const n = features.length;
  const dims = features[0]?.length ?? 0;
  const means = new Array(dims).fill(0);
  const stdDevs = new Array(dims).fill(1);

  for (let d = 0; d < dims; d++) {
    means[d] = features.reduce((sum, row) => sum + row[d], 0) / n;
  }
  for (let d = 0; d < dims; d++) {
    const variance = features.reduce((sum, row) => sum + (row[d] - means[d]) ** 2, 0) / n;
    stdDevs[d] = Math.sqrt(variance) || 1;
  }

  const normalized = features.map((row) => row.map((v, d) => (v - means[d]) / stdDevs[d]));
  return { normalized, means, stdDevs };
}

/** Trains a binary classifier. `labels` are 0/1. Returns a model usable with `predict`. */
export function trainLogisticRegression(
  features: number[][],
  labels: number[],
  options: { epochs?: number; learningRate?: number; l2?: number } = {},
): TrainedModel {
  const { epochs = 300, learningRate = 0.3, l2 = 0.3 } = options;
  const { normalized, means, stdDevs } = standardize(features);
  const n = normalized.length;
  const dims = normalized[0]?.length ?? 0;

  const weights = new Array(dims).fill(0);
  let bias = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradW = new Array(dims).fill(0);
    let gradB = 0;

    for (let i = 0; i < n; i++) {
      const z = normalized[i].reduce((sum, x, d) => sum + x * weights[d], bias);
      const pred = sigmoid(z);
      const error = pred - labels[i];
      for (let d = 0; d < dims; d++) gradW[d] += error * normalized[i][d];
      gradB += error;
    }

    for (let d = 0; d < dims; d++) {
      weights[d] -= (learningRate * (gradW[d] / n + l2 * weights[d])) as number;
    }
    bias -= learningRate * (gradB / n);
  }

  return { weights, bias, featureMeans: means, featureStdDevs: stdDevs };
}

/** Returns P(y=1) for a single feature vector, using the same standardization the model was trained with. */
export function predict(model: TrainedModel, features: number[]): number {
  const normalized = features.map((v, d) => (v - model.featureMeans[d]) / model.featureStdDevs[d]);
  const z = normalized.reduce((sum, x, d) => sum + x * model.weights[d], model.bias);
  return sigmoid(z);
}
