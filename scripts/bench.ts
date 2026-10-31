import { benchmarkVerify } from '../src/services/benchmark';

const stats = await benchmarkVerify(50);
console.log(stats);