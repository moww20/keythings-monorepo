import { notFound } from "next/navigation";

import {
  fetchAccountCertificate,
} from "@/lib/explorer/client";

import { ExplorerCertificateDetails } from "../../../../components/ExplorerCertificateDetails";
import { truncateIdentifier } from "../../../../utils/resolveExplorerPath";

interface StorageCertificatePageProps {
  params: {
    publicKey: string;
    hash: string;
  };
}

export default async function ExplorerStorageCertificatePage({ params }: StorageCertificatePageProps): Promise<React.JSX.Element> {
  const { publicKey: storagePublicKey, hash: certificateHash } = await params;

  const certificate = await fetchAccountCertificate(storagePublicKey, certificateHash);

  if (!certificate) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="px-4 py-6 lg:px-6">
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.3em] text-muted">Explorer Storage Certificate</p>
            <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
              {truncateIdentifier(certificate.hash, 16, 12)}
            </h1>
            <p className="text-sm text-subtle">
              Issued for storage account {truncateIdentifier(storagePublicKey, 12, 10)}
            </p>
          </header>

          <ExplorerCertificateDetails
            certificate={certificate}
            accountPublicKey={storagePublicKey}
          />
        </div>
      </div>
    </div>
  );
}
