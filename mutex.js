// OS PBL concept: a mutex protects the runway-allocation critical section.
class Mutex {
  constructor() { this.locked = false; this.waiters = []; }
  async acquire() {
    if (!this.locked) { this.locked = true; return this._releaseFn(); }
    return new Promise(resolve => this.waiters.push(resolve));
  }
  _releaseFn() {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.waiters.shift();
      if (next) next(this._releaseFn()); else this.locked = false;
    };
  }
  async runExclusive(task) {
    const release = await this.acquire();
    try { return await task(); } finally { release(); }
  }
}
module.exports = new Mutex();
