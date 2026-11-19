import { expect,test } from 'vitest';
import { isInstant } from '../src/lib/utils';
test('4-character pickup codes mark instant/sameday orders',()=>{
 for(const awb of ['96XF',' 96xf ','AB12'])expect(isInstant(awb)).toBe(true);
 for(const awb of [null,'','96X','96XF1','SPXID06708143994B','96-F'])expect(isInstant(awb)).toBe(false);
});
