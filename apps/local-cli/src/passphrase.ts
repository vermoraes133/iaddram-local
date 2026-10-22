import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import type { ReadStream, WriteStream } from 'node:tty';

export async function readPassphrase(fromStdin: boolean, confirm: boolean): Promise<string> {
  if (fromStdin) {
    // Avoid echoing a secret if --passphrase-stdin was supplied in an interactive terminal.
    if (process.stdin.isTTY) throw new Error('Use an interactive prompt or pipe protected stdin.');
    let value = '';
    for await (const chunk of process.stdin) {
      value += String(chunk);
      if (value.length > 1026) throw new Error('Passphrase exceeds limit.');
    }
    return validatePassphrase(value.replace(/\r?\n$/, ''));
  }
  if (!process.stdin.isTTY || !process.stderr.isTTY)
    throw new Error('Noninteractive backup requires --passphrase-stdin.');
  const first = await promptSecret(
    'Backup passphrase (at least 16 characters): ',
    process.stdin,
    process.stderr,
  );
  validatePassphrase(first);
  if (
    confirm &&
    first !== (await promptSecret('Confirm passphrase: ', process.stdin, process.stderr))
  ) {
    throw new Error('Passphrases do not match.');
  }
  return first;
}

function validatePassphrase(value: string): string {
  if (value.length < 16 || value.length > 1024)
    throw new Error('Passphrase must contain 16 to 1024 characters.');
  return value;
}

/** readline controls raw mode/editing; all of its echo output is discarded. */
export function promptSecret(
  prompt: string,
  input: ReadStream,
  output: WriteStream,
): Promise<string> {
  const silent = new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
  });
  const previousRaw = input.isRaw;
  const terminal = createInterface({ input, output: silent, terminal: true, historySize: 0 });
  output.write(prompt);
  return new Promise((resolve, reject) => {
    let complete = false;
    const cleanup = () => {
      terminal.close();
      input.setRawMode(previousRaw);
      input.pause();
      silent.destroy();
      output.write('\n');
    };
    terminal.once('SIGINT', () => {
      if (complete) return;
      complete = true;
      cleanup();
      reject(new Error('Backup canceled.'));
    });
    terminal.once('close', () => {
      if (complete) return;
      complete = true;
      cleanup();
      reject(new Error('Backup canceled.'));
    });
    terminal.question('', (value) => {
      if (complete) return;
      complete = true;
      cleanup();
      resolve(value);
    });
  });
}
