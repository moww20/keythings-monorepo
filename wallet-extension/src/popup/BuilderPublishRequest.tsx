import React from "react";
import { PendingDappRequest, OperationDetail } from "../types/dapp-requests";
import {
  deriveOperationTokenDisplay,
  type OperationTokenDisplayContext,
  type TokenIcon,
} from "../lib/token-display";

function renderTokenIcon(iconUrl: string | null, fallbackIcon: TokenIcon | null, label: string | null) {
  if (iconUrl) {
    return (
      <div className="operation-token-icon" aria-hidden={!label}>
        <img
          src={iconUrl}
          alt={label ? `${label} token icon` : "Token icon"}
          className="operation-token-icon-image"
          style={{ width: 32, height: 32, borderRadius: "50%" }}
        />
      </div>
    );
  }

  if (fallbackIcon?.letter) {
    const backgroundColor = typeof fallbackIcon.bgColor === "string" ? fallbackIcon.bgColor : "#1f2937";
    const textColor = typeof fallbackIcon.textColor === "string" ? fallbackIcon.textColor : "#ffffff";

    return (
      <div
        className="operation-token-icon operation-token-icon--fallback"
        style={{
          width: 32,
          height: 32,
          borderRadius: fallbackIcon.shape === "square" ? 8 : "50%",
          backgroundColor,
          color: textColor,
          fontSize: 14,
          fontWeight: 600,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          textTransform: "uppercase",
        }}
        aria-hidden="true"
      >
        {fallbackIcon.letter}
      </div>
    );
  }

  return null;
}

function renderOperation(
  operation: OperationDetail,
  index: number,
  context?: OperationTokenDisplayContext,
) {
  const key = `${operation.type}-${index}`;
  const tokenDisplay = deriveOperationTokenDisplay(operation, context);
  const amount = tokenDisplay.formattedAmount
    ? tokenDisplay.symbol
      ? `${tokenDisplay.formattedAmount} ${tokenDisplay.symbol}`
      : tokenDisplay.formattedAmount
    : operation.amount ?? null;

  return (
    <li key={key} className="operation-item">
      <div className="operation-header">
        {renderTokenIcon(tokenDisplay.iconUrl, tokenDisplay.fallbackIcon, tokenDisplay.name ?? tokenDisplay.symbol)}

        <div className="operation-header-content">
          <span className="operation-type">{operation.type}</span>
          {tokenDisplay.name && tokenDisplay.name !== operation.type ? (
            <span className="operation-token-name">{tokenDisplay.name}</span>
          ) : null}
        </div>

        {tokenDisplay.symbol ? (
          <span className="operation-token">{tokenDisplay.symbol}</span>
        ) : operation.tokenSymbol ? (
          <span className="operation-token">{operation.tokenSymbol}</span>
        ) : null}
      </div>
      {amount ? <div className="operation-amount">{amount}</div> : null}
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

  const context: OperationTokenDisplayContext = {
    requestMetadata: request.metadata,
  };

  return (
    <section aria-label="Transaction summary" className="builder-publish-request">
      <header>
        <h2>Transaction Preview</h2>
        <p>Total Operations {summary.totalOperations}</p>
      </header>

      {sendOperations.length > 0 ? (
        <section aria-label="Send operations">
          <h3>Send</h3>
          <ul>{sendOperations.map((operation, index) => renderOperation(operation, index, context))}</ul>
        </section>
      ) : null}

      {receiveOperations.length > 0 ? (
        <section aria-label="Receive operations">
          <h3>Receive</h3>
          <ul>{receiveOperations.map((operation, index) => renderOperation(operation, index, context))}</ul>
        </section>
      ) : null}

      {otherOperations.length > 0 ? (
        <section aria-label="Other operations">
          <h3>Other</h3>
          <ul>{otherOperations.map((operation, index) => renderOperation(operation, index, context))}</ul>
        </section>
      ) : null}
    </section>
  );
}

export default BuilderPublishRequest;
