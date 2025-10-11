export const metadata = {
  title: "Nostr Basics — Keythings Website Docs",
  description: "Understanding the decentralized social protocol that powers Keythings.",
  alternates: { canonical: "/docs/nostr-basics" },
}

export default function NostrBasicsPage() {
  return (
    <div className="rounded-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-3">Nostr Basics</h1>
      <div className="docs-prose">
        <p><em>Understanding the decentralized protocol that makes censorship-resistant social networking possible.</em></p>

        <h2>What is Nostr?</h2>
        <p>
          Nostr stands for <strong>"Notes and Other Stuff Transmitted by Relays"</strong>. It's a decentralized
          protocol for social networking that prioritizes censorship resistance, user ownership, and interoperability.
        </p>
        <p>
          Unlike traditional social media platforms, Nostr doesn't rely on centralized servers or corporate control.
          Instead, it uses a network of distributed relays that anyone can run, making it nearly impossible for
          any single entity to censor or control the network.
        </p>

        <blockquote>
          "The simplest open protocol that is able to create a censorship-resistant global social network."
          <footer>— The Nostr Protocol</footer>
        </blockquote>

        <h2>How Nostr Works</h2>
        <p>Nostr operates on three fundamental components:</p>

        <h3>1. Users (Public/Private Key Pairs)</h3>
        <p>Every Nostr user has:</p>
        <ul>
          <li><strong>Public Key</strong>: Your identity (often displayed as an npub... address)</li>
          <li><strong>Private Key</strong>: Your secret key for signing posts and authentication</li>
        </ul>
        <p>Your keys are generated locally and never leave your device (except when you choose to back them up).</p>

        <h3>2. Events (Posts, Messages, Metadata)</h3>
        <p>Everything in Nostr is an "event" - a signed JSON object containing:</p>
        <ul>
          <li><strong>Content</strong>: Your post text, images, or other data</li>
          <li><strong>Kind</strong>: Event type (1 = post, 0 = profile metadata, etc.)</li>
          <li><strong>Tags</strong>: Metadata like mentions, hashtags, or replies</li>
          <li><strong>Timestamp</strong>: When the event was created</li>
          <li><strong>Signature</strong>: Cryptographic proof of authenticity</li>
        </ul>

        <h3>3. Relays (Servers)</h3>
        <p>Relays are like email servers - they store and forward messages:</p>
        <ul>
          <li><strong>Anyone can run a relay</strong>: No permission required</li>
          <li><strong>Users choose their relays</strong>: You control where your data is stored</li>
          <li><strong>Redundant by design</strong>: Your posts exist on multiple relays</li>
          <li><strong>Censorship resistant</strong>: No single relay can take down the network</li>
        </ul>

        <h2>Why Nostr Matters</h2>
        <p>Nostr solves fundamental problems with traditional social media:</p>

        <h3>Censorship Resistance</h3>
        <p>
          Traditional platforms can ban users, delete posts, or manipulate algorithms. With Nostr:
        </p>
        <ul>
          <li>No platform can ban you from the entire network</li>
          <li>Your content exists on relays you control</li>
          <li>You can always migrate to different relays</li>
          <li>Content moderation happens at the client level, not server level</li>
        </ul>

        <h3>Data Ownership</h3>
        <p>You own your social graph and content:</p>
        <ul>
          <li><strong>Your followers</strong>: Stored in your client, not on a platform's servers</li>
          <li><strong>Your posts</strong>: Signed by your private key, proving authenticity</li>
          <li><strong>Your identity</strong>: A cryptographic key pair that's truly yours</li>
          <li><strong>Export everything</strong>: Your data is portable across any Nostr client</li>
        </ul>

        <h3>Interoperability</h3>
        <p>Nostr works across different applications:</p>
        <ul>
          <li>Use any client to access the same network</li>
          <li>Switch between apps without losing your social graph</li>
          <li>Content created on one app appears on all others</li>
          <li>Future-proof: No vendor lock-in</li>
        </ul>

        <h2>Nostr Improvement Proposals (NIPs)</h2>
        <p>Nostr evolves through community-driven proposals:</p>

        <h3>Core NIPs</h3>
        <ul>
          <li><strong>NIP-01</strong>: Basic protocol (events, keys, relays)</li>
          <li><strong>NIP-02</strong>: Follow lists and contact lists</li>
          <li><strong>NIP-05</strong>: Verifiable identities (like DNS for Nostr)</li>
          <li><strong>NIP-07</strong>: Browser extension API for wallets</li>
        </ul>

        <h3>Advanced Features</h3>
        <ul>
          <li><strong>NIP-04</strong>: Encrypted direct messages</li>
          <li><strong>NIP-09</strong>: Event deletion</li>
          <li><strong>NIP-28</strong>: Public chat channels</li>
          <li><strong>NIP-50</strong>: Full-text search in relays</li>
        </ul>

        <h2>Your Keys, Your Responsibility</h2>
        <p>With great decentralization comes great responsibility:</p>

        <h3>Key Security</h3>
        <ul>
          <li><strong>Never share your private key</strong>: It's like your email password</li>
          <li><strong>Backup your keys</strong>: Use secure, offline backup methods</li>
          <li><strong>Use hardware security</strong>: Consider hardware wallets or secure enclaves</li>
          <li><strong>Recovery options</strong>: Some clients offer social recovery or seed phrases</li>
        </ul>

        <h3>Privacy Considerations</h3>
        <p>While Nostr is private by default, be mindful:</p>
        <ul>
          <li>Content is public unless encrypted</li>
          <li>IP addresses may be visible to relays</li>
          <li>Metadata (timestamps, event sizes) can leak information</li>
          <li>Use Tor or VPNs for enhanced privacy</li>
        </ul>

        <h2>Getting Started with Nostr</h2>
        <p>Ready to join the decentralized social network?</p>

        <h3>Choose Your Client</h3>
        <ul>
          <li><strong>Keythings</strong>: Full-featured web client with modern UX</li>
          <li><strong>Damus</strong>: Native iOS app with great mobile experience</li>
          <li><strong>Amethyst</strong>: Android client with Material Design</li>
          <li><strong>Snort</strong>: Lightweight web client focused on performance</li>
        </ul>

        <h3>Set Up Your Identity</h3>
        <ol>
          <li>Create a key pair (client generates this automatically)</li>
          <li>Set up a memorable username and profile</li>
          <li>Get NIP-05 verification for a custom domain (optional)</li>
          <li>Start following interesting people and topics</li>
        </ol>

        <h2>Common Questions</h2>

        <h3>Is Nostr like Twitter?</h3>
        <p>
          Nostr is a protocol, not a platform. It's more like email (SMTP) than Gmail.
          Anyone can build a Nostr client, just like anyone can build an email client.
        </p>

        <h3>What if a relay goes down?</h3>
        <p>
          Your posts exist on multiple relays. If one goes down, others still have your content.
          You can always switch to different relays or run your own.
        </p>

        <h3>Can I migrate from platform X to Nostr?</h3>
        <p>
          Yes! Many people bring their existing communities to Nostr. You can:
        </p>
        <ul>
          <li>Post simultaneously on both platforms</li>
          <li>Use tools to import followers (where possible)</li>
          <li>Build your presence gradually</li>
        </ul>

        <h3>How do I find people on Nostr?</h3>
        <ul>
          <li>Search for hashtags and topics you're interested in</li>
          <li>Look for NIP-05 verified accounts</li>
          <li>Follow recommendations from people you trust</li>
          <li>Join communities and chat channels</li>
        </ul>

        <h2>The Future of Social Media</h2>
        <p>
          Nostr represents a fundamental rethinking of social networking. By putting users in control
          of their data and identity, it creates a more resilient, private, and user-centric internet.
        </p>
        <p>
          As more people discover Nostr, we're seeing the emergence of a truly decentralized social
          network that can't be bought, sold, or censored by any corporation or government.
        </p>

        <blockquote>
          The internet was designed to be decentralized. Social media shouldn't be any different.
          Welcome to the future of online communication.
        </blockquote>

        <h2>Learn More</h2>
        <ul>
          <li><a href="https://nostr.com" className="text-accent-gradient hover:underline">Official Nostr Website</a></li>
          <li><a href="https://github.com/nostr-protocol/nips" className="text-accent-gradient hover:underline">NIP Specifications</a></li>
          <li><a href="/docs/authentication" className="text-accent-gradient hover:underline">Authentication Guide</a></li>
          <li><a href="/docs/search" className="text-accent-gradient hover:underline">Search & Discovery</a></li>
        </ul>
      </div>
    </div>
  )
}
