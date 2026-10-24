// SPDX-License-Identifier: GPL-3.0-or-later
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';

type Pending = { resolve: (value: any) => void; reject: (error: Error) => void; timer: NodeJS.Timeout };
export class BackendError extends Error { constructor(message: string, readonly code: string) { super(message); } }

export class Backend {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<number, Pending>();
  private nextId = 0;
  private closed = false;
  private stderr = '';

  constructor(executable: string, file: string, private readonly onExit: (message: string) => void = () => {}) {
    this.child = spawn(executable, [file], { windowsHide: true, stdio: 'pipe' });
    const lines = createInterface({ input: this.child.stdout, crlfDelay: Infinity });
    lines.on('line', line => {
      try {
        const message = JSON.parse(line);
        const request = this.pending.get(message.id);
        if (!request) return;
        clearTimeout(request.timer);
        this.pending.delete(message.id);
        if (typeof message.error === 'string') request.reject(new BackendError(message.error,message.code??'BACKEND'));
        else request.resolve(message.result);
      } catch { this.fail('Rust backend returned an invalid response.'); }
    });
    this.child.stderr.on('data', bytes => { this.stderr = (this.stderr + bytes.toString()).slice(-4000); });
    this.child.on('error', error => this.fail(`Cannot start the Rust backend: ${error.message}`));
    this.child.on('exit', (code, signal) => {
      if (!this.closed) this.fail(`Rust backend stopped (${signal ?? code}). ${this.stderr}`);
    });
    this.child.stdin.on('error', error => { if (!this.closed) this.fail(error.message); });
  }

  get alive(): boolean { return !this.closed; }

  request(method: string, params: unknown = {}): Promise<any> {
    if (this.closed) return Promise.reject(new Error('Backend session is closed. Reload the file to reconnect.'));
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('The operation took too long. Cancel or reload the file.'));
      }, 120_000);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    });
  }

  private fail(message: string): void {
    if (this.closed) return;
    this.dispose();
    this.onExit(message);
  }

  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error('Backend session closed.'));
    }
    this.pending.clear();
    this.child.stdin.end();
    this.child.kill();
  }
}
