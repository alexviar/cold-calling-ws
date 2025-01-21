import fs from 'fs/promises'

export class FileAppender {
  private pendingWrite: Promise<void> = Promise.resolve();
  private buffer: Buffer = Buffer.alloc(0);
  private lastWrite: number = Date.now();
  private readonly BUFFER_SIZE = 32 * 1024;  // 32KB
  private readonly MAX_WAIT = 1000;          // 1 second
  private timeoutId?: NodeJS.Timeout;

  constructor(private filename: string) { }

  append(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);

    // Write if buffer exceeds threshold
    if (this.buffer.length >= this.BUFFER_SIZE ||
      Date.now() - this.lastWrite >= this.MAX_WAIT) {
      this.flush();
    } else if (!this.timeoutId) {
      // Schedule delayed flush
      this.timeoutId = setTimeout(() => this.flush(), this.MAX_WAIT);
    }
  }

  private flush(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }

    if (this.buffer.length === 0) return;

    const dataToWrite = this.buffer;
    this.buffer = Buffer.alloc(0);
    this.lastWrite = Date.now();

    this.pendingWrite = this.pendingWrite
      .then(() => fs.appendFile(this.filename, dataToWrite))
      .catch(console.error);
  }

  async close(): Promise<void> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    this.flush();
    await this.pendingWrite;
  }
}