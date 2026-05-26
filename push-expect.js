const { spawn } = require('child_process');

const p = spawn('pnpm', ['--filter', '@workspace/db', 'push-force'], {
  env: { ...process.env, FORCE_COLOR: '0' }
});

p.stdout.on('data', (data) => {
  process.stdout.write(data);
  const output = data.toString();
  if (output.includes('Is manual_deposit_requests table created')) {
    console.log("Sending Enter...");
    p.stdin.write('\r');
  }
  if (output.includes('Is') && output.includes('renamed from another table')) {
    console.log("Sending Enter...");
    p.stdin.write('\r');
  }
});

p.stderr.on('data', (data) => {
  process.stderr.write(data);
});
