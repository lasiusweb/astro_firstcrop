export interface PaymentInitParams {
  orderId: string;
  amount: number;
  currency: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  redirectUrl: string;
}

export interface PaymentInitResult {
  paymentUrl: string;
  transactionId: string;
}

export interface PaymentVerificationParams {
  transactionId: string;
  amount: number;
  status: string;
  signature: string;
}

export interface PaymentVerificationResult {
  verified: boolean;
  orderId?: string;
}

export interface PaymentProvider {
  initPayment(params: PaymentInitParams): Promise<PaymentInitResult>;
  verifyPayment(params: PaymentVerificationParams): Promise<PaymentVerificationResult>;
}

export function createPaymentProvider(): PaymentProvider {
  return {
    async initPayment(params) {
      // Mock implementation for M1
      // Replace with real Easebuzz integration in M2
      return {
        paymentUrl: `/checkout/confirmation?txnid=mock_${params.orderId}&status=success`,
        transactionId: `mock_${params.orderId}_${Date.now()}`,
      };
    },

    async verifyPayment(params) {
      // Mock implementation for M1
      return {
        verified: params.status === 'success',
      };
    },
  };
}
