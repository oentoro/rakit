import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireActor } from './auth';
import { DomainError } from './errors';
import type { Role } from './types';
export async function pageActor(roles?:Role[]) {
 try {return requireActor(new Request('http://internal',{headers:await headers()}),roles);}
 catch(error) {if(error instanceof DomainError) {if(error.status===403) redirect('/');redirect('/login');}throw error;}
}
