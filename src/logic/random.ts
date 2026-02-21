export interface Rng {
  next(): number;
}

export function createSeededRng(seed: number): Rng {
  let t = seed >>> 0;
  return {
    next() {
      t += 0x6d2b79f5;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export function shuffleWithRng<T>(items: ReadonlyArray<T>, rng: Rng): ReadonlyArray<T> {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
