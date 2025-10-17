import React from "react";
import { PendingDappRequest, OperationDetail } from "../types/dapp-requests";

function renderOperation(operation: OperationDetail, index: number) {
  const key = `${operation.type}-${index}`;
  return (
    <li key={key} className="operation-item">
      <div className="operation-header">
        <span className="operation-type">{operation.type}</span>
        {operation.tokenSymbol ? (
          <span className="operation-token">{operation.tokenSymbol}</span>
        ) : null}
      </div>
      {operation.amount ? <div className="operation-amount">{operation.amount}</div> : null}
      {operation.storageAddress ? (
        <div className="operation-storage">Storage: {operation.storageAddress}</div>
      ) : null}
      {operation.description ? (
        <div className="operation-description">{operation.description}</div>
      ) : null}
    </li>
  );
}

interface BuilderPublishRequestProps {
  request: PendingDappRequest;
}

export function BuilderPublishRequest({ request }: BuilderPublishRequestProps) {
  const { summary, operations } = request;
  const { sendOperations, receiveOperations, otherOperations } = operations;

  return (
    <section aria-label="Transaction summary" className="builder-publish-request">
      <header>
        <h2>Transaction Preview</h2>
        <p>Total Operations {summary.totalOperations}</p>
      </header>

      {sendOperations.length > 0 ? (
        <section aria-label="Send operations">
          <h3>Send</h3>
          <ul>{sendOperations.map(renderOperation)}</ul>
        </section>
      ) : null}

      {receiveOperations.length > 0 ? (
        <section aria-label="Receive operations">
          <h3>Receive</h3>
          <ul>{receiveOperations.map(renderOperation)}</ul>
        </section>
      ) : null}

      {otherOperations.length > 0 ? (
        <section aria-label="Other operations">
          <h3>Other</h3>
          <ul>{otherOperations.map(renderOperation)}</ul>
        </section>
      ) : null}
    </section>
  );
}

export default BuilderPublishRequest;
