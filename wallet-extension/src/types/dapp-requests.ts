export interface OperationDetail {
  /**
   * Fully qualified operation type identifier returned by the builder.
   */
  type: string;
  /**
   * Human readable description for UI display. Optional because not every
   * operation provides one.
   */
  description?: string;
  /**
   * Optional symbol of the token being transferred.
   */
  tokenSymbol?: string;
  /**
   * Optional human readable amount string.
   */
  amount?: string;
  /**
   * Optional storage address the operation interacts with.
   */
  storageAddress?: string;
  /**
   * Arbitrary metadata required by the wallet extension.
   */
  metadata?: Record<string, unknown>;
  /**
   * Allow unknown properties to flow through without breaking typing.
   */
  [key: string]: unknown;
}

export interface RequestOperations {
  sendOperations: OperationDetail[];
  receiveOperations: OperationDetail[];
  otherOperations: OperationDetail[];
}

export interface RequestSummary {
  hasSendOperations: boolean;
  hasReceiveOperations: boolean;
  hasOtherOperations: boolean;
  totalOperations: number;
}

export interface PendingDappRequest {
  id: string;
  createdAt: number;
  summary: RequestSummary;
  operations: RequestOperations;
  metadata?: Record<string, unknown>;
}

export type PendingRequestRecord = Record<string, PendingDappRequest>;

export interface ProviderRequestPayload {
  id: string;
  createdAt?: number;
  summary: Partial<RequestSummary> & {
    sendOperations?: OperationDetail[];
    receiveOperations?: OperationDetail[];
    otherOperations?: OperationDetail[];
  };
  metadata?: Record<string, unknown>;
  operations?: Partial<RequestOperations>;
}
