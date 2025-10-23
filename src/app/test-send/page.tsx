'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import SendModal from '@/app/components/SendModal';

export default function TestSendPage() {
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[color:var(--background)] flex items-center justify-center p-8">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Send Modal Test</h1>
        <p className="text-muted">Click the button below to open the Send modal</p>
        <Button 
          onClick={() => setIsSendModalOpen(true)}
          className="bg-accent text-white hover:bg-accent/90"
        >
          Open Send Modal
        </Button>
        
        <SendModal 
          isOpen={isSendModalOpen} 
          onClose={() => setIsSendModalOpen(false)} 
        />
      </div>
    </div>
  );
}
