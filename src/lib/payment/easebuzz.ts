import crypto from 'node:crypto';

export interface EasebuzzPayload {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  offer_key?: string;
  disable_iframe?: number;
}

export interface EasebuzzInitResponse {
  data: string;
  hash: string;
}

function generateHash(salt: string, params: Record<string, string>): string {
  const values = [
    params.key,
    params.txnid,
    params.amount,
    params.productinfo,
    params.firstname,
    params.email,
    params.udf1 || '',
    params.udf2 || '',
    params.udf3 || '',
    params.udf4 || '',
    params.udf5 || '',
    '',
    '',
    '',
    '',
    salt,
  ].join('|');

  return crypto.createHash('sha512').update(values).digest('hex');
}

export function generatePayload(
  orderId: string,
  amount: number,
  customer: { name: string; email: string; phone: string },
  env: { key: string; salt: string }
): { payload: EasebuzzPayload; hash: string } {
  const txnid = `FC_${orderId.slice(0, 8)}_${Date.now()}`;

  const payload: EasebuzzPayload = {
    key: env.key,
    txnid,
    amount: amount.toFixed(2),
    productinfo: `Order #${orderId.slice(0, 8)}`,
    firstname: customer.name,
    email: customer.email,
    phone: customer.phone,
  };

  const hash = generateHash(env.salt, payload);

  return { payload, hash };
}

export function verifySignature(
  params: Record<string, string>,
  salt: string,
  receivedHash: string
): boolean {
  const hash = generateHash(salt, params);
  return hash === receivedHash;
}
