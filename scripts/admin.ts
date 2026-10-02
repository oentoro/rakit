import { createUser } from '../src/lib/auth';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Writable } from 'node:stream';
let muted=false;
const output=new Writable({write(chunk,_encoding,done){if(!muted)stdout.write(chunk);done();}});
const rl=createInterface({input:stdin,output,terminal:!!stdin.isTTY});
try {
  const username=process.env.ADMIN_USERNAME || await rl.question('Username admin: ');
  const name=process.env.ADMIN_NAME || await rl.question('Nama admin: ');
  let password=process.env.ADMIN_PASSWORD;
  if(!password){stdout.write('Password (minimal 10 karakter; disembunyikan): ');muted=true;password=await rl.question('');muted=false;stdout.write('\n');}
  const user=createUser({username,name,password,role:'admin'});console.log(`Admin dibuat: ${user.name}`);
} catch(error) {console.error(error instanceof Error?error.message:'Gagal membuat admin');process.exitCode=1;} finally {rl.close();}
