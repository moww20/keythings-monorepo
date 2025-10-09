export const metadata = {
  title: "Setup Tutorial — Keythings Wallet Docs",
  description: "Complete setup guide for Keythings Wallet including installation and configuration.",
  alternates: { canonical: "/docs/tutorials/setup" },
}

export default function SetupTutorialPage() {
  return (
    <div className="rounded-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-3">Setup Tutorial</h1>
      <div className="docs-prose">
        <p><em>Complete step-by-step guide to set up your Keythings account and get started with decentralized social networking.</em></p>

        <div className="bg-blue-500/10 border-l-4 border-blue-500 p-4 mb-6 rounded-r-lg">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-blue-300">
                <strong>Time to complete:</strong> 10-15 minutes<br/>
                <strong>Prerequisites:</strong> Modern web browser, optional wallet extension
              </p>
            </div>
          </div>
        </div>

        <h2>Step 1: Access Keythings</h2>
        <ol>
          <li>Open your web browser (Chrome, Firefox, Safari, or Edge recommended)</li>
          <li>Navigate to <a href="https://keythings.com" className="text-accent-gradient hover:underline">https://keythings.com</a></li>
          <li>The application loads instantly with our optimized Next.js build</li>
        </ol>

        <h2>Step 2: Choose Your Authentication Method</h2>
        <p>You have two main options for authentication:</p>

        <h3>Option A: Passkeys (Recommended for New Users)</h3>
        <div className="bg-green-500/10 border-l-4 border-green-500 p-4 mb-4 rounded-r-lg">
          <p className="text-green-300"><strong>Best for:</strong> New users, maximum security and simplicity</p>
        </div>

        <ol>
          <li>On the homepage, click <strong>"Sign Up"</strong> or <strong>"Create Account"</strong></li>
          <li>You'll see options for different authentication methods</li>
          <li>Click <strong>"Continue with Passkeys"</strong></li>
          <li>Choose a username (this becomes your Nostr identity)</li>
          <li>Your browser will prompt you to use your device's biometric authentication</li>
          <li>Use TouchID, FaceID, fingerprint, or device PIN as prompted</li>
          <li>Once authenticated, your account is instantly created!</li>
        </ol>

        <p><strong>What happens next:</strong></p>
        <ul>
          <li>A cryptographic key pair is generated locally in your browser</li>
          <li>Your public key becomes your Nostr identity</li>
          <li>You can immediately start posting and interacting</li>
          <li>No passwords to remember or manage</li>
        </ul>

        <h3>Option B: External Wallet (For Existing Nostr Users)</h3>
        <div className="bg-purple-500/10 border-l-4 border-purple-500 p-4 mb-4 rounded-r-lg">
          <p className="text-purple-300"><strong>Best for:</strong> Users with existing Nostr keys or advanced users</p>
        </div>

        <h4>Install a NIP-07 Compatible Wallet</h4>
        <p>Choose one of these browser extensions:</p>

        <div className="grid md:grid-cols-2 gap-4 my-4">
          <div className="border rounded-lg p-4">
            <h5 className="font-semibold">Alby</h5>
            <p className="text-sm text-muted-foreground">Most popular, includes Lightning Network</p>
            <a href="https://getalby.com" className="text-accent-gradient hover:underline text-sm">Install Alby</a>
          </div>
          <div className="border rounded-lg p-4">
            <h5 className="font-semibold">nos2x</h5>
            <p className="text-sm text-muted-foreground">Simple, open-source Nostr wallet</p>
            <a href="https://github.com/fiatjaf/nos2x" className="text-accent-gradient hover:underline text-sm">Install nos2x</a>
          </div>
          <div className="border rounded-lg p-4">
            <h5 className="font-semibold">Nostr Wallet ID</h5>
            <p className="text-sm text-muted-foreground">Browser-based key management</p>
            <a href="https://nostr-wallet-id.netlify.app/" className="text-accent-gradient hover:underline text-sm">Install Nostr Wallet ID</a>
          </div>
          <div className="border rounded-lg p-4">
            <h5 className="font-semibold">Snort</h5>
            <p className="text-sm text-muted-foreground">Desktop wallet with Nostr integration</p>
            <a href="https://snort.social" className="text-accent-gradient hover:underline text-sm">Download Snort</a>
          </div>
        </div>

        <h4>Connect Your Wallet</h4>
        <ol>
          <li>After installing your wallet extension, refresh Keythings</li>
          <li>Click <strong>"Connect Wallet"</strong> on the homepage</li>
          <li>Your wallet extension will show a popup asking for permission</li>
          <li>Review the permissions (Keythings needs to sign posts with your key)</li>
          <li>Click <strong>"Approve"</strong> or <strong>"Connect"</strong></li>
          <li>You'll see a success message and can start using your existing Nostr identity</li>
        </ol>

        <h2>Step 3: Complete Your Profile Setup</h2>
        <p>Make your profile discoverable and professional:</p>

        <h3>Basic Profile Information</h3>
        <ol>
          <li>Click on your profile picture/avatar in the top-right corner</li>
          <li>Select <strong>"Edit Profile"</strong> from the dropdown menu</li>
          <li>Upload a profile picture (recommended: square image, 400x400px minimum)</li>
          <li>Set your display name (can be different from your username)</li>
          <li>Write a bio (160 characters max, tell people about yourself)</li>
          <li>Add your website or portfolio URL if applicable</li>
          <li>Click <strong>"Save Changes"</strong></li>
        </ol>

        <h3>Advanced Profile Settings</h3>
        <p>Optional but recommended for better discoverability:</p>
        <ul>
          <li><strong>NIP-05 Verification:</strong> Get a verified badge by linking a domain</li>
          <li><strong>Profile Picture:</strong> Use a clear, recognizable image</li>
          <li><strong>Bio Optimization:</strong> Include keywords people might search for</li>
          <li><strong>Link in Bio:</strong> Point to your website, blog, or other profiles</li>
        </ul>

        <h2>Step 4: Configure Your Privacy Settings</h2>
        <p>Keythings gives you control over your privacy:</p>

        <ol>
          <li>Go to your profile and click <strong>"Settings"</strong></li>
          <li>Review the <strong>"Privacy & Security"</strong> section</li>
          <li>Choose your default post visibility (public by default)</li>
          <li>Configure who can mention you or send direct messages</li>
          <li>Set up content warnings for sensitive topics if needed</li>
        </ol>

        <h2>Step 5: Find and Follow Interesting People</h2>
        <p>Build your network on Nostr:</p>

        <h3>Explore the Platform</h3>
        <ol>
          <li>Check the <strong>"Following"</strong> tab to see posts from people you might know</li>
          <li>Use the search bar to find topics, hashtags, or people</li>
          <li>Look for users with verification badges (✓) for trusted accounts</li>
          <li>Browse trending hashtags in the sidebar</li>
        </ol>

        <h3>Search Strategies</h3>
        <ul>
          <li><strong>Topic Search:</strong> Try #nostr, #bitcoin, #technology</li>
          <li><strong>People Search:</strong> Look for influencers or friends from other platforms</li>
          <li><strong>Location-based:</strong> Search for your city or interests</li>
          <li><strong>Language-specific:</strong> Find content in your preferred language</li>
        </ul>

        <h3>Following Best Practices</h3>
        <ul>
          <li>Start with 10-20 interesting people to build your feed</li>
          <li>Follow accounts that post regularly and engage with others</li>
          <li>Mix in different types of content (news, entertainment, education)</li>
          <li>Use the "Follow Back" feature when appropriate</li>
        </ul>

        <h2>Step 6: Create Your First Post</h2>
        <p>Share your thoughts with the Nostr network:</p>

        <h3>Simple Text Post</h3>
        <ol>
          <li>Click the composer box at the top of your feed</li>
          <li>Type your message (up to 65,535 characters)</li>
          <li>Add relevant hashtags to increase visibility</li>
          <li>Click <strong>"Post"</strong> to publish instantly</li>
        </ol>

        <h3>Enhanced Post with Media</h3>
        <ol>
          <li>Click the <strong>image icon</strong> in the composer</li>
          <li>Select photos or videos from your device</li>
          <li>Add a descriptive caption</li>
          <li>Include relevant hashtags</li>
          <li>Your media uploads securely and posts automatically</li>
        </ol>

        <h3>Posting Tips</h3>
        <ul>
          <li><strong>Be authentic:</strong> Share your genuine thoughts and experiences</li>
          <li><strong>Use hashtags:</strong> Help others discover your content</li>
          <li><strong>Engage with replies:</strong> Respond to comments on your posts</li>
          <li><strong>Share value:</strong> Post helpful, interesting, or entertaining content</li>
        </ul>

        <h2>Step 7: Engage with the Community</h2>
        <p>Build relationships and join conversations:</p>

        <h3>Interaction Basics</h3>
        <ul>
          <li><strong>Like posts:</strong> Click the heart icon to show appreciation</li>
          <li><strong>Repost content:</strong> Share interesting posts with your followers</li>
          <li><strong>Reply to posts:</strong> Join discussions and start conversations</li>
          <li><strong>Follow users:</strong> Build your network of interesting people</li>
        </ul>

        <h3>Advanced Engagement</h3>
        <ul>
          <li><strong>Quote posts:</strong> Add your thoughts when reposting</li>
          <li><strong>Tag users:</strong> Mention people in your posts with @username</li>
          <li><strong>Join trending topics:</strong> Participate in popular conversations</li>
          <li><strong>Create threads:</strong> Tell longer stories across multiple posts</li>
        </ul>

        <h2>Step 8: Customize Your Experience</h2>
        <p>Make Keythings work the way you want:</p>

        <h3>Interface Customization</h3>
        <ul>
          <li><strong>Theme:</strong> Switch between light and dark modes</li>
          <li><strong>Language:</strong> Set your preferred language</li>
          <li><strong>Notifications:</strong> Configure what you want to be notified about</li>
          <li><strong>Content filters:</strong> Block or mute unwanted content</li>
        </ul>

        <h3>Feed Management</h3>
        <ul>
          <li><strong>Algorithm settings:</strong> Choose how posts are ranked</li>
          <li><strong>Mute keywords:</strong> Hide posts with certain words</li>
          <li><strong>Block users:</strong> Prevent specific users from interacting with you</li>
          <li><strong>List curation:</strong> Create custom lists of users</li>
        </ul>

        <h2>Step 9: Security Best Practices</h2>
        <p>Keep your account and data secure:</p>

        <h3>Key Management</h3>
        <ul>
          <li><strong>Backup your keys:</strong> If using an external wallet, backup your seed phrase</li>
          <li><strong>Use strong authentication:</strong> Enable all available security features</li>
          <li><strong>Regular updates:</strong> Keep your browser and extensions updated</li>
          <li><strong>Be cautious with links:</strong> Verify URLs before clicking</li>
        </ul>

        <h3>Privacy Tips</h3>
        <ul>
          <li><strong>Review app permissions:</strong> Only grant necessary access</li>
          <li><strong>Use privacy settings:</strong> Control who can see your content</li>
          <li><strong>Be mindful of metadata:</strong> Timestamps and locations can reveal information</li>
          <li><strong>Consider VPN usage:</strong> For enhanced network privacy</li>
        </ul>

        <h2>Step 10: Connect with Other Platforms</h2>
        <p>Bridge your Nostr presence with other platforms:</p>

        <h3>Cross-Platform Strategies</h3>
        <ul>
          <li><strong>Share your Nostr profile:</strong> Include your npub key on other profiles</li>
          <li><strong>Use the same username:</strong> When possible for brand consistency</li>
          <li><strong>Cross-post content:</strong> Share your best content across platforms</li>
          <li><strong>Drive traffic:</strong> Link to your Nostr profile from other sites</li>
        </ul>

        <h3>Import Existing Networks</h3>
        <ul>
          <li><strong>Twitter migration:</strong> Find your Twitter contacts on Nostr</li>
          <li><strong>Bluesky connection:</strong> Many users are active on both platforms</li>
          <li><strong>Mastodon federation:</strong> Connect with decentralized social networks</li>
          <li><strong>Web3 communities:</strong> Join crypto and blockchain discussions</li>
        </ul>

        <h2>Troubleshooting Common Issues</h2>

        <h3>Can't Connect Wallet?</h3>
        <ul>
          <li>Ensure your wallet extension is installed and enabled</li>
          <li>Try refreshing the page and reconnecting</li>
          <li>Check that your browser supports the extension</li>
          <li>Verify you're using a compatible wallet version</li>
        </ul>

        <h3>Posts Not Appearing?</h3>
        <ul>
          <li>Check your internet connection</li>
          <li>Try refreshing the page</li>
          <li>Ensure your post was successfully submitted</li>
          <li>Content may take a few seconds to propagate across relays</li>
        </ul>

        <h3>Having Trouble with Passkeys?</h3>
        <ul>
          <li>Ensure your device supports WebAuthn</li>
          <li>Try using a different browser</li>
          <li>Check that biometric authentication is enabled on your device</li>
          <li>Some corporate or school networks may block WebAuthn</li>
        </ul>

        <h2>Next Steps</h2>
        <p>Now that you're set up, explore these resources:</p>

        <div className="grid md:grid-cols-2 gap-4 my-6">
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold">Continue Learning</h4>
            <ul className="text-sm space-y-1">
              <li><a href="/docs/nostr-basics" className="text-accent-gradient hover:underline">Nostr Basics</a></li>
              <li><a href="/docs/search" className="text-accent-gradient hover:underline">Advanced Search</a></li>
              <li><a href="/docs/profiles" className="text-accent-gradient hover:underline">Profile Management</a></li>
            </ul>
          </div>
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold">Hands-On Tutorials</h4>
            <ul className="text-sm space-y-1">
              <li><a href="/docs/tutorials/posting" className="text-accent-gradient hover:underline">Posting Tutorial</a></li>
              <li><a href="/docs/tutorials/search" className="text-accent-gradient hover:underline">Search Tutorial</a></li>
              <li><a href="/docs/tutorials/community" className="text-accent-gradient hover:underline">Building Community</a></li>
            </ul>
          </div>
        </div>

        <div className="bg-yellow-500/10 border-l-4 border-yellow-500 p-4 rounded-r-lg">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-yellow-300">
                <strong>Need help?</strong> Join our community on Discord for support and connect with other users.
                <a href="https://discord.gg/keythings" className="text-accent-gradient hover:underline ml-1">Join Discord</a>
              </p>
            </div>
          </div>
        </div>

        <blockquote>
          Welcome to the future of social networking! You've successfully set up your Keythings account
          and joined the decentralized social revolution. Your voice now exists on a censorship-resistant
          network owned by its users.
        </blockquote>

        <h2>Quick Reference</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-white/20">
            <thead>
              <tr className="bg-white/5">
                <th className="border border-white/20 px-4 py-2 text-left text-foreground/90">Action</th>
                <th className="border border-white/20 px-4 py-2 text-left text-foreground/90">How To</th>
                <th className="border border-white/20 px-4 py-2 text-left text-foreground/90">Keyboard Shortcut</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-white/20 px-4 py-2 text-foreground/80">Search</td>
                <td className="border border-white/20 px-4 py-2 text-foreground/80">Click search bar or press /</td>
                <td className="border border-white/20 px-4 py-2 text-foreground/80">/</td>
              </tr>
              <tr className="bg-white/5">
                <td className="border border-white/20 px-4 py-2 text-foreground/80">New post</td>
                <td className="border border-white/20 px-4 py-2 text-foreground/80">Click composer or press N</td>
                <td className="border border-white/20 px-4 py-2 text-foreground/80">N</td>
              </tr>
              <tr>
                <td className="border border-white/20 px-4 py-2 text-foreground/80">Notifications</td>
                <td className="border border-white/20 px-4 py-2 text-foreground/80">Click bell icon</td>
                <td className="border border-white/20 px-4 py-2 text-foreground/80">None</td>
              </tr>
              <tr className="bg-white/5">
                <td className="border border-white/20 px-4 py-2 text-foreground/80">Profile</td>
                <td className="border border-white/20 px-4 py-2 text-foreground/80">Click avatar</td>
                <td className="border border-white/20 px-4 py-2 text-foreground/80">P</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
